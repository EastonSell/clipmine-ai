from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from .media import extract_audio, load_mono_wave, probe_media_duration
from .presentation import build_summary, build_timeline
from .schemas import JobManifest, JobStatus, ProgressPhase
from .scoring import score_candidate_clips
from .segmentation import segment_words
from .storage import JobStore
from .transcription import transcribe_audio

logger = logging.getLogger(__name__)


class JobProcessor:
    def __init__(self, store: JobStore):
        self.store = store
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.worker_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self.worker_task is None:
            self.worker_task = asyncio.create_task(self._worker_loop())
            await self._recover_incomplete_jobs()

    async def stop(self) -> None:
        if self.worker_task is None:
            return
        self.worker_task.cancel()
        with suppress(asyncio.CancelledError):
            await self.worker_task
        self.worker_task = None

    async def enqueue(self, job_id: str) -> None:
        await self.queue.put(job_id)

    async def _recover_incomplete_jobs(self) -> None:
        for job in self.store.list_jobs():
            if job.status not in {JobStatus.QUEUED, JobStatus.PROCESSING}:
                continue

            recovered_job = self.store.save_job(
                job.model_copy(
                    update={
                        "status": JobStatus.QUEUED,
                        "progress_phase": ProgressPhase.QUEUED,
                        "error": None,
                    }
                )
            )
            await self.queue.put(recovered_job.job_id)

    async def _worker_loop(self) -> None:
        while True:
            job_id = await self.queue.get()
            try:
                await asyncio.to_thread(self.process_job, job_id)
            except Exception:
                logger.exception("Worker failure for job %s", job_id)
            finally:
                self.queue.task_done()

    def process_job(self, job_id: str) -> None:
        job = self.store.load_job(job_id)
        video_path = self.store.source_video_path(job)
        audio_path = self.store.audio_path(job_id)

        try:
            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.EXTRACTING_AUDIO)
            extract_audio(video_path, audio_path)
            duration_seconds = probe_media_duration(video_path)
            job = self.store.save_job(
                job.model_copy(
                    update={
                        "source_video": job.source_video.model_copy(update={"duration_seconds": duration_seconds}),
                    }
                )
            )

            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.TRANSCRIBING)
            transcription = transcribe_audio(audio_path)

            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.SEGMENTING)
            candidates = segment_words(transcription.words)

            duration_seconds = job.source_video.duration_seconds or transcription.duration_seconds or max(
                (candidate.end for candidate in candidates),
                default=0.0,
            )

            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.SCORING)
            audio_samples, sample_rate = load_mono_wave(audio_path)
            clips = score_candidate_clips(
                candidates,
                audio_samples=audio_samples,
                sample_rate=sample_rate,
                source_video_id=job.source_video.id,
                video_url=f"/api/jobs/{job_id}/video",
            )
            timeline = build_timeline(clips, duration_seconds=duration_seconds)
            summary = build_summary(clips, duration_seconds=duration_seconds, transcript_text=transcription.transcript_text)

            ready_job = job.model_copy(
                update={
                    "status": JobStatus.READY,
                    "progress_phase": ProgressPhase.READY,
                    "error": None,
                    "transcript_text": transcription.transcript_text,
                    "language": transcription.language,
                    "clips": clips,
                    "timeline": timeline,
                    "summary": summary,
                    "source_video": job.source_video.model_copy(update={"duration_seconds": duration_seconds}),
                }
            )
            self.store.save_job(ready_job)
        except Exception as exc:
            failed_job = self.store.load_job(job_id).model_copy(
                update={
                    "status": JobStatus.FAILED,
                    "progress_phase": ProgressPhase.FAILED,
                    "error": str(exc),
                }
            )
            self.store.save_job(failed_job)
            logger.exception("Job %s failed", job_id)

    def _save_state(self, job: JobManifest, *, status: JobStatus, progress_phase: ProgressPhase) -> JobManifest:
        updated_job = job.model_copy(update={"status": status, "progress_phase": progress_phase, "error": None})
        return self.store.save_job(updated_job)
