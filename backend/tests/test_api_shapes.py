from pathlib import Path

from clipmine_api.presentation import build_summary, build_timeline, serialize_export, serialize_job
from clipmine_api.schemas import ClipRecord, JobManifest, JobStatus, PlaybackMetadata, ProgressPhase, SourceVideoRecord


def test_serialize_job_and_export_shapes() -> None:
    clip = ClipRecord(
        id="job123-clip-001",
        text="Example clip.",
        start=0.0,
        end=1.5,
        duration=1.5,
        confidence=0.92,
        speech_rate=2.7,
        energy=0.8,
        silence_ratio=0.1,
        instability=0.2,
        score=84.0,
        quality_label="Excellent",
        explanation="High confidence, strong signal, ideal pace",
        source_video_id="job123",
        playback=PlaybackMetadata(url="/api/jobs/job123/video", start=0.0, end=1.5),
    )
    summary = build_summary([clip], duration_seconds=10.0, transcript_text="Example transcript")
    timeline = build_timeline([clip], duration_seconds=10.0)
    manifest = JobManifest(
        job_id="job123",
        status=JobStatus.READY,
        progress_phase=ProgressPhase.READY,
        created_at="2026-04-01T00:00:00+00:00",
        updated_at="2026-04-01T00:00:10+00:00",
        source_video=SourceVideoRecord(
            id="job123",
            file_name="example.mp4",
            content_type="video/mp4",
            size_bytes=1024,
            relative_path=str(Path("jobs/job123/source/example.mp4")),
            duration_seconds=10.0,
        ),
        transcript_text="Example transcript",
        clips=[clip],
        timeline=timeline,
        summary=summary,
    )

    job_payload = serialize_job(manifest)
    export_payload = serialize_export(manifest)

    assert job_payload["jobId"] == "job123"
    assert job_payload["sourceVideo"]["url"] == "/api/jobs/job123/video"
    assert len(job_payload["timeline"]) == 48
    assert export_payload["clips"][0]["quality_label"] == "Excellent"
    assert "audio_features" in export_payload["clips"][0]
    assert "quality_breakdown" in export_payload["clips"][0]
    assert "word_alignments" in export_payload["clips"][0]
    assert "processingTimings" in job_payload
    assert "warnings" in job_payload
    assert "processingStats" in export_payload
