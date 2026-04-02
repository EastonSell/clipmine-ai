from __future__ import annotations

from datetime import UTC, datetime, timedelta

import orjson

from clipmine_api.config import Settings
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
