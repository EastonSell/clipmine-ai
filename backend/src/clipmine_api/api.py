from __future__ import annotations

from pathlib import Path

import orjson
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, Response

from .presentation import serialize_export, serialize_job
from .processor import JobProcessor
from .schemas import JobStatus
from .storage import JobStore

router = APIRouter(prefix="/api")

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


@router.get("/health")
async def healthcheck(request: Request) -> dict[str, str]:
    return {"status": "ok", "service": request.app.state.settings.app_name}


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job(
    request: Request,
    file: UploadFile = File(...),
    store: JobStore = Depends(get_job_store),
    processor: JobProcessor = Depends(get_job_processor),
) -> dict[str, object]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A video file is required.")

    extension = Path(file.filename).suffix.lower()
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="ClipMine AI accepts .mp4 and .mov video uploads only.",
        )
    if content_type and content_type not in ALLOWED_CONTENT_TYPES and content_type not in FALLBACK_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="ClipMine AI accepts .mp4 and .mov video uploads only.",
        )
    normalized_content_type = CANONICAL_CONTENT_TYPES[extension]

    settings = request.app.state.settings
    job_id, file_path, relative_path = store.reserve_upload_path(file.filename)
    size_bytes = 0

    try:
        with file_path.open("wb") as handle:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"Upload exceeds the {settings.max_upload_mb} MB limit.",
                    )
                handle.write(chunk)
    except HTTPException:
        store.discard_reserved_job(job_id)
        raise
    except Exception as exc:
        store.discard_reserved_job(job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed before processing could start.",
        ) from exc
    finally:
        await file.close()

    manifest = store.create_manifest_for_job(
        job_id=job_id,
        file_name=file.filename,
        content_type=normalized_content_type,
        size_bytes=size_bytes,
        relative_path=relative_path,
    )
    await processor.enqueue(job_id)
    return {"jobId": manifest.job_id, "status": manifest.status.value, "fileName": manifest.source_video.file_name}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, store: JobStore = Depends(get_job_store)) -> dict[str, object]:
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.") from exc
    return serialize_job(job)


@router.get("/jobs/{job_id}/video")
async def get_job_video(job_id: str, store: JobStore = Depends(get_job_store)) -> FileResponse:
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.") from exc

    video_path = store.source_video_path(job)
    if not video_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found.")

    return FileResponse(video_path, media_type=job.source_video.content_type, filename=job.source_video.file_name)


@router.get("/jobs/{job_id}/export.json")
async def export_job(job_id: str, store: JobStore = Depends(get_job_store)) -> Response:
    try:
        job = store.load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.") from exc

    if job.status not in {JobStatus.READY, JobStatus.FAILED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export is available when processing completes.")

    payload = serialize_export(job)
    headers = {"Content-Disposition": f'attachment; filename="{job.job_id}.json"'}
    return Response(content=orjson.dumps(payload, option=orjson.OPT_INDENT_2), media_type="application/json", headers=headers)
