from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import orjson

from clipmine_api.config import Settings
from clipmine_api.schemas import UploadSessionRecord
from clipmine_api.storage import JobStore


def test_cleanup_expired_jobs_removes_old_job_dirs(tmp_path) -> None:
    settings = Settings(storage_dir=tmp_path / "storage", model_cache_dir=tmp_path / "models")
    store = JobStore(settings)

    expired_job = store.create_manifest_for_job(
        job_id="expired-job",
        file_name="expired.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/expired-job/source/expired.mp4",
    )
    fresh_job = store.create_manifest_for_job(
        job_id="fresh-job",
        file_name="fresh.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/fresh-job/source/fresh.mp4",
    )

    old_timestamp = (datetime.now(tz=UTC) - timedelta(hours=200)).isoformat()
    store.manifest_path("expired-job").write_bytes(
        orjson.dumps(
            expired_job.model_copy(update={"created_at": old_timestamp, "updated_at": old_timestamp}).model_dump(
                mode="json"
            ),
            option=orjson.OPT_INDENT_2,
        )
    )
    store.save_job(fresh_job)

    removed_count = store.cleanup_expired_jobs(retention_hours=168)

    assert removed_count == 1
    assert not store.job_dir("expired-job").exists()
    assert store.job_dir("fresh-job").exists()


def test_cleanup_expired_upload_sessions_aborts_and_removes_stale_sessions(tmp_path: Path) -> None:
    settings = Settings(storage_dir=tmp_path / "storage", model_cache_dir=tmp_path / "models")
    store = JobStore(settings)

    expired_at = (datetime.now(tz=UTC) - timedelta(minutes=5)).isoformat()
    fresh_at = (datetime.now(tz=UTC) + timedelta(minutes=5)).isoformat()
    expired_session = UploadSessionRecord(
        session_id="expired-session",
        job_id="expired-job",
        file_name="expired.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/expired-job/source/expired.mp4",
        upload_id="upload-expired",
        part_size_bytes=16 * 1024 * 1024,
        total_parts=1,
        created_at=expired_at,
        updated_at=expired_at,
        expires_at=expired_at,
    )
    fresh_session = UploadSessionRecord(
        session_id="fresh-session",
        job_id="fresh-job",
        file_name="fresh.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/fresh-job/source/fresh.mp4",
        upload_id="upload-fresh",
        part_size_bytes=16 * 1024 * 1024,
        total_parts=1,
        created_at=fresh_at,
        updated_at=fresh_at,
        expires_at=fresh_at,
    )
    store.save_upload_session(expired_session)
    store.save_upload_session(fresh_session)

    aborted: list[str] = []

    removed_count = store.cleanup_expired_upload_sessions(lambda session: aborted.append(session.session_id))

    assert removed_count == 1
    assert aborted == ["expired-session"]
    assert not store.upload_session_path("expired-session").exists()
    assert store.upload_session_path("fresh-session").exists()
