from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from clipmine_api.schemas import SourceVideoRecord, UploadSessionRecord
from clipmine_api.main import app
from clipmine_api.schemas import JobStatus, ProgressPhase


class FakeMultipartArtifactStore:
    backend_name = "s3"
    supports_multipart_uploads = True

    def __init__(self, *, reachable: bool = True):
        self.reachable = reachable
        self.created_sources: list[SourceVideoRecord] = []
        self.completed_uploads: list[dict[str, object]] = []
        self.aborted_sessions: list[str] = []

    def is_reachable(self) -> bool:
        return self.reachable

    def create_multipart_upload(self, source: SourceVideoRecord) -> str:
        self.created_sources.append(source)
        return "upload-123"

    def get_presigned_part_url(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        part_number: int,
        expires_in_seconds: int,
    ) -> str:
        return f"https://uploads.example/{upload_id}/part/{part_number}"

    def complete_multipart_upload(
        self,
        source: SourceVideoRecord,
        *,
        upload_id: str,
        parts: list[dict[str, object]],
    ) -> None:
        self.completed_uploads.append({"source": source, "upload_id": upload_id, "parts": parts})

    def abort_multipart_upload(self, session: UploadSessionRecord) -> None:
        self.aborted_sessions.append(session.session_id)


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
    payload = response.json()
    assert payload["detail"]["code"] == "unsupported_file_type"
    assert payload["detail"]["retryable"] is False


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


def test_create_job_accepts_upload_at_exact_size_limit(tmp_path: Path) -> None:
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
                files={"file": ("limit.mp4", b"x" * settings.max_upload_bytes, "video/mp4")},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.max_upload_mb = original_max_upload_mb
            client.app.state.job_processor.enqueue = original_enqueue

    assert response.status_code == 201
    assert response.json()["fileName"] == "limit.mp4"


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


def test_initialize_multipart_upload_returns_session_and_parts(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_storage_backend = settings.storage_backend
        original_artifact_store = client.app.state.artifact_store
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.storage_backend = "s3"
        client.app.state.artifact_store = FakeMultipartArtifactStore()

        try:
            response = client.post(
                "/api/uploads/init",
                json={
                    "fileName": "sample.mp4",
                    "contentType": "video/mp4",
                    "sizeBytes": (16 * 1024 * 1024) + 512,
                },
            )
            payload = response.json()
            saved_session = client.app.state.job_store.load_upload_session(payload["uploadSessionId"])
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.storage_backend = original_storage_backend
            client.app.state.artifact_store = original_artifact_store

    assert response.status_code == 201
    assert payload["jobId"] == saved_session.job_id
    assert payload["partSizeBytes"] == 16 * 1024 * 1024
    assert len(payload["parts"]) == 2
    assert payload["parts"][0]["url"].startswith("https://uploads.example/upload-123/part/1")
    assert saved_session.upload_id == "upload-123"


def test_initialize_multipart_upload_scales_part_count_for_large_sources(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_storage_backend = settings.storage_backend
        original_artifact_store = client.app.state.artifact_store
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.storage_backend = "s3"
        client.app.state.artifact_store = FakeMultipartArtifactStore()

        try:
            response = client.post(
                "/api/uploads/init",
                json={
                    "fileName": "large.mp4",
                    "contentType": "video/mp4",
                    "sizeBytes": (16 * 1024 * 1024 * 4) + (3 * 1024 * 1024),
                },
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.storage_backend = original_storage_backend
            client.app.state.artifact_store = original_artifact_store

    assert response.status_code == 201
    payload = response.json()
    assert payload["partSizeBytes"] == 16 * 1024 * 1024
    assert len(payload["parts"]) == 5


def test_complete_multipart_upload_writes_manifest_and_enqueues_job(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_storage_backend = settings.storage_backend
        original_artifact_store = client.app.state.artifact_store
        original_enqueue = client.app.state.job_processor.enqueue
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.storage_backend = "s3"
        artifact_store = FakeMultipartArtifactStore()
        client.app.state.artifact_store = artifact_store
        enqueued_job_ids: list[str] = []

        async def fake_enqueue(job_id: str) -> None:
            enqueued_job_ids.append(job_id)

        client.app.state.job_processor.enqueue = fake_enqueue

        try:
            store = client.app.state.job_store
            session = client.app.state.job_store.build_upload_session(
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=1024,
                part_size_bytes=settings.upload_part_size_bytes,
                ttl_minutes=settings.upload_session_ttl_minutes,
            )
            session = store.save_upload_session(session.model_copy(update={"upload_id": "upload-123"}))
            session_path = store.upload_session_path(session.session_id)
            response = client.post(
                f"/api/uploads/{session.session_id}/complete",
                json={"parts": [{"partNumber": 1, "etag": '"etag-1"'}]},
            )
            payload = response.json()
            saved_job = store.load_job(session.job_id)
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.storage_backend = original_storage_backend
            client.app.state.artifact_store = original_artifact_store
            client.app.state.job_processor.enqueue = original_enqueue

    assert response.status_code == 200
    assert payload == {"jobId": session.job_id, "status": "queued", "fileName": "sample.mp4"}
    assert enqueued_job_ids == [session.job_id]
    assert saved_job.source_video.storage_backend == "s3"
    assert session_path.exists() is False
    assert artifact_store.completed_uploads[0]["upload_id"] == "upload-123"


def test_abort_multipart_upload_removes_session(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_storage_backend = settings.storage_backend
        original_artifact_store = client.app.state.artifact_store
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.storage_backend = "s3"
        artifact_store = FakeMultipartArtifactStore()
        client.app.state.artifact_store = artifact_store

        try:
            store = client.app.state.job_store
            session = store.build_upload_session(
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=1024,
                part_size_bytes=settings.upload_part_size_bytes,
                ttl_minutes=settings.upload_session_ttl_minutes,
            )
            session = store.save_upload_session(session.model_copy(update={"upload_id": "upload-123"}))
            session_path = store.upload_session_path(session.session_id)
            response = client.delete(f"/api/uploads/{session.session_id}")
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.storage_backend = original_storage_backend
            client.app.state.artifact_store = original_artifact_store

    assert response.status_code == 204
    assert artifact_store.aborted_sessions == [session.session_id]
    assert not session_path.exists()
