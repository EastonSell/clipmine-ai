from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from clipmine_api.main import app


def test_create_job_accepts_valid_video_upload(tmp_path: Path) -> None:
    with TestClient(app) as client:
        original_storage = client.app.state.settings.storage_dir
        original_model_cache = client.app.state.settings.model_cache_dir
        client.app.state.settings.storage_dir = tmp_path / "storage"
        client.app.state.settings.model_cache_dir = tmp_path / "models"

        async def noop_enqueue(job_id: str) -> None:
            return None

        client.app.state.job_processor.enqueue = noop_enqueue

        response = client.post(
            "/api/jobs",
            files={"file": ("sample.mp4", b"fake video bytes", "video/mp4")},
        )

        client.app.state.settings.storage_dir = original_storage
        client.app.state.settings.model_cache_dir = original_model_cache

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
