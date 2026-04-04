from __future__ import annotations

import base64
import subprocess
import zipfile
from io import BytesIO
from pathlib import Path

import imageio_ffmpeg
import orjson
from fastapi.testclient import TestClient

from clipmine_api.api import BATCH_EXPORT_WARNING_SUMMARY_HEADER
from clipmine_api.main import app
from clipmine_api.presentation import build_summary, build_timeline
from clipmine_api.schemas import ClipRecord, JobStatus, PlaybackMetadata, ProgressPhase


class FakeRemoteArtifactStore:
    backend_name = "s3"
    supports_multipart_uploads = True

    def __init__(self, source_fixture_path: Path):
        self.source_fixture_path = source_fixture_path
        self.downloaded_sources: list[str] = []

    def is_reachable(self) -> bool:
        return True

    def download_source_video(self, source, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self.source_fixture_path.read_bytes())
        self.downloaded_sources.append(source.relative_path)


def test_package_export_returns_zip_with_manifest_and_clip_files(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            job_id = "package-job"
            clip_one = build_clip_record(job_id=job_id, clip_id="package-job-clip-001", start=0.0, end=0.9, score=94.0)
            clip_two = build_clip_record(job_id=job_id, clip_id="package-job-clip-002", start=1.0, end=1.8, score=87.0)
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id=job_id,
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/package-job/source/sample.mp4",
            )
            video_path = client.app.state.job_store.source_video_path(manifest)
            create_sample_video(video_path)
            ready_manifest = manifest.model_copy(
                update={
                    "status": JobStatus.READY,
                    "progress_phase": ProgressPhase.READY,
                    "clips": [clip_one, clip_two],
                    "summary": build_summary([clip_one, clip_two], duration_seconds=2.0, transcript_text="Example transcript"),
                    "timeline": build_timeline([clip_one, clip_two], duration_seconds=2.0),
                }
            )
            client.app.state.job_store.save_job(ready_manifest)

            response = client.post(
                f"/api/jobs/{job_id}/exports/package",
                json={"clipIds": [clip_two.id, clip_one.id]},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-export-package-job.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    assert "clipmine-export-package-job/manifest.json" in archive_names
    assert "clipmine-export-package-job/clips/clip_001__package-job-clip-001.mp4" in archive_names
    assert "clipmine-export-package-job/clips/clip_002__package-job-clip-002.mp4" in archive_names
    assert archive.getinfo("clipmine-export-package-job/clips/clip_001__package-job-clip-001.mp4").compress_type == zipfile.ZIP_STORED

    manifest_payload = orjson.loads(archive.read("clipmine-export-package-job/manifest.json"))
    assert manifest_payload["jobId"] == job_id
    assert manifest_payload["preset"] == "full-av"
    assert manifest_payload["mediaKind"] == "video"
    assert manifest_payload["includesMediaFiles"] is True
    assert manifest_payload["clipCount"] == 2
    assert manifest_payload["clips"][0]["clipId"] == clip_one.id
    assert manifest_payload["clips"][0]["relativePath"] == "clips/clip_001__package-job-clip-001.mp4"
    assert manifest_payload["clips"][1]["clipId"] == clip_two.id
    assert manifest_payload["clips"][1]["relativePath"] == "clips/clip_002__package-job-clip-002.mp4"


def test_package_export_supports_audio_only_preset(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            job_id = "package-job"
            clip = build_clip_record(job_id=job_id, clip_id="package-job-clip-001", start=0.0, end=1.1, score=94.0)
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id=job_id,
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/package-job/source/sample.mp4",
            )
            create_sample_video(client.app.state.job_store.source_video_path(manifest))
            client.app.state.job_store.save_job(
                manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [clip],
                        "summary": build_summary([clip], duration_seconds=2.0, transcript_text="Example transcript"),
                        "timeline": build_timeline([clip], duration_seconds=2.0),
                    }
                )
            )

            response = client.post(
                f"/api/jobs/{job_id}/exports/package",
                json={"clipIds": [clip.id], "preset": "audio-only"},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-export-package-job-audio.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    audio_path = "clipmine-export-package-job-audio/audio/clip_001__package-job-clip-001.wav"
    assert "clipmine-export-package-job-audio/manifest.json" in archive_names
    assert audio_path in archive_names

    audio_bytes = archive.read(audio_path)
    assert audio_bytes[:4] == b"RIFF"
    assert audio_bytes[8:12] == b"WAVE"

    manifest_payload = orjson.loads(archive.read("clipmine-export-package-job-audio/manifest.json"))
    assert manifest_payload["preset"] == "audio-only"
    assert manifest_payload["mediaKind"] == "audio"
    assert manifest_payload["includesMediaFiles"] is True
    assert manifest_payload["clips"][0]["fileName"] == "clip_001__package-job-clip-001.wav"
    assert manifest_payload["clips"][0]["relativePath"] == "audio/clip_001__package-job-clip-001.wav"


def test_package_export_supports_metadata_only_preset(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            job_id = "package-job"
            clip = build_clip_record(job_id=job_id, clip_id="package-job-clip-001", start=0.0, end=0.9, score=94.0)
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id=job_id,
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/package-job/source/sample.mp4",
            )
            client.app.state.job_store.save_job(
                manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [clip],
                        "summary": build_summary([clip], duration_seconds=1.0, transcript_text="Example transcript"),
                        "timeline": build_timeline([clip], duration_seconds=1.0),
                    }
                )
            )

            response = client.post(
                f"/api/jobs/{job_id}/exports/package",
                json={"clipIds": [clip.id], "preset": "metadata-only"},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-export-package-job-metadata.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    assert archive_names == {"clipmine-export-package-job-metadata/manifest.json"}

    manifest_payload = orjson.loads(archive.read("clipmine-export-package-job-metadata/manifest.json"))
    assert manifest_payload["preset"] == "metadata-only"
    assert manifest_payload["mediaKind"] == "metadata"
    assert manifest_payload["includesMediaFiles"] is False
    assert manifest_payload["clips"][0]["fileName"] is None
    assert manifest_payload["clips"][0]["relativePath"] is None


def test_package_export_downloads_remote_s3_source_before_trimming(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        original_storage_backend = settings.storage_backend
        original_artifact_store = client.app.state.artifact_store
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"
        settings.storage_backend = "s3"
        source_fixture_path = tmp_path / "remote-source.mp4"
        create_sample_video(source_fixture_path)
        artifact_store = FakeRemoteArtifactStore(source_fixture_path)
        client.app.state.artifact_store = artifact_store

        try:
            job_id = "remote-package-job"
            clip = build_clip_record(job_id=job_id, clip_id="remote-package-job-clip-001", start=0.0, end=1.1, score=94.0)
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id=job_id,
                file_name="remote.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/remote-package-job/source/remote.mp4",
                storage_backend="s3",
            )
            client.app.state.job_store.save_job(
                manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [clip],
                        "summary": build_summary([clip], duration_seconds=2.0, transcript_text="Remote transcript"),
                        "timeline": build_timeline([clip], duration_seconds=2.0),
                    }
                )
            )

            response = client.post(
                f"/api/jobs/{job_id}/exports/package",
                json={"clipIds": [clip.id]},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache
            settings.storage_backend = original_storage_backend
            client.app.state.artifact_store = original_artifact_store

    assert response.status_code == 200
    assert artifact_store.downloaded_sources == ["jobs/remote-package-job/source/remote.mp4"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    clip_path = "clipmine-export-remote-package-job/clips/clip_001__remote-package-job-clip-001.mp4"
    assert clip_path in archive_names
    assert len(archive.read(clip_path)) > 0


def test_package_export_rejects_empty_selection(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="package-job",
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/package-job/source/sample.mp4",
            )
            client.app.state.job_store.save_job(
                manifest.model_copy(update={"status": JobStatus.READY, "progress_phase": ProgressPhase.READY})
            )
            response = client.post("/api/jobs/package-job/exports/package", json={"clipIds": []})
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "export_selection_required"


def test_package_export_rejects_unknown_clip_ids(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            job_id = "package-job"
            clip = build_clip_record(job_id=job_id, clip_id="package-job-clip-001", start=0.0, end=0.9, score=94.0)
            manifest = client.app.state.job_store.create_manifest_for_job(
                job_id=job_id,
                file_name="sample.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/package-job/source/sample.mp4",
            )
            create_sample_video(client.app.state.job_store.source_video_path(manifest))
            client.app.state.job_store.save_job(
                manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [clip],
                        "summary": build_summary([clip], duration_seconds=1.0, transcript_text="Example transcript"),
                        "timeline": build_timeline([clip], duration_seconds=1.0),
                    }
                )
            )
            response = client.post(
                f"/api/jobs/{job_id}/exports/package",
                json={"clipIds": ["package-job-clip-999"]},
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_clip_selection"
    assert "package-job-clip-999" in response.json()["detail"]["message"]


def test_batch_package_export_returns_grouped_zip(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            alpha_clip = build_clip_record(job_id="job-alpha", clip_id="job-alpha-clip-001", start=0.0, end=0.9, score=93.0)
            beta_clip = build_clip_record(job_id="job-beta", clip_id="job-beta-clip-001", start=0.1, end=1.0, score=88.0)

            alpha_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-alpha",
                file_name="alpha.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-alpha/source/alpha.mp4",
            )
            beta_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-beta",
                file_name="beta.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-beta/source/beta.mp4",
            )
            create_sample_video(client.app.state.job_store.source_video_path(alpha_manifest))
            create_sample_video(client.app.state.job_store.source_video_path(beta_manifest))
            client.app.state.job_store.save_job(
                alpha_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [alpha_clip],
                        "summary": build_summary([alpha_clip], duration_seconds=1.0, transcript_text="Alpha transcript"),
                        "timeline": build_timeline([alpha_clip], duration_seconds=1.0),
                    }
                )
            )
            client.app.state.job_store.save_job(
                beta_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [beta_clip],
                        "summary": build_summary([beta_clip], duration_seconds=1.0, transcript_text="Beta transcript"),
                        "timeline": build_timeline([beta_clip], duration_seconds=1.0),
                    }
                )
            )

            response = client.post(
                "/api/exports/batch-package",
                json={
                    "batchLabel": "April Batch",
                    "qualityThreshold": 84,
                    "selections": [
                        {"jobId": "job-alpha", "clipIds": [alpha_clip.id]},
                        {"jobId": "job-beta", "clipIds": [beta_clip.id]},
                    ],
                },
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-batch-export-april-batch.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    assert "clipmine-batch-export-april-batch/manifest.json" in archive_names
    assert "clipmine-batch-export-april-batch/jobs/job-alpha/clips/clip_001__job-alpha-clip-001.mp4" in archive_names
    assert "clipmine-batch-export-april-batch/jobs/job-beta/clips/clip_001__job-beta-clip-001.mp4" in archive_names

    manifest_payload = orjson.loads(archive.read("clipmine-batch-export-april-batch/manifest.json"))
    assert manifest_payload["jobCount"] == 2
    assert manifest_payload["clipCount"] == 2
    assert manifest_payload["qualityThreshold"] == 84
    assert manifest_payload["jobs"][0]["clips"][0]["relativePath"] == "jobs/job-alpha/clips/clip_001__job-alpha-clip-001.mp4"
    assert manifest_payload["jobs"][1]["clips"][0]["relativePath"] == "jobs/job-beta/clips/clip_001__job-beta-clip-001.mp4"


def test_batch_package_export_keeps_successful_jobs_when_one_source_is_missing(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            alpha_clip = build_clip_record(job_id="job-alpha", clip_id="job-alpha-clip-001", start=0.0, end=0.9, score=93.0)
            beta_clip = build_clip_record(job_id="job-beta", clip_id="job-beta-clip-001", start=0.1, end=1.0, score=88.0)

            alpha_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-alpha",
                file_name="alpha.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-alpha/source/alpha.mp4",
            )
            beta_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-beta",
                file_name="beta.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-beta/source/beta.mp4",
            )
            create_sample_video(client.app.state.job_store.source_video_path(alpha_manifest))
            client.app.state.job_store.save_job(
                alpha_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [alpha_clip],
                        "summary": build_summary([alpha_clip], duration_seconds=1.0, transcript_text="Alpha transcript"),
                        "timeline": build_timeline([alpha_clip], duration_seconds=1.0),
                    }
                )
            )
            client.app.state.job_store.save_job(
                beta_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [beta_clip],
                        "summary": build_summary([beta_clip], duration_seconds=1.0, transcript_text="Beta transcript"),
                        "timeline": build_timeline([beta_clip], duration_seconds=1.0),
                    }
                )
            )

            response = client.post(
                "/api/exports/batch-package",
                json={
                    "batchLabel": "April Batch",
                    "selections": [
                        {"jobId": "job-alpha", "clipIds": [alpha_clip.id]},
                        {"jobId": "job-beta", "clipIds": [beta_clip.id]},
                    ],
                },
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    assert "clipmine-batch-export-april-batch/manifest.json" in archive_names
    assert "clipmine-batch-export-april-batch/jobs/job-alpha/clips/clip_001__job-alpha-clip-001.mp4" in archive_names
    assert "clipmine-batch-export-april-batch/jobs/job-beta/clips/clip_001__job-beta-clip-001.mp4" not in archive_names

    manifest_payload = orjson.loads(archive.read("clipmine-batch-export-april-batch/manifest.json"))
    assert manifest_payload["requestedJobCount"] == 2
    assert manifest_payload["jobCount"] == 1
    assert manifest_payload["clipCount"] == 1
    assert manifest_payload["failedJobCount"] == 1
    assert manifest_payload["warningCount"] == 1
    assert manifest_payload["jobs"][0]["jobId"] == "job-alpha"
    assert manifest_payload["warnings"] == [
        {
            "code": "job_export_failed",
            "jobId": "job-beta",
            "fileName": "beta.mp4",
            "message": "This job was skipped because its media could not be packaged.",
            "detail": "Source video not found for job job-beta.",
        }
    ]

    encoded_warning_summary = response.headers[BATCH_EXPORT_WARNING_SUMMARY_HEADER]
    decoded_warning_summary = orjson.loads(base64.urlsafe_b64decode(f"{encoded_warning_summary}==="))
    assert decoded_warning_summary == {
        "preset": "full-av",
        "qualityThreshold": None,
        "requestedJobCount": 2,
        "exportedJobCount": 1,
        "failedJobCount": 1,
        "warnings": manifest_payload["warnings"],
    }


def test_batch_package_export_supports_audio_only_preset(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            alpha_clip = build_clip_record(job_id="job-alpha", clip_id="job-alpha-clip-001", start=0.0, end=1.1, score=93.0)
            beta_clip = build_clip_record(job_id="job-beta", clip_id="job-beta-clip-001", start=0.1, end=1.0, score=88.0)

            alpha_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-alpha",
                file_name="alpha.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-alpha/source/alpha.mp4",
            )
            beta_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-beta",
                file_name="beta.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-beta/source/beta.mp4",
            )
            create_sample_video(client.app.state.job_store.source_video_path(alpha_manifest))
            create_sample_video(client.app.state.job_store.source_video_path(beta_manifest))
            client.app.state.job_store.save_job(
                alpha_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [alpha_clip],
                        "summary": build_summary([alpha_clip], duration_seconds=2.0, transcript_text="Alpha transcript"),
                        "timeline": build_timeline([alpha_clip], duration_seconds=2.0),
                    }
                )
            )
            client.app.state.job_store.save_job(
                beta_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [beta_clip],
                        "summary": build_summary([beta_clip], duration_seconds=2.0, transcript_text="Beta transcript"),
                        "timeline": build_timeline([beta_clip], duration_seconds=2.0),
                    }
                )
            )

            response = client.post(
                "/api/exports/batch-package",
                json={
                    "batchLabel": "April Batch",
                    "preset": "audio-only",
                    "selections": [
                        {"jobId": "job-alpha", "clipIds": [alpha_clip.id]},
                        {"jobId": "job-beta", "clipIds": [beta_clip.id]},
                    ],
                },
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-batch-export-april-batch-audio.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    alpha_audio_path = "clipmine-batch-export-april-batch-audio/jobs/job-alpha/audio/clip_001__job-alpha-clip-001.wav"
    beta_audio_path = "clipmine-batch-export-april-batch-audio/jobs/job-beta/audio/clip_001__job-beta-clip-001.wav"
    assert "clipmine-batch-export-april-batch-audio/manifest.json" in archive_names
    assert alpha_audio_path in archive_names
    assert beta_audio_path in archive_names
    assert archive.read(alpha_audio_path)[:4] == b"RIFF"
    assert archive.read(beta_audio_path)[:4] == b"RIFF"

    manifest_payload = orjson.loads(archive.read("clipmine-batch-export-april-batch-audio/manifest.json"))
    assert manifest_payload["preset"] == "audio-only"
    assert manifest_payload["mediaKind"] == "audio"
    assert manifest_payload["includesMediaFiles"] is True
    assert manifest_payload["jobs"][0]["clips"][0]["relativePath"] == "jobs/job-alpha/audio/clip_001__job-alpha-clip-001.wav"
    assert manifest_payload["jobs"][1]["clips"][0]["relativePath"] == "jobs/job-beta/audio/clip_001__job-beta-clip-001.wav"


def test_batch_package_export_supports_metadata_only_preset(tmp_path: Path) -> None:
    with TestClient(app) as client:
        settings = client.app.state.settings
        original_storage = settings.storage_dir
        original_model_cache = settings.model_cache_dir
        settings.storage_dir = tmp_path / "storage"
        settings.model_cache_dir = tmp_path / "models"

        try:
            alpha_clip = build_clip_record(job_id="job-alpha", clip_id="job-alpha-clip-001", start=0.0, end=0.9, score=93.0)
            beta_clip = build_clip_record(job_id="job-beta", clip_id="job-beta-clip-001", start=0.1, end=1.0, score=88.0)

            alpha_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-alpha",
                file_name="alpha.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-alpha/source/alpha.mp4",
            )
            beta_manifest = client.app.state.job_store.create_manifest_for_job(
                job_id="job-beta",
                file_name="beta.mp4",
                content_type="video/mp4",
                size_bytes=2048,
                relative_path="jobs/job-beta/source/beta.mp4",
            )
            client.app.state.job_store.save_job(
                alpha_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [alpha_clip],
                        "summary": build_summary([alpha_clip], duration_seconds=1.0, transcript_text="Alpha transcript"),
                        "timeline": build_timeline([alpha_clip], duration_seconds=1.0),
                    }
                )
            )
            client.app.state.job_store.save_job(
                beta_manifest.model_copy(
                    update={
                        "status": JobStatus.READY,
                        "progress_phase": ProgressPhase.READY,
                        "clips": [beta_clip],
                        "summary": build_summary([beta_clip], duration_seconds=1.0, transcript_text="Beta transcript"),
                        "timeline": build_timeline([beta_clip], duration_seconds=1.0),
                    }
                )
            )

            response = client.post(
                "/api/exports/batch-package",
                json={
                    "batchLabel": "April Batch",
                    "preset": "metadata-only",
                    "selections": [
                        {"jobId": "job-alpha", "clipIds": [alpha_clip.id]},
                        {"jobId": "job-beta", "clipIds": [beta_clip.id]},
                    ],
                },
            )
        finally:
            settings.storage_dir = original_storage
            settings.model_cache_dir = original_model_cache

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="clipmine-batch-export-april-batch-metadata.zip"' in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    archive_names = set(archive.namelist())
    assert archive_names == {"clipmine-batch-export-april-batch-metadata/manifest.json"}

    manifest_payload = orjson.loads(archive.read("clipmine-batch-export-april-batch-metadata/manifest.json"))
    assert manifest_payload["preset"] == "metadata-only"
    assert manifest_payload["mediaKind"] == "metadata"
    assert manifest_payload["includesMediaFiles"] is False
    assert manifest_payload["jobs"][0]["clips"][0]["fileName"] is None
    assert manifest_payload["jobs"][0]["clips"][0]["relativePath"] is None
    assert manifest_payload["jobs"][1]["clips"][0]["fileName"] is None
    assert manifest_payload["jobs"][1]["clips"][0]["relativePath"] is None


def build_clip_record(*, job_id: str, clip_id: str, start: float, end: float, score: float) -> ClipRecord:
    return ClipRecord(
        id=clip_id,
        text=f"Clip {clip_id}",
        start=start,
        end=end,
        duration=round(end - start, 3),
        confidence=0.94,
        speech_rate=2.7,
        energy=0.82,
        silence_ratio=0.08,
        instability=0.1,
        score=score,
        quality_label="Excellent",
        explanation="Strong example clip.",
        source_video_id=job_id,
        playback=PlaybackMetadata(url=f"/api/jobs/{job_id}/video", start=start, end=end),
        selection_recommendation="shortlist",
        tags=["training-ready"],
    )


def create_sample_video(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=320x240:rate=24:duration=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=880:sample_rate=48000:duration=2",
        "-shortest",
        "-pix_fmt",
        "yuv420p",
        str(path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "Failed to create sample video")
