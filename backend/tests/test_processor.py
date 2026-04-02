from __future__ import annotations

import asyncio
from pathlib import Path

from clipmine_api.artifact_store import LocalArtifactStore
from clipmine_api.config import Settings
from clipmine_api.processor import JobProcessor
from clipmine_api.schemas import JobStatus, ProgressPhase
from clipmine_api.storage import JobStore


def test_job_processor_recovers_incomplete_jobs_on_start(tmp_path: Path) -> None:
    settings = Settings(storage_dir=tmp_path / "storage", model_cache_dir=tmp_path / "models")
    store = JobStore(settings)

    queued_job = store.create_manifest_for_job(
        job_id="queued-job",
        file_name="queued.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/queued-job/source/queued.mp4",
    )
    processing_job = store.create_manifest_for_job(
        job_id="processing-job",
        file_name="processing.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/processing-job/source/processing.mp4",
    )
    ready_job = store.create_manifest_for_job(
        job_id="ready-job",
        file_name="ready.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/ready-job/source/ready.mp4",
    )
    failed_job = store.create_manifest_for_job(
        job_id="failed-job",
        file_name="failed.mp4",
        content_type="video/mp4",
        size_bytes=10,
        relative_path="jobs/failed-job/source/failed.mp4",
    )

    store.save_job(
        processing_job.model_copy(
            update={
                "status": JobStatus.PROCESSING,
                "progress_phase": ProgressPhase.TRANSCRIBING,
                "error": "stalled mid-run",
            }
        )
    )
    store.save_job(ready_job.model_copy(update={"status": JobStatus.READY, "progress_phase": ProgressPhase.READY}))
    store.save_job(failed_job.model_copy(update={"status": JobStatus.FAILED, "progress_phase": ProgressPhase.FAILED}))

    processed_job_ids: list[str] = []
    processor = JobProcessor(store, LocalArtifactStore(settings))
    original_process_job = processor.process_job

    def fake_process_job(job_id: str) -> None:
        processed_job_ids.append(job_id)

    processor.process_job = fake_process_job  # type: ignore[method-assign]

    async def run_processor() -> None:
        await processor.start()
        await asyncio.wait_for(processor.queue.join(), timeout=1)
        await processor.stop()

    try:
        asyncio.run(run_processor())
    finally:
        processor.process_job = original_process_job  # type: ignore[method-assign]

    assert processed_job_ids == ["queued-job", "processing-job"]
    assert store.load_job("queued-job").status == JobStatus.QUEUED
    assert store.load_job("queued-job").progress_phase == ProgressPhase.QUEUED
    assert store.load_job("processing-job").status == JobStatus.QUEUED
    assert store.load_job("processing-job").progress_phase == ProgressPhase.QUEUED
    assert store.load_job("processing-job").error is None
    assert store.load_job("ready-job").status == JobStatus.READY
    assert store.load_job("failed-job").status == JobStatus.FAILED


def test_job_processor_defaults_to_single_worker(tmp_path: Path) -> None:
    settings = Settings(storage_dir=tmp_path / "storage", model_cache_dir=tmp_path / "models")
    store = JobStore(settings)

    processor = JobProcessor(store, LocalArtifactStore(settings), worker_concurrency=0)

    assert processor.worker_concurrency == 1


def test_job_processor_marks_corrupted_video_as_failed_with_clear_error(tmp_path: Path) -> None:
    settings = Settings(storage_dir=tmp_path / "storage", model_cache_dir=tmp_path / "models")
    store = JobStore(settings)
    processor = JobProcessor(store, LocalArtifactStore(settings))

    manifest = store.create_manifest_for_job(
        job_id="corrupt-job",
        file_name="corrupt.mp4",
        content_type="video/mp4",
        size_bytes=24,
        relative_path="jobs/corrupt-job/source/corrupt.mp4",
    )
    source_path = store.source_video_path(manifest)
    source_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_bytes(b"this-is-not-a-real-mp4")

    processor.process_job("corrupt-job")

    failed_job = store.load_job("corrupt-job")
    assert failed_job.status == JobStatus.FAILED
    assert failed_job.progress_phase == ProgressPhase.FAILED
    assert (
        failed_job.error
        == "Source video could not be decoded. Try another MP4 or MOV file with a readable audio track."
    )
