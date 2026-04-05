from __future__ import annotations

import logging
import re
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import orjson

from .artifact_store import ArtifactStore
from .media import extract_audio_clip, extract_audio_spectrogram, extract_video_clip
from .schemas import ClipRecord, JobManifest, PackageExportPreset
from .storage import JobStore

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PackageExportLayout:
    archive_suffix: str
    asset_directory: str | None
    asset_extension: str | None
    media_kind: str
    metadata_file_name: str = "manifest.json"
    standardized_media_names: bool = False


@dataclass(slots=True)
class PackageExportArtifact:
    archive_name: str
    archive_path: Path
    cleanup_root: Path
    batch_warning_summary: dict[str, object] | None = None


@dataclass(slots=True)
class BatchPackageSelection:
    job: JobManifest
    clips: list[ClipRecord]


@dataclass(frozen=True, slots=True)
class PackageExportOptions:
    include_media_files: bool
    include_spectrograms: bool


PACKAGE_EXPORT_LAYOUTS: dict[PackageExportPreset, PackageExportLayout] = {
    PackageExportPreset.FULL_AV: PackageExportLayout(
        archive_suffix="",
        asset_directory="clips",
        asset_extension=".mp4",
        media_kind="video",
    ),
    PackageExportPreset.AUDIO_ONLY: PackageExportLayout(
        archive_suffix="-audio",
        asset_directory="audio",
        asset_extension=".wav",
        media_kind="audio",
    ),
    PackageExportPreset.METADATA_ONLY: PackageExportLayout(
        archive_suffix="-metadata",
        asset_directory=None,
        asset_extension=None,
        media_kind="metadata",
    ),
    PackageExportPreset.TRAINING_DATASET: PackageExportLayout(
        archive_suffix="-dataset",
        asset_directory="video",
        asset_extension=".mp4",
        media_kind="video",
        metadata_file_name="metadata.jsonl",
        standardized_media_names=True,
    ),
}


def resolve_package_export_options(
    preset: PackageExportPreset,
    *,
    include_spectrograms: bool | None = None,
) -> PackageExportOptions:
    if preset is PackageExportPreset.METADATA_ONLY:
        return PackageExportOptions(include_media_files=False, include_spectrograms=False)
    if preset is PackageExportPreset.TRAINING_DATASET:
        return PackageExportOptions(include_media_files=True, include_spectrograms=False)

    return PackageExportOptions(
        include_media_files=True,
        include_spectrograms=True if include_spectrograms is None else include_spectrograms,
    )


def build_package_export(
    job: JobManifest,
    clips: list[ClipRecord],
    *,
    store: JobStore,
    artifact_store: ArtifactStore,
    preset: PackageExportPreset = PackageExportPreset.FULL_AV,
    include_spectrograms: bool | None = None,
) -> PackageExportArtifact:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    options = resolve_package_export_options(
        preset,
        include_spectrograms=include_spectrograms,
    )
    cleanup_root = Path(tempfile.mkdtemp(prefix=f"clipmine-export-{job.job_id}-"))
    package_root = cleanup_root / build_package_root_name(job.job_id, preset)
    package_root.mkdir(parents=True, exist_ok=True)

    asset_dir: Path | None = None
    spectrogram_dir: Path | None = None
    source_path: Path | None = None
    if options.include_media_files and layout.asset_directory:
        asset_dir = package_root / layout.asset_directory
        asset_dir.mkdir(parents=True, exist_ok=True)
    if options.include_spectrograms:
        spectrogram_dir = package_root / "spectrograms"
        spectrogram_dir.mkdir(parents=True, exist_ok=True)
    if options.include_media_files or options.include_spectrograms:
        source_path = _resolve_source_video_path(job, store=store, artifact_store=artifact_store, cleanup_root=cleanup_root)

    manifest_payload = {
        "jobId": job.job_id,
        "preset": preset.value,
        "mediaKind": layout.media_kind,
        "includesMediaFiles": options.include_media_files,
        "includesSpectrograms": options.include_spectrograms,
        "sourceVideo": {
            "id": job.source_video.id,
            "file_name": job.source_video.file_name,
            "content_type": job.source_video.content_type,
            "size_bytes": job.source_video.size_bytes,
            "duration_seconds": job.source_video.duration_seconds,
        },
        "exportedAt": datetime.now(tz=UTC).isoformat(),
        "clipCount": len(clips),
        "clips": [],
    }
    dataset_rows: list[dict[str, object]] = []

    for ordinal, clip in enumerate(clips, start=1):
        clip_file_name = (
            build_export_clip_file_name(
                ordinal,
                clip.id,
                preset=preset,
                extension=layout.asset_extension,
            )
            if options.include_media_files
            else None
        )
        relative_path = (
            f"{layout.asset_directory}/{clip_file_name}"
            if layout.asset_directory and clip_file_name
            else None
        )
        spectrogram_file_name = build_spectrogram_file_name(ordinal, clip.id) if options.include_spectrograms else None
        spectrogram_relative_path = (
            f"spectrograms/{spectrogram_file_name}"
            if spectrogram_file_name
            else None
        )

        if options.include_media_files and asset_dir and source_path and clip_file_name:
            output_path = asset_dir / clip_file_name
            if preset in (PackageExportPreset.FULL_AV, PackageExportPreset.TRAINING_DATASET):
                extract_video_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
            elif preset is PackageExportPreset.AUDIO_ONLY:
                extract_audio_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
        if options.include_spectrograms and spectrogram_dir and source_path and spectrogram_file_name:
            extract_audio_spectrogram(
                source_path,
                spectrogram_dir / spectrogram_file_name,
                start_time=clip.start,
                end_time=clip.end,
            )

        if preset is PackageExportPreset.TRAINING_DATASET:
            dataset_rows.append(
                build_training_dataset_row(
                    dataset_ordinal=ordinal,
                    job=job,
                    clip=clip,
                    file_path=relative_path or "",
                    media_kind=layout.media_kind,
                )
            )
        else:
            manifest_payload["clips"].append(
                {
                    "ordinal": ordinal,
                    "clipId": clip.id,
                    "fileName": clip_file_name,
                    "relativePath": relative_path,
                    "spectrogramFileName": spectrogram_file_name,
                    "spectrogramRelativePath": spectrogram_relative_path,
                    "text": clip.text,
                    "start": clip.start,
                    "end": clip.end,
                    "duration": clip.duration,
                    "score": clip.score,
                    "quality_label": clip.quality_label,
                    "selection_recommendation": clip.selection_recommendation,
                    "tags": clip.tags,
                    "quality_penalties": clip.quality_penalties,
                    "candidate_metrics": clip.candidate_metrics.model_dump(mode="json"),
                    "quality_breakdown": clip.quality_breakdown.model_dump(mode="json"),
                    "word_alignments": [alignment.model_dump(mode="json") for alignment in clip.word_alignments],
                }
            )

    metadata_path = package_root / layout.metadata_file_name
    if preset is PackageExportPreset.TRAINING_DATASET:
        metadata_path.write_bytes(serialize_jsonl(dataset_rows))
    else:
        metadata_path.write_bytes(orjson.dumps(manifest_payload, option=orjson.OPT_INDENT_2))

    archive_name = f"{package_root.name}.zip"
    archive_path = cleanup_root / archive_name
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(package_root.rglob("*")):
            if path.is_file():
                archive.write(
                    path,
                    arcname=str(path.relative_to(cleanup_root)),
                    compress_type=_resolve_archive_compression(path),
                )

    return PackageExportArtifact(
        archive_name=archive_name,
        archive_path=archive_path,
        cleanup_root=cleanup_root,
    )


def build_batch_package_export(
    selections: list[BatchPackageSelection],
    *,
    store: JobStore,
    artifact_store: ArtifactStore,
    batch_label: str | None = None,
    preset: PackageExportPreset = PackageExportPreset.FULL_AV,
    quality_threshold: float | None = None,
    include_spectrograms: bool | None = None,
) -> PackageExportArtifact:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    options = resolve_package_export_options(
        preset,
        include_spectrograms=include_spectrograms,
    )
    cleanup_root = Path(tempfile.mkdtemp(prefix="clipmine-batch-export-"))
    package_root_name = build_batch_package_root_name(batch_label, preset)
    package_root = cleanup_root / package_root_name
    package_root.mkdir(parents=True, exist_ok=True)
    jobs_dir: Path | None = None
    if not layout.standardized_media_names:
        jobs_dir = package_root / "jobs"
        jobs_dir.mkdir(parents=True, exist_ok=True)

    manifest_payload = {
        "batchLabel": batch_label or "ClipMine batch export",
        "exportedAt": datetime.now(tz=UTC).isoformat(),
        "preset": preset.value,
        "mediaKind": layout.media_kind,
        "includesMediaFiles": options.include_media_files,
        "includesSpectrograms": options.include_spectrograms,
        "qualityThreshold": quality_threshold,
        "requestedJobCount": len(selections),
        "jobCount": 0,
        "clipCount": 0,
        "failedJobCount": 0,
        "warningCount": 0,
        "warnings": [],
        "jobs": [],
    }
    dataset_rows: list[dict[str, object]] = []
    first_error: Exception | None = None

    for selection in selections:
        job_dir = jobs_dir / selection.job.job_id if jobs_dir else package_root

        try:
            job_dir.mkdir(parents=True, exist_ok=True)
            asset_dir: Path | None = None
            spectrogram_dir: Path | None = None
            source_path: Path | None = None
            created_paths: list[Path] = []
            job_dataset_rows: list[dict[str, object]] = []
            starting_dataset_count = len(dataset_rows)

            if options.include_media_files and layout.asset_directory and not layout.standardized_media_names:
                asset_dir = job_dir / layout.asset_directory
                asset_dir.mkdir(parents=True, exist_ok=True)
            elif options.include_media_files and layout.asset_directory:
                asset_dir = package_root / layout.asset_directory
                asset_dir.mkdir(parents=True, exist_ok=True)
            if options.include_spectrograms:
                spectrogram_dir = job_dir / "spectrograms"
                spectrogram_dir.mkdir(parents=True, exist_ok=True)
            if options.include_media_files or options.include_spectrograms:
                source_path = _resolve_source_video_path(
                    selection.job,
                    store=store,
                    artifact_store=artifact_store,
                    cleanup_root=cleanup_root,
                )

            job_manifest = {
                "jobId": selection.job.job_id,
                "sourceVideo": {
                    "id": selection.job.source_video.id,
                    "file_name": selection.job.source_video.file_name,
                    "content_type": selection.job.source_video.content_type,
                    "size_bytes": selection.job.source_video.size_bytes,
                    "duration_seconds": selection.job.source_video.duration_seconds,
                },
                "clipCount": len(selection.clips),
                "clips": [],
            }

            for ordinal, clip in enumerate(selection.clips, start=1):
                dataset_ordinal = len(dataset_rows) + len(job_dataset_rows) + 1
                clip_file_name = (
                    build_export_clip_file_name(
                        dataset_ordinal if layout.standardized_media_names else ordinal,
                        clip.id,
                        preset=preset,
                        extension=layout.asset_extension,
                    )
                    if options.include_media_files
                    else None
                )
                relative_path = (
                    (
                        f"{layout.asset_directory}/{clip_file_name}"
                        if layout.standardized_media_names
                        else f"jobs/{selection.job.job_id}/{layout.asset_directory}/{clip_file_name}"
                    )
                    if layout.asset_directory and clip_file_name
                    else None
                )
                spectrogram_file_name = build_spectrogram_file_name(ordinal, clip.id) if options.include_spectrograms else None
                spectrogram_relative_path = (
                    f"jobs/{selection.job.job_id}/spectrograms/{spectrogram_file_name}"
                    if spectrogram_file_name
                    else None
                )

                if options.include_media_files and asset_dir and source_path and clip_file_name:
                    output_path = asset_dir / clip_file_name
                    if preset in (PackageExportPreset.FULL_AV, PackageExportPreset.TRAINING_DATASET):
                        extract_video_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
                    elif preset is PackageExportPreset.AUDIO_ONLY:
                        extract_audio_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
                    created_paths.append(output_path)
                if options.include_spectrograms and spectrogram_dir and source_path and spectrogram_file_name:
                    spectrogram_output_path = spectrogram_dir / spectrogram_file_name
                    extract_audio_spectrogram(
                        source_path,
                        spectrogram_output_path,
                        start_time=clip.start,
                        end_time=clip.end,
                    )
                    created_paths.append(spectrogram_output_path)

                if preset is PackageExportPreset.TRAINING_DATASET:
                    job_dataset_rows.append(
                        build_training_dataset_row(
                            dataset_ordinal=dataset_ordinal,
                            job=selection.job,
                            clip=clip,
                            file_path=relative_path or "",
                            media_kind=layout.media_kind,
                        )
                    )

                job_manifest["clips"].append(
                    {
                        "ordinal": ordinal,
                        "clipId": clip.id,
                        "fileName": clip_file_name,
                        "relativePath": relative_path,
                        "spectrogramFileName": spectrogram_file_name,
                        "spectrogramRelativePath": spectrogram_relative_path,
                        "text": clip.text,
                        "start": clip.start,
                        "end": clip.end,
                        "duration": clip.duration,
                        "score": clip.score,
                        "quality_label": clip.quality_label,
                        "selection_recommendation": clip.selection_recommendation,
                        "tags": clip.tags,
                        "quality_penalties": clip.quality_penalties,
                        "candidate_metrics": clip.candidate_metrics.model_dump(mode="json"),
                        "quality_breakdown": clip.quality_breakdown.model_dump(mode="json"),
                        "word_alignments": [alignment.model_dump(mode="json") for alignment in clip.word_alignments],
                    }
                )

            if preset is not PackageExportPreset.TRAINING_DATASET:
                manifest_payload["jobs"].append(job_manifest)
            else:
                dataset_rows.extend(job_dataset_rows)
            manifest_payload["jobCount"] += 1
            manifest_payload["clipCount"] += len(selection.clips)
        except Exception as exc:
            first_error = first_error or exc
            if layout.standardized_media_names:
                del dataset_rows[starting_dataset_count:]
                for path in reversed(created_paths):
                    path.unlink(missing_ok=True)
            else:
                shutil.rmtree(job_dir, ignore_errors=True)
            warning_payload = _build_batch_export_warning(selection.job, exc)
            manifest_payload["warnings"].append(warning_payload)
            logger.warning(
                "batch_package.job_skipped job_id=%s preset=%s detail=%s",
                selection.job.job_id,
                preset.value,
                warning_payload["detail"],
            )

    manifest_payload["failedJobCount"] = len(manifest_payload["warnings"])
    manifest_payload["warningCount"] = len(manifest_payload["warnings"])

    if manifest_payload["jobCount"] == 0:
        shutil.rmtree(cleanup_root, ignore_errors=True)
        if first_error is not None:
            raise first_error
        raise RuntimeError("The batch clip package could not be built.")

    metadata_path = package_root / layout.metadata_file_name
    if preset is PackageExportPreset.TRAINING_DATASET:
        metadata_path.write_bytes(serialize_jsonl(dataset_rows))
    else:
        metadata_path.write_bytes(orjson.dumps(manifest_payload, option=orjson.OPT_INDENT_2))

    archive_name = f"{package_root.name}.zip"
    archive_path = cleanup_root / archive_name
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(package_root.rglob("*")):
            if path.is_file():
                archive.write(
                    path,
                    arcname=str(path.relative_to(cleanup_root)),
                    compress_type=_resolve_archive_compression(path),
                )

    return PackageExportArtifact(
        archive_name=archive_name,
        archive_path=archive_path,
        cleanup_root=cleanup_root,
        batch_warning_summary=(
            {
                "preset": preset.value,
                "qualityThreshold": quality_threshold,
                "requestedJobCount": manifest_payload["requestedJobCount"],
                "exportedJobCount": manifest_payload["jobCount"],
                "failedJobCount": manifest_payload["failedJobCount"],
                "warnings": manifest_payload["warnings"],
            }
            if manifest_payload["warnings"]
            else None
        ),
    )


def cleanup_package_export(artifact: PackageExportArtifact) -> None:
    shutil.rmtree(artifact.cleanup_root, ignore_errors=True)


def build_package_root_name(job_id: str, preset: PackageExportPreset = PackageExportPreset.FULL_AV) -> str:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    return f"clipmine-export-{job_id}{layout.archive_suffix}"


def build_clip_file_name(ordinal: int, clip_id: str, *, extension: str | None = ".mp4") -> str | None:
    if not extension:
        return None
    return f"clip_{ordinal:03d}__{clip_id}{extension}"


def build_export_clip_file_name(
    ordinal: int,
    clip_id: str,
    *,
    preset: PackageExportPreset,
    extension: str | None = None,
) -> str | None:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    resolved_extension = layout.asset_extension if extension is None else extension
    if not resolved_extension:
        return None
    if layout.standardized_media_names:
        return f"clip_{ordinal:06d}{resolved_extension}"
    return build_clip_file_name(ordinal, clip_id, extension=resolved_extension)


def build_spectrogram_file_name(ordinal: int, clip_id: str) -> str:
    return f"clip_{ordinal:03d}__{clip_id}.png"


def build_batch_package_root_name(
    batch_label: str | None,
    preset: PackageExportPreset = PackageExportPreset.FULL_AV,
) -> str:
    normalized = _slugify(batch_label or "clipmine-batch")
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    return f"clipmine-batch-export-{normalized}{layout.archive_suffix}"


def _resolve_source_video_path(
    job: JobManifest,
    *,
    store: JobStore,
    artifact_store: ArtifactStore,
    cleanup_root: Path,
) -> Path:
    if job.source_video.storage_backend == "local":
        source_path = store.source_video_path(job)
        if not source_path.exists():
            raise FileNotFoundError(f"Source video not found for job {job.job_id}.")
        return source_path

    suffix = Path(job.source_video.file_name).suffix.lower() or ".mp4"
    destination = cleanup_root / f"source-cache-{job.job_id}{suffix}"
    artifact_store.download_source_video(job.source_video, destination)
    return destination


def _build_batch_export_warning(job: JobManifest, exc: Exception) -> dict[str, str]:
    return {
        "code": "job_export_failed",
        "jobId": job.job_id,
        "fileName": job.source_video.file_name,
        "message": "This job was skipped because its media could not be packaged.",
        "detail": _format_batch_export_warning_detail(exc),
    }


def _format_batch_export_warning_detail(exc: Exception) -> str:
    detail = str(exc).strip()
    return detail or exc.__class__.__name__


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "batch"


def _resolve_archive_compression(path: Path) -> int:
    return zipfile.ZIP_STORED if path.suffix.lower() == ".mp4" else zipfile.ZIP_DEFLATED


def build_training_dataset_row(
    *,
    dataset_ordinal: int,
    job: JobManifest,
    clip: ClipRecord,
    file_path: str,
    media_kind: str,
) -> dict[str, object]:
    return {
        "id": f"clip_{dataset_ordinal:06d}",
        "job_id": job.job_id,
        "clip_id": clip.id,
        "source_video_id": job.source_video.id,
        "source_file_name": job.source_video.file_name,
        "media_type": media_kind,
        "file_path": file_path,
        "transcript": clip.text,
        "timestamps": {
            "start_seconds": clip.start,
            "end_seconds": clip.end,
            "duration_seconds": clip.duration,
        },
        "confidence": clip.confidence,
        "score": clip.score,
        "quality_label": clip.quality_label,
        "selection_recommendation": clip.selection_recommendation,
    }


def serialize_jsonl(rows: list[dict[str, object]]) -> bytes:
    if not rows:
        return b""

    return b"\n".join(orjson.dumps(row) for row in rows) + b"\n"
