from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from statistics import mean
from time import perf_counter

from .artifact_store import ArtifactStore
from .media import MediaProcessingError, extract_audio, load_mono_wave, probe_media_duration
from .multimodal import enrich_scored_clips
from .precision import apply_precision_selection
from .presentation import build_summary, build_timeline
from .schemas import ClipRecord, JobManifest, JobStatus, ProcessingStats, ProgressPhase
from .scoring import score_candidate_clips
from .segmentation import segment_words_detailed
from .storage import JobStore
from .transcription import transcribe_audio

logger = logging.getLogger("uvicorn.error")


class JobProcessor:
    def __init__(
        self,
        store: JobStore,
        artifact_store: ArtifactStore,
        *,
        worker_concurrency: int = 1,
        retention_hours: int = 168,
    ):
        self.store = store
        self.artifact_store = artifact_store
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.worker_concurrency = max(1, worker_concurrency)
        self.retention_hours = retention_hours
        self.worker_tasks: list[asyncio.Task[None]] = []

    @property
    def queue_depth(self) -> int:
        return self.queue.qsize()

    @property
    def active_workers(self) -> int:
        return sum(1 for task in self.worker_tasks if not task.done())

    async def start(self) -> None:
        if not self.worker_tasks:
            removed_count = self.store.cleanup_expired_jobs(self.retention_hours)
            removed_ephemeral_artifacts = self.store.cleanup_ephemeral_artifacts(self.retention_hours)
            expired_sessions = self.store.cleanup_expired_upload_sessions(self.artifact_store.abort_multipart_upload)
            self.worker_tasks = [
                asyncio.create_task(self._worker_loop(worker_index))
                for worker_index in range(self.worker_concurrency)
            ]
            await self._recover_incomplete_jobs()
            logger.info(
                "processor.started worker_concurrency=%s removed_expired_jobs=%s removed_ephemeral_artifacts=%s expired_upload_sessions=%s",
                self.worker_concurrency,
                removed_count,
                removed_ephemeral_artifacts,
                expired_sessions,
            )

    async def stop(self) -> None:
        if not self.worker_tasks:
            return
        for worker_task in self.worker_tasks:
            worker_task.cancel()
        for worker_task in self.worker_tasks:
            with suppress(asyncio.CancelledError):
                await worker_task
        self.worker_tasks = []
        logger.info("processor.stopped")

    async def enqueue(self, job_id: str) -> None:
        await self.queue.put(job_id)
        logger.info("processor.enqueued job_id=%s queue_size=%s", job_id, self.queue.qsize())

    async def _recover_incomplete_jobs(self) -> None:
        recovered_count = 0
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
            recovered_count += 1
            logger.info("processor.recovered job_id=%s previous_status=%s", recovered_job.job_id, job.status.value)
        logger.info("processor.recovery_complete recovered_jobs=%s", recovered_count)

    async def _worker_loop(self, worker_index: int) -> None:
        while True:
            job_id = await self.queue.get()
            logger.info("processor.dequeue worker=%s job_id=%s queue_size=%s", worker_index, job_id, self.queue.qsize())
            try:
                await asyncio.to_thread(self.process_job, job_id)
            except Exception:
                logger.exception("Worker failure for job %s", job_id)
            finally:
                self.queue.task_done()

    def process_job(self, job_id: str) -> None:
        job = self.store.load_job(job_id)
        video_path = self.store.processing_video_path(job)
        audio_path = self.store.audio_path(job_id)
        started_at = perf_counter()
        processing_timings = dict(job.processing_timings)
        processing_stats = job.processing_stats.model_copy()
        logger.info("job.start job_id=%s video_path=%s audio_path=%s", job_id, video_path, audio_path)

        try:
            if job.source_video.storage_backend != "local":
                download_started_at = perf_counter()
                self.artifact_store.download_source_video(job.source_video, video_path)
                processing_timings["download_source"] = round((perf_counter() - download_started_at) * 1000, 1)
                job = self.store.save_job(job.model_copy(update={"processing_timings": processing_timings}))
                logger.info(
                    "job.remote_source_ready job_id=%s storage_backend=%s duration_ms=%.1f",
                    job_id,
                    job.source_video.storage_backend,
                    processing_timings["download_source"],
                )

            stage_started_at = perf_counter()
            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.EXTRACTING_AUDIO)
            extract_audio(video_path, audio_path)
            processing_timings[ProgressPhase.EXTRACTING_AUDIO.value] = round((perf_counter() - stage_started_at) * 1000, 1)
            job = self.store.save_job(job.model_copy(update={"processing_timings": processing_timings}))
            logger.info(
                "job.stage_complete job_id=%s stage=extracting_audio duration_ms=%.1f",
                job_id,
                processing_timings[ProgressPhase.EXTRACTING_AUDIO.value],
            )

            stage_started_at = perf_counter()
            duration_seconds = probe_media_duration(video_path)
            processing_stats = processing_stats.model_copy(
                update={"source_duration_seconds": round(duration_seconds or 0.0, 3)}
            )
            job = self.store.save_job(
                job.model_copy(
                    update={
                        "source_video": job.source_video.model_copy(update={"duration_seconds": duration_seconds}),
                        "processing_stats": processing_stats,
                    }
                )
            )
            logger.info("job.media_probed job_id=%s duration_seconds=%s", job_id, duration_seconds)

            stage_started_at = perf_counter()
            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.TRANSCRIBING)
            transcription = transcribe_audio(audio_path)
            processing_timings[ProgressPhase.TRANSCRIBING.value] = round((perf_counter() - stage_started_at) * 1000, 1)
            processing_stats = processing_stats.model_copy(update={"transcript_word_count": len(transcription.words)})
            job = self.store.save_job(
                job.model_copy(update={"processing_timings": processing_timings, "processing_stats": processing_stats})
            )
            logger.info(
                "job.stage_complete job_id=%s stage=transcribing duration_ms=%.1f word_count=%s language=%s transcript_chars=%s",
                job_id,
                processing_timings[ProgressPhase.TRANSCRIBING.value],
                len(transcription.words),
                transcription.language,
                len(transcription.transcript_text),
            )

            stage_started_at = perf_counter()
            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.SEGMENTING)
            segmentation_result = segment_words_detailed(transcription.words)
            candidates = segmentation_result.clips
            processing_timings[ProgressPhase.SEGMENTING.value] = round((perf_counter() - stage_started_at) * 1000, 1)
            processing_stats = processing_stats.model_copy(
                update={
                    "candidate_clip_count": segmentation_result.candidate_count,
                    "discarded_candidate_count": segmentation_result.discarded_count,
                }
            )
            job = self.store.save_job(
                job.model_copy(update={"processing_timings": processing_timings, "processing_stats": processing_stats})
            )
            logger.info(
                "job.stage_complete job_id=%s stage=segmenting duration_ms=%.1f candidate_count=%s",
                job_id,
                processing_timings[ProgressPhase.SEGMENTING.value],
                len(candidates),
            )

            duration_seconds = job.source_video.duration_seconds or transcription.duration_seconds or max(
                (candidate.end for candidate in candidates),
                default=0.0,
            )

            stage_started_at = perf_counter()
            job = self._save_state(job, status=JobStatus.PROCESSING, progress_phase=ProgressPhase.SCORING)
            audio_samples, sample_rate = load_mono_wave(audio_path)
            clips = score_candidate_clips(
                candidates,
                audio_samples=audio_samples,
                sample_rate=sample_rate,
                source_video_id=job.source_video.id,
                video_url=f"/api/jobs/{job_id}/video",
            )
            clips = enrich_scored_clips(
                clips,
                candidate_clips=candidates,
                audio_samples=audio_samples,
                sample_rate=sample_rate,
                video_path=video_path,
            )
            precision_result = apply_precision_selection(clips)
            clips = precision_result.clips
            timeline = build_timeline(clips, duration_seconds=duration_seconds)
            summary = build_summary(clips, duration_seconds=duration_seconds, transcript_text=transcription.transcript_text)
            processing_timings[ProgressPhase.SCORING.value] = round((perf_counter() - stage_started_at) * 1000, 1)
            processing_timings["total"] = round((perf_counter() - started_at) * 1000, 1)
            processing_stats = processing_stats.model_copy(
                update={
                    "clip_count": len(clips),
                    "timeline_bin_count": len(timeline),
                    "deduped_candidate_count": precision_result.deduped_count,
                    "shortlist_recommended_count": precision_result.shortlist_recommended_count,
                }
            )
            warnings = _build_warnings(clips, processing_stats)
            logger.info(
                "job.stage_complete job_id=%s stage=scoring duration_ms=%.1f clip_count=%s top_score=%s sample_rate=%s enriched_fields=%s",
                job_id,
                processing_timings[ProgressPhase.SCORING.value],
                len(clips),
                summary.top_score if summary else None,
                sample_rate,
                "audio_features,linguistic_features,word_alignments,visual_features,quality_breakdown,quality_reasoning,tags,recommended_use,embedding_vector",
            )

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
                    "processing_timings": processing_timings,
                    "warnings": warnings,
                    "processing_stats": processing_stats,
                }
            )
            self.store.save_job(ready_job)
            logger.info(
                "job.ready job_id=%s total_duration_ms=%.1f clip_count=%s timeline_bins=%s",
                job_id,
                (perf_counter() - started_at) * 1000,
                len(clips),
                len(timeline),
            )
        except Exception as exc:
            error_message = _normalize_processing_error(exc)
            failed_job = self.store.load_job(job_id).model_copy(
                update={
                    "status": JobStatus.FAILED,
                    "progress_phase": ProgressPhase.FAILED,
                    "error": error_message,
                    "processing_timings": {**processing_timings, "total": round((perf_counter() - started_at) * 1000, 1)},
                }
            )
            self.store.save_job(failed_job)
            logger.exception(
                "job.failed job_id=%s total_duration_ms=%.1f error=%s user_message=%s",
                job_id,
                (perf_counter() - started_at) * 1000,
                exc,
                error_message,
            )
        finally:
            if job.source_video.storage_backend != "local":
                video_path.unlink(missing_ok=True)

    def _save_state(self, job: JobManifest, *, status: JobStatus, progress_phase: ProgressPhase) -> JobManifest:
        updated_job = job.model_copy(update={"status": status, "progress_phase": progress_phase, "error": None})
        logger.info("job.state job_id=%s status=%s phase=%s", job.job_id, status.value, progress_phase.value)
        return self.store.save_job(updated_job)


def _build_warnings(clips: list[ClipRecord], processing_stats: ProcessingStats) -> list[str]:
    if not clips:
        return ["No usable speech clips were detected from the source video."]

    warnings: list[str] = []
    average_confidence = mean(clip.confidence for clip in clips)
    average_visual_readiness = mean(clip.quality_breakdown.visual_readiness for clip in clips)
    average_audio_signal = mean(clip.quality_breakdown.acoustic_signal for clip in clips)

    if max((clip.score for clip in clips), default=0.0) < 78:
        warnings.append("No clips reached the Excellent quality band.")
    if average_confidence < 0.72:
        warnings.append("Average transcription confidence is lower than ideal for direct training use.")
    if average_visual_readiness < 0.45:
        warnings.append("Visual track quality is weak, so audiovisual use may need manual review.")
    if average_audio_signal < 0.5:
        warnings.append("Audio signal quality is inconsistent across the strongest clips.")
    if processing_stats.transcript_word_count < 40:
        warnings.append("The source contains limited usable speech, so review coverage may be sparse.")

    return warnings


def _normalize_processing_error(exc: Exception) -> str:
    if isinstance(exc, MediaProcessingError):
        return str(exc)

    if isinstance(exc, FileNotFoundError):
        return "A required source artifact was missing while processing the job."

    return "Processing failed unexpectedly before clips could be generated. Check backend logs and retry the upload."
