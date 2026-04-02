from pathlib import Path

import numpy as np

from clipmine_api import multimodal
from clipmine_api.pipeline_types import CandidateClip, WordToken
from clipmine_api.schemas import ClipRecord, PlaybackMetadata, ScalarFeature, VisualFeatures


def test_enrich_scored_clips_adds_multimodal_fields(monkeypatch) -> None:
    sample_rate = 16000
    audio = np.zeros(sample_rate * 2, dtype=np.float32)
    audio[: sample_rate] = 0.16
    audio[sample_rate:] = 0.08

    candidate = CandidateClip(
        text="We should label the best example.",
        start=0.0,
        end=1.8,
        words=[
            WordToken(text="We", raw_text="We", start=0.0, end=0.25, probability=0.96),
            WordToken(text="should", raw_text=" should", start=0.25, end=0.55, probability=0.95),
            WordToken(text="label", raw_text=" label", start=0.55, end=0.95, probability=0.94),
            WordToken(text="the", raw_text=" the", start=0.95, end=1.15, probability=0.93),
            WordToken(text="best", raw_text=" best", start=1.15, end=1.45, probability=0.94),
            WordToken(text="example.", raw_text=" example.", start=1.45, end=1.8, probability=0.95),
        ],
    )
    scored_clip = ClipRecord(
        id="job123-clip-001",
        text=candidate.text,
        start=0.0,
        end=1.8,
        duration=1.8,
        confidence=0.94,
        speech_rate=3.33,
        energy=0.78,
        silence_ratio=0.08,
        instability=0.18,
        score=88.0,
        quality_label="Excellent",
        explanation="High confidence, strong signal, ideal pace",
        source_video_id="job123",
        playback=PlaybackMetadata(url="/api/jobs/job123/video", start=0.0, end=1.8),
    )

    monkeypatch.setattr(
        multimodal,
        "_build_visual_features",
        lambda *_args, **_kwargs: VisualFeatures(
            sampled_frame_count=4,
            face_detection=ScalarFeature(value=0.82, normalized=0.82),
            mouth_movement=ScalarFeature(value=0.58, normalized=0.58),
            visibility=ScalarFeature(value=0.77, normalized=0.77),
        ),
    )

    enriched = multimodal.enrich_scored_clips(
        [scored_clip],
        candidate_clips=[candidate],
        audio_samples=audio,
        sample_rate=sample_rate,
        video_path=Path("unused.mp4"),
    )

    clip = enriched[0]

    assert clip.audio_features.volume.normalized == 0.78
    assert clip.linguistic_features.word_count == 6
    assert clip.word_alignments[0].token == "We"
    assert 0.0 <= clip.quality_breakdown.boundary_cleanliness <= 1.0
    assert 0.0 <= clip.quality_breakdown.speech_density <= 1.0
    assert 0.0 <= clip.quality_breakdown.visual_readiness <= 1.0
    assert clip.quality_reasoning.summary
    assert clip.recommended_use
    assert "alignment_review" in clip.recommended_use
    assert len(clip.embedding_vector or []) == 12
    assert any(tag in clip.tags for tag in {"high-confidence", "training-ready"})
