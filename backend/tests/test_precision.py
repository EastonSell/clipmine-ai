from clipmine_api.precision import apply_precision_selection
from clipmine_api.schemas import (
    AudioFeatures,
    CandidateMetrics,
    ClipRecord,
    LinguisticFeatures,
    PlaybackMetadata,
    QualityBreakdown,
    QualityReasoning,
    ScalarFeature,
    SpectralFeatures,
    VisualFeatures,
)


def test_precision_selection_dedupes_duplicates_and_marks_filler_review() -> None:
    clean_clip = _build_clip(
        clip_id="clip-1",
        text="Keep the label steady.",
        start=0.0,
        end=2.0,
        score=88.0,
        confidence=0.93,
        quality_label="Excellent",
        candidate_metrics=CandidateMetrics(
            pause_count=0,
            max_gap_seconds=0.08,
            speech_density=0.77,
            low_confidence_ratio=0.05,
            leading_filler_ratio=0.0,
            trailing_filler_ratio=0.0,
            boundary_punctuation_strength=1.0,
        ),
        linguistic_features=LinguisticFeatures(
            word_count=4,
            lexical_diversity=1.0,
            filler_word_count=0,
            filler_words=[],
            pos_distribution={"noun": 0.25, "verb": 0.25},
        ),
        quality_breakdown=QualityBreakdown(
            transcription_confidence=0.93,
            pacing=0.82,
            acoustic_signal=0.79,
            continuity=0.9,
            stability=0.84,
            linguistic_clarity=0.78,
            visual_readiness=0.66,
            boundary_cleanliness=0.82,
            speech_density=0.77,
            dedupe_confidence=1.0,
            overall=0.88,
        ),
        visual_features=_visual_features(0.72, 0.61, 0.68),
    )
    duplicate_clip = _build_clip(
        clip_id="clip-2",
        text="Keep the label steady.",
        start=0.18,
        end=2.12,
        score=80.0,
        confidence=0.84,
        quality_label="Good",
        candidate_metrics=CandidateMetrics(
            pause_count=1,
            max_gap_seconds=0.22,
            speech_density=0.69,
            low_confidence_ratio=0.18,
            leading_filler_ratio=0.0,
            trailing_filler_ratio=0.0,
            boundary_punctuation_strength=0.7,
        ),
        linguistic_features=LinguisticFeatures(
            word_count=4,
            lexical_diversity=1.0,
            filler_word_count=0,
            filler_words=[],
            pos_distribution={"noun": 0.25, "verb": 0.25},
        ),
        quality_breakdown=QualityBreakdown(
            transcription_confidence=0.84,
            pacing=0.74,
            acoustic_signal=0.68,
            continuity=0.78,
            stability=0.76,
            linguistic_clarity=0.7,
            visual_readiness=0.54,
            boundary_cleanliness=0.63,
            speech_density=0.69,
            dedupe_confidence=1.0,
            overall=0.8,
        ),
        visual_features=_visual_features(0.61, 0.48, 0.55),
    )
    filler_clip = _build_clip(
        clip_id="clip-3",
        text="Um we should maybe keep this one.",
        start=3.0,
        end=5.0,
        score=72.0,
        confidence=0.78,
        quality_label="Good",
        candidate_metrics=CandidateMetrics(
            pause_count=2,
            max_gap_seconds=0.41,
            speech_density=0.54,
            low_confidence_ratio=0.22,
            leading_filler_ratio=0.18,
            trailing_filler_ratio=0.0,
            boundary_punctuation_strength=0.25,
        ),
        linguistic_features=LinguisticFeatures(
            word_count=7,
            lexical_diversity=0.78,
            filler_word_count=2,
            filler_words=["um", "maybe"],
            pos_distribution={"noun": 0.14, "verb": 0.29},
        ),
        quality_breakdown=QualityBreakdown(
            transcription_confidence=0.78,
            pacing=0.63,
            acoustic_signal=0.62,
            continuity=0.66,
            stability=0.68,
            linguistic_clarity=0.56,
            visual_readiness=0.44,
            boundary_cleanliness=0.42,
            speech_density=0.54,
            dedupe_confidence=1.0,
            overall=0.72,
        ),
        visual_features=_visual_features(0.49, 0.36, 0.42),
    )

    result = apply_precision_selection([duplicate_clip, filler_clip, clean_clip])

    assert result.deduped_count == 1
    assert [clip.id for clip in result.clips] == ["clip-1", "clip-3"]
    assert result.shortlist_recommended_count == 1
    assert result.clips[0].selection_recommendation == "shortlist"
    assert result.clips[0].quality_breakdown.dedupe_confidence < 1.0
    assert result.clips[1].selection_recommendation in {"review", "discard"}
    assert "filler_heavy" in result.clips[1].quality_penalties


def _build_clip(
    *,
    clip_id: str,
    text: str,
    start: float,
    end: float,
    score: float,
    confidence: float,
    quality_label: str,
    candidate_metrics: CandidateMetrics,
    linguistic_features: LinguisticFeatures,
    quality_breakdown: QualityBreakdown,
    visual_features: VisualFeatures,
) -> ClipRecord:
    return ClipRecord(
        id=clip_id,
        text=text,
        start=start,
        end=end,
        duration=end - start,
        confidence=confidence,
        speech_rate=2.8,
        energy=0.74,
        silence_ratio=0.08,
        instability=0.14,
        score=score,
        quality_label=quality_label,
        explanation="Base explanation",
        source_video_id="video-1",
        playback=PlaybackMetadata(url="/api/jobs/video-1/video", start=start, end=end),
        audio_features=AudioFeatures(
            volume=ScalarFeature(value=0.74, normalized=0.74),
            speech_rate=ScalarFeature(value=2.8, normalized=0.8),
            snr=ScalarFeature(value=0.8, normalized=0.8),
            spectral=SpectralFeatures(
                centroid_hz=ScalarFeature(value=1800, normalized=0.5),
                bandwidth_hz=ScalarFeature(value=1300, normalized=0.4),
                rolloff_hz=ScalarFeature(value=3400, normalized=0.6),
                flatness=ScalarFeature(value=0.14, normalized=0.14),
                zero_crossing_rate=ScalarFeature(value=0.05, normalized=0.05),
            ),
        ),
        linguistic_features=linguistic_features,
        visual_features=visual_features,
        candidate_metrics=candidate_metrics,
        quality_breakdown=quality_breakdown,
        quality_reasoning=QualityReasoning(summary="Balanced clip", strengths=[], cautions=[]),
        tags=[],
        recommended_use=[],
    )


def _visual_features(face: float, mouth: float, visibility: float) -> VisualFeatures:
    return VisualFeatures(
        sampled_frame_count=4,
        face_detection=ScalarFeature(value=face, normalized=face),
        mouth_movement=ScalarFeature(value=mouth, normalized=mouth),
        visibility=ScalarFeature(value=visibility, normalized=visibility),
    )
