from __future__ import annotations

import re
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import orjson

from .artifact_store import ArtifactStore
from .media import extract_audio_clip, extract_video_clip
from .schemas import ClipRecord, JobManifest, PackageExportPreset
from .storage import JobStore


@dataclass(frozen=True, slots=True)
class PackageExportLayout:
    archive_suffix: str
    asset_directory: str | None
    asset_extension: str | None
    media_kind: str
    includes_media_files: bool


@dataclass(slots=True)
class PackageExportArtifact:
    archive_name: str
    archive_path: Path
    cleanup_root: Path


@dataclass(slots=True)
class BatchPackageSelection:
    job: JobManifest
    clips: list[ClipRecord]


PACKAGE_EXPORT_LAYOUTS: dict[PackageExportPreset, PackageExportLayout] = {
    PackageExportPreset.FULL_AV: PackageExportLayout(
        archive_suffix="",
        asset_directory="clips",
        asset_extension=".mp4",
        media_kind="video",
        includes_media_files=True,
    ),
    PackageExportPreset.AUDIO_ONLY: PackageExportLayout(
        archive_suffix="-audio",
        asset_directory="audio",
        asset_extension=".wav",
        media_kind="audio",
        includes_media_files=True,
    ),
    PackageExportPreset.METADATA_ONLY: PackageExportLayout(
        archive_suffix="-metadata",
        asset_directory=None,
        asset_extension=None,
        media_kind="metadata",
        includes_media_files=False,
    ),
}


def build_package_export(
    job: JobManifest,
    clips: list[ClipRecord],
    *,
    store: JobStore,
    artifact_store: ArtifactStore,
    preset: PackageExportPreset = PackageExportPreset.FULL_AV,
) -> PackageExportArtifact:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    cleanup_root = Path(tempfile.mkdtemp(prefix=f"clipmine-export-{job.job_id}-"))
    package_root = cleanup_root / build_package_root_name(job.job_id, preset)
    package_root.mkdir(parents=True, exist_ok=True)

    asset_dir: Path | None = None
    source_path: Path | None = None
    if layout.includes_media_files:
        asset_dir = package_root / layout.asset_directory
        asset_dir.mkdir(parents=True, exist_ok=True)
        source_path = _resolve_source_video_path(job, store=store, artifact_store=artifact_store, cleanup_root=cleanup_root)

    manifest_payload = {
        "jobId": job.job_id,
        "preset": preset.value,
        "mediaKind": layout.media_kind,
        "includesMediaFiles": layout.includes_media_files,
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

    for ordinal, clip in enumerate(clips, start=1):
        clip_file_name = build_clip_file_name(ordinal, clip.id, extension=layout.asset_extension)
        relative_path = (
            f"{layout.asset_directory}/{clip_file_name}"
            if layout.asset_directory and clip_file_name
            else None
        )

        if layout.includes_media_files and asset_dir and source_path and clip_file_name:
            output_path = asset_dir / clip_file_name
            if preset is PackageExportPreset.FULL_AV:
                extract_video_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
            elif preset is PackageExportPreset.AUDIO_ONLY:
                extract_audio_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)

        manifest_payload["clips"].append(
            {
                "ordinal": ordinal,
                "clipId": clip.id,
                "fileName": clip_file_name,
                "relativePath": relative_path,
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

    manifest_path = package_root / "manifest.json"
    manifest_path.write_bytes(orjson.dumps(manifest_payload, option=orjson.OPT_INDENT_2))

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
) -> PackageExportArtifact:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    cleanup_root = Path(tempfile.mkdtemp(prefix="clipmine-batch-export-"))
    package_root_name = build_batch_package_root_name(batch_label, preset)
    package_root = cleanup_root / package_root_name
    package_root.mkdir(parents=True, exist_ok=True)
    jobs_dir = package_root / "jobs"
    jobs_dir.mkdir(parents=True, exist_ok=True)

    manifest_payload = {
        "batchLabel": batch_label or "ClipMine batch export",
        "exportedAt": datetime.now(tz=UTC).isoformat(),
        "preset": preset.value,
        "mediaKind": layout.media_kind,
        "includesMediaFiles": layout.includes_media_files,
        "qualityThreshold": quality_threshold,
        "jobCount": len(selections),
        "clipCount": sum(len(selection.clips) for selection in selections),
        "jobs": [],
    }

    for selection in selections:
        job_dir = jobs_dir / selection.job.job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        asset_dir: Path | None = None
        source_path: Path | None = None

        if layout.includes_media_files and layout.asset_directory:
            asset_dir = job_dir / layout.asset_directory
            asset_dir.mkdir(parents=True, exist_ok=True)
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
            clip_file_name = build_clip_file_name(ordinal, clip.id, extension=layout.asset_extension)
            relative_path = (
                f"jobs/{selection.job.job_id}/{layout.asset_directory}/{clip_file_name}"
                if layout.asset_directory and clip_file_name
                else None
            )

            if layout.includes_media_files and asset_dir and source_path and clip_file_name:
                output_path = asset_dir / clip_file_name
                if preset is PackageExportPreset.FULL_AV:
                    extract_video_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)
                elif preset is PackageExportPreset.AUDIO_ONLY:
                    extract_audio_clip(source_path, output_path, start_time=clip.start, end_time=clip.end)

            job_manifest["clips"].append(
                {
                    "ordinal": ordinal,
                    "clipId": clip.id,
                    "fileName": clip_file_name,
                    "relativePath": relative_path,
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

        manifest_payload["jobs"].append(job_manifest)

    manifest_path = package_root / "manifest.json"
    manifest_path.write_bytes(orjson.dumps(manifest_payload, option=orjson.OPT_INDENT_2))

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


def cleanup_package_export(artifact: PackageExportArtifact) -> None:
    shutil.rmtree(artifact.cleanup_root, ignore_errors=True)


def build_package_root_name(job_id: str, preset: PackageExportPreset = PackageExportPreset.FULL_AV) -> str:
    layout = PACKAGE_EXPORT_LAYOUTS[preset]
    return f"clipmine-export-{job_id}{layout.archive_suffix}"


def build_clip_file_name(ordinal: int, clip_id: str, *, extension: str | None = ".mp4") -> str | None:
    if not extension:
        return None
    return f"clip_{ordinal:03d}__{clip_id}{extension}"


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
        return store.source_video_path(job)

    suffix = Path(job.source_video.file_name).suffix.lower() or ".mp4"
    destination = cleanup_root / f"source-cache-{job.job_id}{suffix}"
    artifact_store.download_source_video(job.source_video, destination)
    return destination


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "batch"


def _resolve_archive_compression(path: Path) -> int:
    return zipfile.ZIP_STORED if path.suffix.lower() == ".mp4" else zipfile.ZIP_DEFLATED
