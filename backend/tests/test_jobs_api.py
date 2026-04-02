from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from clipmine_api.main import app
from clipmine_api.schemas import JobStatus, ProgressPhase


def test_create_job_accepts_valid_video_upload(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        original_enqueue = client.app.state.job_processor.enqueue

        async def noop_enqueue(job_id: str) -> None:
            return None

        client.app.state.job_processor.enqueue = noop_enqueue

        try:
            response = client.post(
                "/api/jobs",
                files={"file": ("sample.mp4", b"fake video bytes", "video/mp4")},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            client.app.state.job_processor.enqueue = original_enqueue

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "queued"
    assert payload["fileName"] == "sample.mp4"
    assert (tmp_path / "storage" / "jobs").exists()


def test_create_job_rejects_invalid_file_type() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/jobs",
            files={"file": ("sample.txt", b"not video", "text/plain")},
        )

    assert response.status_code == 415


def test_create_job_accepts_generic_content_type_for_valid_extension(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        original_enqueue = client.app.state.job_processor.enqueue

        async def noop_enqueue(job_id: str) -> None:
            return None

        client.app.state.job_processor.enqueue = noop_enqueue

        try:
            response = client.post(
                "/api/jobs",
                files={"file": ("sample.mov", b"fake video bytes", "application/octet-stream")},
            )
            payload = response.json()
            stored_job = client.app.state.job_store.load_job(payload["jobId"])
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            client.app.state.job_processor.enqueue = original_enqueue

    assert response.status_code == 201
    assert stored_job.source_video.content_type == "video/quicktime"


def test_create_job_rejects_oversize_upload_and_removes_reserved_job_dir(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_max_upload_mb = settings.max_upload_mb
        original_enqueue = client.app.state.job_processor.enqueue
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.max_upload_mb = 1

        async def noop_enqueue(job_id: str) -> None:
            return None

        client.app.state.job_processor.enqueue = noop_enqueue

        try:
            response = client.post(
                "/api/jobs",
                files={"file": ("sample.mp4", b"x" * (settings.max_upload_bytes + 1), "video/mp4")},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.max_upload_mb = original_max_upload_mb
            client.app.state.job_processor.enqueue = original_enqueue

    assert response.status_code == 413
    assert list((tmp_path / "storage" / "jobs").glob("*")) == []


def test_export_returns_conflict_while_job_is_incomplete(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="pending-job",
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=42,
                relative_path="jobs/pending-job/source/sample.mp4",
            )
            client.app.state.job_store.save_job(
                manifest.model_copy(
                    update={
                        "status": JobStatus.PROCESSING,
                        "progress_phase": ProgressPhase.TRANSCRIBING,
                    }
                )
            )
            response = client.get("/api/jobs/pending-job/export.json")
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 409
