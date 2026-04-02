from __future__ import annotations

from datetime import UTC, datetime

from .schemas import ClipRecord, JobManifest, JobSummary, TimelineBin


def build_summary(clips: list[ClipRecord], *, duration_seconds: float, transcript_text: str | None) -> JobSummary:
    excellent = sum(1 for clip in clips if clip.quality_label == "Excellent")
    good = sum(1 for clip in clips if clip.quality_label == "Good")
    weak = sum(1 for clip in clips if clip.quality_label == "Weak")
    average_score = round(sum(clip.score for clip in clips) / len(clips), 1) if clips else 0.0
    top_score = max((clip.score for clip in clips), default=0.0)
    preview = (transcript_text or "").strip()
    if len(preview) > 180:
        preview = preview[:177].rstrip() + "..."
    return JobSummary(
        duration_seconds=round(duration_seconds, 3),
        transcript_preview=preview,
        clip_count=len(clips),
        excellent_count=excellent,
        good_count=good,
        weak_count=weak,
        average_score=average_score,
        top_score=top_score,
    )


def build_timeline(clips: list[ClipRecord], *, duration_seconds: float, bin_count: int = 48) -> list[TimelineBin]:
    if duration_seconds <= 0:
        duration_seconds = max((clip.end for clip in clips), default=0.0)

    if duration_seconds <= 0:
        return [TimelineBin(start=0.0, end=0.0, score=0.0, quality_label="Weak", top_clip_id=None) for _ in range(bin_count)]

    bin_size = duration_seconds / bin_count
    bins: list[TimelineBin] = []
    for index in range(bin_count):
        start = index * bin_size
        end = duration_seconds if index == bin_count - 1 else (index + 1) * bin_size
        overlapping = [clip for clip in clips if clip.end > start and clip.start < end]

        if overlapping:
            weighted_score = 0.0
            total_overlap = 0.0
            top_clip = max(overlapping, key=lambda clip: clip.score)
            for clip in overlapping:
                overlap = min(clip.end, end) - max(clip.start, start)
                if overlap > 0:
                    total_overlap += overlap
                    weighted_score += clip.score * overlap
            score = round(weighted_score / total_overlap, 1) if total_overlap else round(top_clip.score, 1)
            quality_label = _quality_label(score)
            top_clip_id = top_clip.id
        else:
            score = 0.0
            quality_label = "Weak"
            top_clip_id = None

        bins.append(
            TimelineBin(
                start=round(start, 3),
                end=round(end, 3),
                score=score,
                quality_label=quality_label,
                top_clip_id=top_clip_id,
            )
        )

    return bins


def serialize_job(job: JobManifest) -> dict[str, object]:
    return {
        "jobId": job.job_id,
        "status": job.status.value,
        "progressPhase": job.progress_phase.value,
        "error": job.error,
        "sourceVideo": _serialize_source_video(job),
        "summary": job.summary.model_dump(mode="json") if job.summary else None,
        "clips": [clip.model_dump(mode="json") for clip in job.clips],
        "timeline": [bin_item.model_dump(mode="json") for bin_item in job.timeline],
        "language": job.language,
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
    }


def serialize_export(job: JobManifest) -> dict[str, object]:
    return {
        "jobId": job.job_id,
        "status": job.status.value,
        "exportedAt": datetime.now(tz=UTC).isoformat(),
        "sourceVideo": _serialize_source_video(job),
        "summary": job.summary.model_dump(mode="json") if job.summary else None,
        "clips": [clip.model_dump(mode="json") for clip in job.clips],
        "timeline": [bin_item.model_dump(mode="json") for bin_item in job.timeline],
        "transcriptText": job.transcript_text,
        "language": job.language,
    }


def _serialize_source_video(job: JobManifest) -> dict[str, object]:
    source_video = job.source_video.model_dump(mode="json")
    source_video.pop("relative_path", None)
    source_video["url"] = f"/api/jobs/{job.job_id}/video"
    return source_video


def _quality_label(score: float) -> str:
    if score >= 78:
        return "Excellent"
    if score >= 55:
        return "Good"
    return "Weak"

