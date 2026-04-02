from __future__ import annotations

from dataclasses import dataclass

from .schemas import ClipRecord, QualityReasoning
from .text_heuristics import token_similarity


@dataclass(slots=True)
class DuplicateSignal:
    overlap_ratio: float
    similarity: float
    risk: float


@dataclass(slots=True)
class PrecisionSelectionResult:
    clips: list[ClipRecord]
    deduped_count: int
    shortlist_recommended_count: int


def apply_precision_selection(clips: list[ClipRecord]) -> PrecisionSelectionResult:
    if not clips:
        return PrecisionSelectionResult(clips=[], deduped_count=0, shortlist_recommended_count=0)

    duplicate_signals = _build_duplicate_signals(clips)
    kept_ids, deduped_count = _dedupe_clip_ids(clips, duplicate_signals)

    selected_clips: list[ClipRecord] = []
    shortlist_recommended_count = 0

    for clip in sorted(clips, key=lambda item: (-item.score, item.start)):
        if clip.id not in kept_ids:
            continue

        max_duplicate_risk = _max_duplicate_risk(clip.id, duplicate_signals)
        penalties = _build_quality_penalties(clip, max_duplicate_risk)
        adjusted_score = _adjust_score(clip, max_duplicate_risk)
        quality_label = _quality_label(adjusted_score)
        recommendation = _selection_recommendation(clip, adjusted_score, penalties)
        if recommendation == "shortlist":
            shortlist_recommended_count += 1

        updated_breakdown = clip.quality_breakdown.model_copy(
            update={
                "dedupe_confidence": round(_clamp(1.0 - max_duplicate_risk), 3),
                "overall": round(_clamp(adjusted_score / 100.0), 3),
            }
        )
        updated_tags = _merge_unique(
            clip.tags
            + _build_precision_tags(
                clip,
                recommendation=recommendation,
                penalties=penalties,
                max_duplicate_risk=max_duplicate_risk,
            )
        )
        updated_recommended_use = _build_precision_recommended_use(
            clip,
            recommendation=recommendation,
            penalties=penalties,
        )
        updated_reasoning = _update_quality_reasoning(
            clip.quality_reasoning,
            recommendation=recommendation,
            penalties=penalties,
            clip=clip,
        )

        selected_clips.append(
            clip.model_copy(
                update={
                    "score": adjusted_score,
                    "quality_label": quality_label,
                    "quality_breakdown": updated_breakdown,
                    "selection_recommendation": recommendation,
                    "quality_penalties": penalties,
                    "tags": updated_tags,
                    "recommended_use": updated_recommended_use,
                    "quality_reasoning": updated_reasoning,
                    "explanation": _build_precision_explanation(
                        clip,
                        recommendation=recommendation,
                        penalties=penalties,
                    ),
                }
            )
        )

    selected_clips.sort(key=lambda clip: (-clip.score, clip.start))
    return PrecisionSelectionResult(
        clips=selected_clips,
        deduped_count=deduped_count,
        shortlist_recommended_count=shortlist_recommended_count,
    )


def _build_duplicate_signals(clips: list[ClipRecord]) -> dict[tuple[str, str], DuplicateSignal]:
    signals: dict[tuple[str, str], DuplicateSignal] = {}

    for index, clip in enumerate(clips):
        for other in clips[index + 1 :]:
            overlap = min(clip.end, other.end) - max(clip.start, other.start)
            if overlap <= 0:
                continue

            overlap_ratio = _clamp(overlap / max(0.001, min(clip.duration, other.duration)))
            similarity = _clamp(token_similarity(clip.text, other.text))
            risk = _clamp(overlap_ratio * similarity)
            signals[_signal_key(clip.id, other.id)] = DuplicateSignal(
                overlap_ratio=round(overlap_ratio, 3),
                similarity=round(similarity, 3),
                risk=round(risk, 3),
            )

    return signals


def _dedupe_clip_ids(
    clips: list[ClipRecord],
    duplicate_signals: dict[tuple[str, str], DuplicateSignal],
) -> tuple[set[str], int]:
    kept: list[ClipRecord] = []
    kept_ids: set[str] = set()
    deduped_count = 0

    ranked_clips = sorted(
        clips,
        key=lambda clip: (
            -clip.score,
            -clip.quality_breakdown.boundary_cleanliness,
            -clip.confidence,
            clip.start,
        ),
    )

    for clip in ranked_clips:
        duplicate_of_kept = False
        for kept_clip in kept:
            signal = duplicate_signals.get(_signal_key(clip.id, kept_clip.id))
            if not signal:
                continue
            if signal.overlap_ratio >= 0.72 and signal.similarity >= 0.68:
                duplicate_of_kept = True
                deduped_count += 1
                break

        if duplicate_of_kept:
            continue

        kept.append(clip)
        kept_ids.add(clip.id)

    return kept_ids, deduped_count


def _adjust_score(clip: ClipRecord, max_duplicate_risk: float) -> float:
    filler_penalty = _clamp(
        clip.linguistic_features.filler_word_count / max(1.0, clip.linguistic_features.word_count / 3.0),
    )
    edge_filler_penalty = max(
        clip.candidate_metrics.leading_filler_ratio,
        clip.candidate_metrics.trailing_filler_ratio,
    )
    pause_penalty = _clamp(
        0.55 * _clamp((clip.candidate_metrics.max_gap_seconds - 0.18) / 0.4)
        + 0.45 * _clamp(clip.candidate_metrics.pause_count / 3.0)
    )

    adjusted = float(clip.score)
    adjusted += 7.0 * (clip.quality_breakdown.boundary_cleanliness - 0.5)
    adjusted += 6.0 * (clip.quality_breakdown.speech_density - 0.5)
    adjusted += 5.0 * (clip.quality_breakdown.linguistic_clarity - 0.5)
    adjusted -= 9.0 * clip.candidate_metrics.low_confidence_ratio
    adjusted -= 12.0 * max(edge_filler_penalty, filler_penalty)
    adjusted -= 7.0 * pause_penalty
    adjusted -= 8.0 * max_duplicate_risk

    if clip.quality_breakdown.visual_readiness >= 0.65 and clip.quality_breakdown.acoustic_signal >= 0.65:
        adjusted += 2.5

    return round(_clamp(adjusted / 100.0) * 100, 1)


def _build_quality_penalties(clip: ClipRecord, max_duplicate_risk: float) -> list[str]:
    penalties: list[str] = []
    filler_penalty = max(
        clip.candidate_metrics.leading_filler_ratio + clip.candidate_metrics.trailing_filler_ratio,
        _clamp(clip.linguistic_features.filler_word_count / max(1.0, clip.linguistic_features.word_count / 3.0)),
    )

    if clip.quality_breakdown.boundary_cleanliness < 0.48:
        penalties.append("boundary_messy")
    if clip.candidate_metrics.pause_count >= 2 or clip.candidate_metrics.max_gap_seconds >= 0.38:
        penalties.append("pause_heavy")
    if clip.candidate_metrics.low_confidence_ratio > 0.26 or clip.confidence < 0.7:
        penalties.append("low_confidence_span")
    if filler_penalty > 0.18:
        penalties.append("filler_heavy")
    if max_duplicate_risk >= 0.55:
        penalties.append("duplicate_overlap")

    return penalties


def _selection_recommendation(clip: ClipRecord, adjusted_score: float, penalties: list[str]) -> str:
    blocking_penalties = {"boundary_messy", "filler_heavy", "low_confidence_span"}

    if (
        adjusted_score >= 82
        and not (blocking_penalties & set(penalties))
        and clip.quality_breakdown.acoustic_signal >= 0.62
    ):
        return "shortlist"
    if adjusted_score < 45 or len(blocking_penalties & set(penalties)) >= 2:
        return "discard"
    return "review"


def _build_precision_tags(
    clip: ClipRecord,
    *,
    recommendation: str,
    penalties: list[str],
    max_duplicate_risk: float,
) -> list[str]:
    tags: list[str] = []

    if recommendation == "shortlist":
        tags.append("audio-only-ready")
        if clip.quality_breakdown.visual_readiness >= 0.58 and clip.visual_features.face_detection.normalized >= 0.55:
            tags.append("av-ready")
    if clip.quality_breakdown.boundary_cleanliness >= 0.72:
        tags.append("boundary-clean")
    if "filler_heavy" in penalties:
        tags.append("filler-heavy")
    if max_duplicate_risk >= 0.55:
        tags.append("duplicate-risk")
    if recommendation != "shortlist":
        tags.append("review-needed")

    return tags


def _build_precision_recommended_use(
    clip: ClipRecord,
    *,
    recommendation: str,
    penalties: list[str],
) -> list[str]:
    recommendations: list[str] = []

    if recommendation == "shortlist" and clip.confidence >= 0.82 and clip.quality_breakdown.acoustic_signal >= 0.6:
        recommendations.append("speech_recognition_training")
    if recommendation == "shortlist" and clip.quality_breakdown.continuity >= 0.65:
        recommendations.append("alignment_review")
    if (
        recommendation == "shortlist"
        and clip.visual_features.face_detection.normalized >= 0.55
        and clip.visual_features.mouth_movement.normalized >= 0.45
    ):
        recommendations.append("audiovisual_speech_training")
    if recommendation != "shortlist" or penalties:
        recommendations.append("human_annotation_review")

    if not recommendations:
        recommendations.append("general_clip_review")

    return _merge_unique(recommendations + clip.recommended_use)[:4]


def _update_quality_reasoning(
    reasoning: QualityReasoning,
    *,
    recommendation: str,
    penalties: list[str],
    clip: ClipRecord,
) -> QualityReasoning:
    strengths = list(reasoning.strengths)
    cautions = list(reasoning.cautions)

    if recommendation == "shortlist":
        strengths.append("Precision pass recommends this clip for shortlist review")
    if clip.quality_breakdown.boundary_cleanliness >= 0.72:
        strengths.append("Boundary transitions are clean enough for export")
    if clip.quality_breakdown.speech_density >= 0.62:
        strengths.append("Speech occupies most of the clip window")

    caution_map = {
        "boundary_messy": "Boundary transitions need manual cleanup",
        "pause_heavy": "Long pauses reduce clip density",
        "low_confidence_span": "Low-confidence spans remain inside the clip",
        "filler_heavy": "Filler-heavy wording lowers direct training value",
        "duplicate_overlap": "Content is similar to another strong clip",
    }
    for penalty in penalties:
        message = caution_map.get(penalty)
        if message:
            cautions.append(message)

    summary = _summary_for_recommendation(recommendation, strengths, cautions)
    return QualityReasoning(
        summary=summary,
        strengths=_merge_unique(strengths)[:5],
        cautions=_merge_unique(cautions)[:5],
    )


def _build_precision_explanation(
    clip: ClipRecord,
    *,
    recommendation: str,
    penalties: list[str],
) -> str:
    positives: list[str] = []
    negatives: list[str] = []

    if clip.quality_breakdown.boundary_cleanliness >= 0.72:
        positives.append("clean boundary")
    if clip.quality_breakdown.acoustic_signal >= 0.72:
        positives.append("strong signal")
    if clip.quality_breakdown.linguistic_clarity >= 0.7:
        positives.append("low filler")
    if recommendation == "shortlist":
        positives.append("shortlist-ready")

    penalty_labels = {
        "boundary_messy": "boundary needs cleanup",
        "pause_heavy": "pause-heavy",
        "low_confidence_span": "low-confidence span",
        "filler_heavy": "filler-heavy",
        "duplicate_overlap": "duplicate risk",
    }
    negatives.extend(penalty_labels[penalty] for penalty in penalties[:2] if penalty in penalty_labels)
    if recommendation == "discard":
        negatives.append("discard first")

    parts = (positives[:3] or ["balanced clip"]) + negatives[:2]
    explanation = ", ".join(parts[:4])
    return explanation[0].upper() + explanation[1:]


def _summary_for_recommendation(recommendation: str, strengths: list[str], cautions: list[str]) -> str:
    if recommendation == "shortlist":
        prefix = "Shortlist-ready"
    elif recommendation == "discard":
        prefix = "Discard candidate"
    else:
        prefix = "Needs review"

    details = strengths[:1] + cautions[:1]
    if not details:
        return prefix
    return f"{prefix}: {details[0]}"


def _max_duplicate_risk(
    clip_id: str,
    duplicate_signals: dict[tuple[str, str], DuplicateSignal],
) -> float:
    return max(
        (signal.risk for key, signal in duplicate_signals.items() if clip_id in key),
        default=0.0,
    )


def _signal_key(left_id: str, right_id: str) -> tuple[str, str]:
    return tuple(sorted((left_id, right_id)))


def _quality_label(score: float) -> str:
    if score >= 78:
        return "Excellent"
    if score >= 55:
        return "Good"
    return "Weak"


def _merge_unique(values: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value and value not in seen:
            merged.append(value)
            seen.add(value)
    return merged


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))
