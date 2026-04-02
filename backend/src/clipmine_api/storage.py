from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

import orjson

from .config import Settings
from .schemas import JobManifest, JobStatus, ProgressPhase, SourceVideoRecord


class JobStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.storage_dir.mkdir(parents=True, exist_ok=True)
        self.settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
        self.settings.jobs_dir.mkdir(parents=True, exist_ok=True)

    def create_job(
        self,
        *,
        file_name: str,
        content_type: str,
        size_bytes: int,
        relative_path: str,
    ) -> JobManifest:
        now = _utc_now()
        job_id = uuid4().hex[:12]
        manifest = JobManifest(
            job_id=job_id,
            status=JobStatus.QUEUED,
            progress_phase=ProgressPhase.QUEUED,
            created_at=now,
            updated_at=now,
            source_video=SourceVideoRecord(
                id=job_id,
                file_name=file_name,
                content_type=content_type,
                size_bytes=size_bytes,
                relative_path=relative_path,
            ),
        )
        job_dir = self.job_dir(job_id)
        (job_dir / "source").mkdir(parents=True, exist_ok=True)
        (job_dir / "artifacts").mkdir(parents=True, exist_ok=True)
        self.save_job(manifest)
        return manifest

    def save_job(self, job: JobManifest) -> JobManifest:
        stamped_job = job.model_copy(update={"updated_at": _utc_now()})
        payload = stamped_job.model_dump(mode="json")
        self.manifest_path(stamped_job.job_id).write_bytes(orjson.dumps(payload, option=orjson.OPT_INDENT_2))
        return stamped_job

    def load_job(self, job_id: str) -> JobManifest:
        manifest_path = self.manifest_path(job_id)
        if not manifest_path.exists():
            raise FileNotFoundError(job_id)
        return JobManifest.model_validate(orjson.loads(manifest_path.read_bytes()))

    def write_upload(self, file_name: str, file_stream: BinaryIO) -> tuple[str, Path]:
        job_id = uuid4().hex[:12]
        source_dir = self.job_dir(job_id) / "source"
        source_dir.mkdir(parents=True, exist_ok=True)
        safe_file_name = _sanitize_filename(file_name)
        file_path = source_dir / safe_file_name
        with file_path.open("wb") as handle:
            while chunk := file_stream.read(1024 * 1024):
                handle.write(chunk)
        relative_path = str(file_path.relative_to(self.settings.storage_dir))
        return relative_path, file_path

    def reserve_upload_path(self, file_name: str) -> tuple[str, Path, str]:
        job_id = uuid4().hex[:12]
        source_dir = self.job_dir(job_id) / "source"
        source_dir.mkdir(parents=True, exist_ok=True)
        safe_file_name = _sanitize_filename(file_name)
        file_path = source_dir / safe_file_name
        relative_path = str(file_path.relative_to(self.settings.storage_dir))
        return job_id, file_path, relative_path

    def create_manifest_for_job(
        self,
        *,
        job_id: str,
        file_name: str,
        content_type: str,
        size_bytes: int,
        relative_path: str,
    ) -> JobManifest:
        now = _utc_now()
        manifest = JobManifest(
            job_id=job_id,
            status=JobStatus.QUEUED,
            progress_phase=ProgressPhase.QUEUED,
            created_at=now,
            updated_at=now,
            source_video=SourceVideoRecord(
                id=job_id,
                file_name=file_name,
                content_type=content_type,
                size_bytes=size_bytes,
                relative_path=relative_path,
            ),
        )
        (self.job_dir(job_id) / "artifacts").mkdir(parents=True, exist_ok=True)
        self.save_job(manifest)
        return manifest

    def update_job(self, job_id: str, **changes: object) -> JobManifest:
        job = self.load_job(job_id)
        updated = job.model_copy(update={**changes, "updated_at": _utc_now()})
        return self.save_job(updated)

    def job_dir(self, job_id: str) -> Path:
        return self.settings.jobs_dir / job_id

    def manifest_path(self, job_id: str) -> Path:
        return self.job_dir(job_id) / "job.json"

    def resolve_storage_path(self, relative_path: str) -> Path:
        return self.settings.storage_dir / relative_path

    def source_video_path(self, job: JobManifest) -> Path:
        return self.resolve_storage_path(job.source_video.relative_path)

    def audio_path(self, job_id: str) -> Path:
        return self.job_dir(job_id) / "artifacts" / "audio.wav"


def _utc_now() -> str:
    return datetime.now(tz=UTC).isoformat()


def _sanitize_filename(file_name: str) -> str:
    path = Path(file_name)
    stem = path.stem.lower().replace(" ", "-")
    allowed = [character for character in stem if character.isalnum() or character in {"-", "_"}]
    suffix = path.suffix.lower()
    normalized_stem = "".join(allowed).strip("-_") or "upload"
    return f"{normalized_stem}{suffix}"
