from __future__ import annotations

import math
import shutil
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import BinaryIO, Callable
from uuid import uuid4

import orjson

from .config import Settings
from .schemas import JobManifest, JobStatus, ProgressPhase, SourceVideoRecord, UploadSessionRecord


class JobStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.storage_dir.mkdir(parents=True, exist_ok=True)
        self.settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
        self.settings.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.settings.upload_sessions_dir.mkdir(parents=True, exist_ok=True)

    def create_job(
        self,
        *,
        file_name: str,
        content_type: str,
        size_bytes: int,
        relative_path: str,
        storage_backend: str = "local",
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
                storage_backend=storage_backend,
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
        storage_backend: str = "local",
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
                storage_backend=storage_backend,
            ),
        )
        (self.job_dir(job_id) / "artifacts").mkdir(parents=True, exist_ok=True)
        self.save_job(manifest)
        return manifest

    def discard_reserved_job(self, job_id: str) -> None:
        shutil.rmtree(self.job_dir(job_id), ignore_errors=True)

    def build_upload_session(
        self,
        *,
        file_name: str,
        content_type: str,
        size_bytes: int,
        part_size_bytes: int,
        ttl_minutes: int,
    ) -> UploadSessionRecord:
        now = datetime.now(tz=UTC)
        session_id = uuid4().hex[:12]
        job_id = uuid4().hex[:12]
        safe_file_name = _sanitize_filename(file_name)
        total_parts = max(1, math.ceil(size_bytes / part_size_bytes))
        return UploadSessionRecord(
            session_id=session_id,
            job_id=job_id,
            file_name=file_name,
            content_type=content_type,
            size_bytes=size_bytes,
            relative_path=f"jobs/{job_id}/source/{safe_file_name}",
            part_size_bytes=part_size_bytes,
            total_parts=total_parts,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            expires_at=(now + timedelta(minutes=ttl_minutes)).isoformat(),
        )

    def save_upload_session(self, session: UploadSessionRecord) -> UploadSessionRecord:
        stamped_session = session.model_copy(update={"updated_at": _utc_now()})
        payload = stamped_session.model_dump(mode="json")
        path = self.upload_session_path(stamped_session.session_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(orjson.dumps(payload, option=orjson.OPT_INDENT_2))
        return stamped_session

    def load_upload_session(self, session_id: str) -> UploadSessionRecord:
        path = self.upload_session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(session_id)
        return UploadSessionRecord.model_validate(orjson.loads(path.read_bytes()))

    def list_upload_sessions(self) -> list[UploadSessionRecord]:
        sessions: list[UploadSessionRecord] = []
        for session_path in sorted(self.settings.upload_sessions_dir.glob("*.json")):
            sessions.append(UploadSessionRecord.model_validate(orjson.loads(session_path.read_bytes())))
        return sessions

    def delete_upload_session(self, session_id: str) -> None:
        self.upload_session_path(session_id).unlink(missing_ok=True)

    def cleanup_expired_upload_sessions(
        self,
        abort_upload: Callable[[UploadSessionRecord], None] | None = None,
    ) -> int:
        removed_count = 0
        now = datetime.now(tz=UTC)
        for session in self.list_upload_sessions():
            if datetime.fromisoformat(session.expires_at) > now:
                continue
            if abort_upload:
                abort_upload(session)
            self.delete_upload_session(session.session_id)
            removed_count += 1
        return removed_count

    def list_jobs(self) -> list[JobManifest]:
        jobs: list[JobManifest] = []
        jobs_dir = self.settings.jobs_dir
        for job_dir in sorted(jobs_dir.iterdir()) if jobs_dir.exists() else []:
            manifest_path = job_dir / "job.json"
            if not manifest_path.exists():
                continue
            jobs.append(JobManifest.model_validate(orjson.loads(manifest_path.read_bytes())))
        return sorted(jobs, key=lambda job: job.created_at)

    def update_job(self, job_id: str, **changes: object) -> JobManifest:
        job = self.load_job(job_id)
        updated = job.model_copy(update={**changes, "updated_at": _utc_now()})
        return self.save_job(updated)

    def cleanup_expired_jobs(self, retention_hours: int) -> int:
        if retention_hours <= 0:
            return 0

        removed_count = 0
        cutoff = datetime.now(tz=UTC).timestamp() - (retention_hours * 3600)

        for job_dir in sorted(self.settings.jobs_dir.iterdir()) if self.settings.jobs_dir.exists() else []:
            manifest_path = job_dir / "job.json"
            if manifest_path.exists():
                payload = orjson.loads(manifest_path.read_bytes())
                updated_at = payload.get("updated_at") or payload.get("created_at")
                if not updated_at:
                    continue
                updated_timestamp = datetime.fromisoformat(updated_at).timestamp()
            else:
                updated_timestamp = job_dir.stat().st_mtime

            if updated_timestamp >= cutoff:
                continue

            shutil.rmtree(job_dir, ignore_errors=True)
            removed_count += 1

        return removed_count

    def cleanup_ephemeral_artifacts(self, retention_hours: int) -> int:
        if retention_hours <= 0:
            return 0

        removed_count = 0
        cutoff = datetime.now(tz=UTC).timestamp() - (retention_hours * 3600)

        for job in self.list_jobs():
            if job.status not in {JobStatus.READY, JobStatus.FAILED}:
                continue
            updated_timestamp = datetime.fromisoformat(job.updated_at).timestamp()
            if updated_timestamp >= cutoff:
                continue
            processing_path = self.processing_video_path(job)
            if processing_path.exists():
                processing_path.unlink(missing_ok=True)
                removed_count += 1
            audio_path = self.audio_path(job.job_id)
            if audio_path.exists():
                audio_path.unlink(missing_ok=True)
                removed_count += 1

        return removed_count

    def is_storage_writable(self) -> bool:
        self.settings.storage_dir.mkdir(parents=True, exist_ok=True)
        try:
            with tempfile.NamedTemporaryFile(dir=self.settings.storage_dir, delete=True):
                return True
        except OSError:
            return False

    def is_temp_disk_writable(self) -> bool:
        self.settings.jobs_dir.mkdir(parents=True, exist_ok=True)
        try:
            with tempfile.NamedTemporaryFile(dir=self.settings.jobs_dir, delete=True):
                return True
        except OSError:
            return False

    def job_dir(self, job_id: str) -> Path:
        return self.settings.jobs_dir / job_id

    def manifest_path(self, job_id: str) -> Path:
        return self.job_dir(job_id) / "job.json"

    def upload_session_path(self, session_id: str) -> Path:
        return self.settings.upload_sessions_dir / f"{session_id}.json"

    def resolve_storage_path(self, relative_path: str) -> Path:
        return self.settings.storage_dir / relative_path

    def source_video_path(self, job: JobManifest) -> Path:
        return self.resolve_storage_path(job.source_video.relative_path)

    def processing_video_path(self, job: JobManifest) -> Path:
        if job.source_video.storage_backend == "local":
            return self.source_video_path(job)
        suffix = Path(job.source_video.file_name).suffix.lower() or ".mp4"
        return self.job_dir(job.job_id) / "artifacts" / f"source-cache{suffix}"

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
