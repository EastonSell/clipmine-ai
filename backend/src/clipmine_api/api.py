from __future__ import annotations

import logging
from pathlib import Path

import imageio_ffmpeg
import orjson
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, Response

from .artifact_store import ArtifactStore
from .errors import build_http_error
from .presentation import serialize_export, serialize_job
from .processor import JobProcessor
from .schemas import (
    CompleteMultipartUploadRequest,
    JobStatus,
    SourceVideoRecord,
    UploadInitRequest,
    UploadSessionRecord,
)
from .storage import JobStore

router = APIRouter(prefix="/api")
logger = logging.getLogger("uvicorn.error")

ALLOWED_EXTENSIONS = {".mp4", ".mov"}
ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime"}
FALLBACK_CONTENT_TYPES = {"application/octet-stream", "binary/octet-stream"}
CANONICAL_CONTENT_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
}


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def get_job_processor(request: Request) -> JobProcessor:
    return request.app.state.job_processor


def get_artifact_store(request: Request) -> ArtifactStore:
    return request.app.state.artifact_store


@router.get("/health")
async def healthcheck(request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    store = request.app.state.job_store
    processor = request.app.state.job_processor
    artifact_store = request.app.state.artifact_store
    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    checks = {
        "storageWritable": store.is_storage_writable(),
        "ffmpegAvailable": ffmpeg_path.exists(),
        "modelCacheReady": settings.model_cache_dir.exists() and settings.model_cache_dir.is_dir(),
        "objectStoreReachable": artifact_store.is_reachable(),
        "tempDiskWritable": store.is_temp_disk_writable(),
    }
    return {
        "status": "ok",
        "service": settings.app_name,
        "checks": checks,
        "queueDepth": processor.queue_depth,
        "activeWorkers": processor.active_workers,
    }


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job(
    request: Request,
    file: UploadFile = File(...),
    store: JobStore = Depends(get_job_store),
    processor: JobProcessor = Depends(get_job_processor),
) -> dict[str, object]:
    settings = request.app.state.settings
    if settings.storage_backend != "local":
        logger.warning("upload.reject direct_upload_disabled storage_backend=%s", settings.storage_backend)
        raise build_http_error(
            status_code=status.HTTP_409_CONFLICT,
            code="object_store_unavailable",
            message="Direct uploads are unavailable for the current storage backend.",
            retryable=False,
        )

    if not file.filename:
        logger.warning("upload.reject missing_filename")
        raise build_http_error(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="unsupported_file_type",
            message="A video file is required.",
        )
    normalized_content_type = _validate_upload_metadata(
        file_name=file.filename,
        content_type=file.content_type,
        size_bytes=0,
        max_upload_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )

    job_id, file_path, relative_path = store.reserve_upload_path(file.filename)
    size_bytes = 0
    next_progress_log_bytes = 5 * 1024 * 1024
    logger.info(
        "upload.start job_id=%s filename=%s normalized_content_type=%s target_path=%s",
        job_id,
        file.filename,
        normalized_content_type,
        file_path,
    )

    try:
        with file_path.open("wb") as handle:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise build_http_error(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        code="file_too_large",
                        message=f"Upload exceeds the {settings.max_upload_mb} MB limit.",
                        retryable=False,
                    )
                handle.write(chunk)
                if size_bytes >= next_progress_log_bytes:
                    logger.info(
                        "upload.progress job_id=%s filename=%s size_bytes=%s size_mb=%.2f",
                        job_id,
                        file.filename,
                        size_bytes,
                        size_bytes / (1024 * 1024),
                    )
                    next_progress_log_bytes += 5 * 1024 * 1024
    except HTTPException:
        logger.warning("upload.http_error job_id=%s filename=%s size_bytes=%s", job_id, file.filename, size_bytes)
        store.discard_reserved_job(job_id)
        raise
    except Exception as exc:
        logger.exception("upload.exception job_id=%s filename=%s size_bytes=%s", job_id, file.filename, size_bytes)
        store.discard_reserved_job(job_id)
        raise build_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="upload_complete_failed",
            message="Upload failed before processing could start.",
            retryable=True,
        ) from exc
    finally:
        await file.close()
        logger.debug("upload.file_closed job_id=%s filename=%s", job_id, file.filename)

    manifest = store.create_manifest_for_job(
        job_id=job_id,
        file_name=file.filename,
        content_type=normalized_content_type,
        size_bytes=size_bytes,
        relative_path=relative_path,
        storage_backend="local",
    )
    logger.info(
        "upload.saved job_id=%s filename=%s size_bytes=%s relative_path=%s",
        manifest.job_id,
        manifest.source_video.file_name,
        size_bytes,
        relative_path,
    )
    await processor.enqueue(job_id)
    logger.info("upload.enqueued job_id=%s filename=%s", manifest.job_id, manifest.source_video.file_name)
    return {"jobId": manifest.job_id, "status": manifest.status.value, "fileName": manifest.source_video.file_name}


@router.post("/uploads/init", status_code=status.HTTP_201_CREATED)
async def initialize_multipart_upload(
    payload: UploadInitRequest,
    request: Request,
    store: JobStore = Depends(get_job_store),
    artifact_store: ArtifactStore = Depends(get_artifact_store),
) -> dict[str, object]:
    settings = request.app.state.settings

    if settings.storage_backend != "s3" or not artifact_store.supports_multipart_uploads:
        raise build_http_error(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="object_store_unavailable",
            message="Multipart uploads are unavailable because object storage is not configured.",
            retryable=False,
        )
    if not artifact_store.is_reachable():
        raise build_http_error(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="object_store_unavailable",
            message="Object storage is unavailable right now.",
            retryable=True,
        )

    normalized_content_type = _validate_upload_metadata(
        file_name=payload.file_name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        max_upload_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    session = store.build_upload_session(
        file_name=payload.file_name,
        content_type=normalized_content_type,
        size_bytes=payload.size_bytes,
        part_size_bytes=settings.upload_part_size_bytes,
        ttl_minutes=settings.upload_session_ttl_minutes,
    )
    source = _build_source_video_for_session(session, storage_backend=artifact_store.backend_name)

    try:
        upload_id = artifact_store.create_multipart_upload(source)
    except (BotoCoreError, ClientError) as exc:
        logger.exception("upload.init_failed job_id=%s filename=%s", session.job_id, payload.file_name)
        raise build_http_error(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="object_store_unavailable",
            message="Object storage rejected the multipart upload request.",
            retryable=True,
        ) from exc

    saved_session = store.save_upload_session(session.model_copy(update={"upload_id": upload_id}))
    expires_in_seconds = max(60, settings.upload_session_ttl_minutes * 60)
    parts = [
        {
            "partNumber": part_number,
            "url": artifact_store.get_presigned_part_url(
                source,
                upload_id=upload_id,
                part_number=part_number,
                expires_in_seconds=expires_in_seconds,
            ),
        }
        for part_number in range(1, saved_session.total_parts + 1)
    ]
    logger.info(
        "upload.init_ready session_id=%s job_id=%s file_name=%s parts=%s",
        saved_session.session_id,
        saved_session.job_id,
        saved_session.file_name,
        len(parts),
    )
    return {
        "uploadSessionId": saved_session.session_id,
        "jobId": saved_session.job_id,
        "fileName": saved_session.file_name,
        "partSizeBytes": saved_session.part_size_bytes,
        "expiresAt": saved_session.expires_at,
        "parts": parts,
    }


@router.post("/uploads/{upload_session_id}/complete")
async def complete_multipart_upload(
    upload_session_id: str,
    payload: CompleteMultipartUploadRequest,
    request: Request,
    store: JobStore = Depends(get_job_store),
    processor: JobProcessor = Depends(get_job_processor),
    artifact_store: ArtifactStore = Depends(get_artifact_store),
) -> dict[str, object]:
    try:
        session = store.load_upload_session(upload_session_id)
    except FileNotFoundError as exc:
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="upload_session_expired",
            message="The upload session expired or was not found.",
            retryable=False,
        ) from exc

    source = _build_source_video_for_session(session, storage_backend=artifact_store.backend_name)

    try:
        artifact_store.complete_multipart_upload(
            source,
            upload_id=session.upload_id or "",
            parts=[part.model_dump(by_alias=True) for part in payload.parts],
        )
    except (BotoCoreError, ClientError) as exc:
        logger.exception("upload.complete_failed session_id=%s job_id=%s", session.session_id, session.job_id)
        raise build_http_error(
            status_code=status.HTTP_502_BAD_GATEWAY,
            code="upload_complete_failed",
            message="The multipart upload could not be finalized.",
            retryable=True,
        ) from exc

    manifest = store.create_manifest_for_job(
        job_id=session.job_id,
        file_name=session.file_name,
        content_type=session.content_type,
        size_bytes=session.size_bytes,
        relative_path=session.relative_path,
        storage_backend=artifact_store.backend_name,
    )
    await processor.enqueue(manifest.job_id)
    store.delete_upload_session(upload_session_id)
    logger.info("upload.complete_ready session_id=%s job_id=%s", session.session_id, manifest.job_id)
    return {"jobId": manifest.job_id, "status": manifest.status.value, "fileName": manifest.source_video.file_name}


@router.delete("/uploads/{upload_session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def abort_multipart_upload(
    upload_session_id: str,
    store: JobStore = Depends(get_job_store),
    artifact_store: ArtifactStore = Depends(get_artifact_store),
) -> Response:
    try:
        session = store.load_upload_session(upload_session_id)
    except FileNotFoundError as exc:
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="upload_session_expired",
            message="The upload session expired or was not found.",
            retryable=False,
        ) from exc

    artifact_store.abort_multipart_upload(session)
    store.delete_upload_session(upload_session_id)
    logger.info("upload.aborted session_id=%s job_id=%s", session.session_id, session.job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, store: JobStore = Depends(get_job_store)) -> dict[str, object]:
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        logger.warning("job.lookup_missing job_id=%s", job_id)
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="job_not_found",
            message="Job not found.",
            retryable=False,
        ) from exc
    logger.debug("job.lookup job_id=%s status=%s phase=%s", job_id, job.status.value, job.progress_phase.value)
    return serialize_job(job)


@router.get("/jobs/{job_id}/video")
async def get_job_video(
    job_id: str,
    request: Request,
    store: JobStore = Depends(get_job_store),
    artifact_store: ArtifactStore = Depends(get_artifact_store),
):
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        logger.warning("video.lookup_missing job_id=%s", job_id)
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="job_not_found",
            message="Job not found.",
            retryable=False,
        ) from exc

    if job.source_video.storage_backend == "s3":
        if not artifact_store.is_reachable():
            raise build_http_error(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="object_store_unavailable",
                message="Object storage is unavailable right now.",
                retryable=True,
            )
        logger.info("video.proxy_remote job_id=%s storage_backend=s3", job_id)
        return artifact_store.build_video_response(
            job.source_video,
            range_header=request.headers.get("range"),
        )

    video_path = store.source_video_path(job)
    if not video_path.exists():
        logger.warning("video.missing job_id=%s path=%s", job_id, video_path)
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="video_not_found",
            message="Video file not found.",
            retryable=False,
        )

    logger.info("video.serve job_id=%s path=%s", job_id, video_path)
    return FileResponse(video_path, media_type=job.source_video.content_type, filename=job.source_video.file_name)


@router.get("/jobs/{job_id}/export.json")
async def export_job(job_id: str, store: JobStore = Depends(get_job_store)) -> Response:
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        logger.warning("export.lookup_missing job_id=%s", job_id)
        raise build_http_error(
            status_code=status.HTTP_404_NOT_FOUND,
            code="job_not_found",
            message="Job not found.",
            retryable=False,
        ) from exc

    if job.status not in {JobStatus.READY, JobStatus.FAILED}:
        logger.info("export.blocked job_id=%s status=%s", job_id, job.status.value)
        raise build_http_error(
            status_code=status.HTTP_409_CONFLICT,
            code="export_not_ready",
            message="Export is available when processing completes.",
            retryable=False,
        )

    payload = serialize_export(job)
    headers = {"Content-Disposition": f'attachment; filename="{job.job_id}.json"'}
    logger.info("export.ready job_id=%s status=%s clip_count=%s", job_id, job.status.value, len(job.clips))
    return Response(content=orjson.dumps(payload, option=orjson.OPT_INDENT_2), media_type="application/json", headers=headers)


def _validate_upload_metadata(
    *,
    file_name: str,
    content_type: str | None,
    size_bytes: int,
    max_upload_bytes: int,
    max_upload_mb: int,
) -> str:
    extension = Path(file_name).suffix.lower()
    normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
    logger.info(
        "upload.acceptance_check filename=%s extension=%s content_type=%s size_bytes=%s",
        file_name,
        extension,
        normalized_content_type or "unknown",
        size_bytes,
    )
    if extension not in ALLOWED_EXTENSIONS:
        raise build_http_error(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="unsupported_file_type",
            message="ClipMine AI accepts .mp4 and .mov video uploads only.",
            retryable=False,
        )
    if (
        normalized_content_type
        and normalized_content_type not in ALLOWED_CONTENT_TYPES
        and normalized_content_type not in FALLBACK_CONTENT_TYPES
    ):
        raise build_http_error(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="unsupported_file_type",
            message="ClipMine AI accepts .mp4 and .mov video uploads only.",
            retryable=False,
        )
    if size_bytes > max_upload_bytes:
        raise build_http_error(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            code="file_too_large",
            message=f"Upload exceeds the {max_upload_mb} MB limit.",
            retryable=False,
        )
    return CANONICAL_CONTENT_TYPES[extension]


def _build_source_video_for_session(session: UploadSessionRecord, *, storage_backend: str) -> SourceVideoRecord:
    return SourceVideoRecord(
        id=session.job_id,
        file_name=session.file_name,
        content_type=session.content_type,
        size_bytes=session.size_bytes,
        relative_path=session.relative_path,
        storage_backend=storage_backend,
    )
