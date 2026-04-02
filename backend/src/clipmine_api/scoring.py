from __future__ import annotations

from statistics import mean

import numpy as np

from .pipeline_types import CandidateClip
from .schemas import CandidateMetrics as CandidateMetricsModel, ClipRecord, PlaybackMetadata
from .text_heuristics import is_weak_boundary_token


def score_candidate_clips(
    clips: list[CandidateClip],
    *,
    audio_samples: np.ndarray,
    sample_rate: int,
    source_video_id: str,
    video_url: str,
) -> list[ClipRecord]:
    if not clips:
        return []

    clip_features: list[dict[str, float | CandidateClip]] = []
    raw_energies: list[float] = []

    for clip in clips:
        segment = _clip_audio_slice(audio_samples, sample_rate, clip.start, clip.end)
        raw_energy = _rms(segment)
        frame_rms = _frame_rms(segment, sample_rate)
        silence_threshold = max(0.008, raw_energy * 0.4)
        silence_ratio = float(np.mean(frame_rms < silence_threshold)) if frame_rms.size else 1.0
        instability = float(np.std(frame_rms) / (np.mean(frame_rms) + 1e-6)) if frame_rms.size else 1.0
        instability = _clamp(instability / 1.5)
        confidence = _clamp(mean(word.probability for word in clip.words))
        speech_rate = clip.word_count / max(clip.duration, 1e-6)

        clip_features.append(
            {
                "clip": clip,
                "raw_energy": raw_energy,
                "silence_ratio": silence_ratio,
                "instability": instability,
                "confidence": confidence,
                "speech_rate": speech_rate,
            }
        )
        raw_energies.append(raw_energy)

    q10 = float(np.percentile(raw_energies, 10))
    q90 = float(np.percentile(raw_energies, 90))

    scored: list[ClipRecord] = []
    for index, feature_set in enumerate(clip_features):
        clip = feature_set["clip"]
        assert isinstance(clip, CandidateClip)
        raw_energy = float(feature_set["raw_energy"])
        energy_norm = _normalize(raw_energy, q10, q90)
        silence_ratio = float(feature_set["silence_ratio"])
        instability = float(feature_set["instability"])
        confidence = float(feature_set["confidence"])
        speech_rate = float(feature_set["speech_rate"])
        pace_fit = _pace_fit(speech_rate)
        continuity = _clamp(1.0 - silence_ratio)
        duration_penalty = _duration_penalty(clip.duration)
        boundary_cleanliness = _boundary_cleanliness(clip)
        edge_filler_penalty = clip.candidate_metrics.leading_filler_ratio + clip.candidate_metrics.trailing_filler_ratio
        speech_density = clip.candidate_metrics.speech_density
        low_confidence_penalty = clip.candidate_metrics.low_confidence_ratio

        score = 100 * (0.45 * confidence + 0.20 * pace_fit + 0.20 * energy_norm + 0.15 * continuity)
        score -= 15 * silence_ratio
        score -= 8 * instability
        score -= 5 * duration_penalty
        score += 7 * (boundary_cleanliness - 0.5)
        score += 5 * (speech_density - 0.5)
        score -= 12 * edge_filler_penalty
        score -= 10 * low_confidence_penalty
        score = round(_clamp(score / 100.0) * 100, 1)

        quality_label = _quality_label(score)
        explanation = _build_explanation(
            confidence=confidence,
            energy=energy_norm,
            pace_fit=pace_fit,
            silence_ratio=silence_ratio,
            instability=instability,
            speech_rate=speech_rate,
            boundary_cleanliness=boundary_cleanliness,
        )

        scored.append(
            ClipRecord(
                id=f"{source_video_id}-clip-{index + 1:03d}",
                text=clip.text,
                start=round(clip.start, 3),
                end=round(clip.end, 3),
                duration=round(clip.duration, 3),
                confidence=round(confidence, 3),
                speech_rate=round(speech_rate, 3),
                energy=round(energy_norm, 3),
                silence_ratio=round(silence_ratio, 3),
                instability=round(instability, 3),
                score=score,
                quality_label=quality_label,
                explanation=explanation,
                source_video_id=source_video_id,
                playback=PlaybackMetadata(
                    url=video_url,
                    start=round(clip.start, 3),
                    end=round(clip.end, 3),
                ),
                candidate_metrics=CandidateMetricsModel(
                    pause_count=clip.candidate_metrics.pause_count,
                    max_gap_seconds=round(clip.candidate_metrics.max_gap_seconds, 3),
                    speech_density=round(clip.candidate_metrics.speech_density, 3),
                    low_confidence_ratio=round(clip.candidate_metrics.low_confidence_ratio, 3),
                    leading_filler_ratio=round(clip.candidate_metrics.leading_filler_ratio, 3),
                    trailing_filler_ratio=round(clip.candidate_metrics.trailing_filler_ratio, 3),
                    boundary_punctuation_strength=round(clip.candidate_metrics.boundary_punctuation_strength, 3),
                ),
            )
        )

    return sorted(scored, key=lambda clip: (-clip.score, clip.start))


def _clip_audio_slice(audio_samples: np.ndarray, sample_rate: int, start: float, end: float) -> np.ndarray:
    start_index = max(0, int(start * sample_rate))
    end_index = min(len(audio_samples), int(end * sample_rate))
    return audio_samples[start_index:end_index]


def _rms(audio_segment: np.ndarray) -> float:
    if audio_segment.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(audio_segment))))


def _frame_rms(audio_segment: np.ndarray, sample_rate: int, frame_ms: float = 0.05) -> np.ndarray:
    frame_size = max(1, int(sample_rate * frame_ms))
    if audio_segment.size == 0:
        return np.array([], dtype=np.float32)
    frame_count = max(1, int(np.ceil(audio_segment.size / frame_size)))
    padded = np.pad(audio_segment, (0, frame_count * frame_size - audio_segment.size))
    frames = padded.reshape(frame_count, frame_size)
    return np.sqrt(np.mean(np.square(frames), axis=1))


def _pace_fit(speech_rate: float) -> float:
    if 2.2 <= speech_rate <= 3.8:
        return 1.0
    if speech_rate < 2.2:
        return _clamp(speech_rate / 2.2)
    return _clamp(1.0 - ((speech_rate - 3.8) / 2.0))


def _duration_penalty(duration: float) -> float:
    if 1.2 <= duration <= 2.8:
        return 0.0
    if duration < 1.2:
        return _clamp((1.2 - duration) / 1.2)
    return _clamp((duration - 2.8) / 0.4)


def _quality_label(score: float) -> str:
    if score >= 78:
        return "Excellent"
    if score >= 55:
        return "Good"
    return "Weak"


def _build_explanation(
    *,
    confidence: float,
    energy: float,
    pace_fit: float,
    silence_ratio: float,
    instability: float,
    speech_rate: float,
    boundary_cleanliness: float,
) -> str:
    positives: list[str] = []
    negatives: list[str] = []

    if confidence >= 0.85:
        positives.append("High confidence")
    elif confidence < 0.65:
        negatives.append("Lower confidence")

    if energy >= 0.7:
        positives.append("strong signal")
    elif energy < 0.35:
        negatives.append("weak signal")

    if pace_fit >= 0.95:
        positives.append("ideal pace")
    elif speech_rate < 2.2:
        negatives.append("slow pace")
    elif speech_rate > 3.8:
        negatives.append("fast pace")

    if silence_ratio <= 0.18:
        positives.append("steady delivery")
    elif silence_ratio > 0.28:
        negatives.append("pause-heavy")

    if boundary_cleanliness >= 0.72:
        positives.append("clean boundaries")
    elif boundary_cleanliness < 0.42:
        negatives.append("messy boundary")

    if instability > 0.55:
        negatives.append("uneven signal")

    descriptors = (positives[:3] or ["Moderate signal"]) + negatives[:2]
    explanation = ", ".join(descriptors[:3])
    return explanation[0].upper() + explanation[1:]


def _normalize(value: float, floor: float, ceiling: float) -> float:
    if ceiling <= floor + 1e-6:
        return 0.5 if value > 0 else 0.0
    return _clamp((value - floor) / (ceiling - floor))


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _boundary_cleanliness(clip: CandidateClip) -> float:
    weak_start = 1.0 if is_weak_boundary_token(clip.words[0].text) else 0.0
    weak_end = 1.0 if is_weak_boundary_token(clip.words[-1].text) else 0.0
    edge_filler_penalty = max(
        clip.candidate_metrics.leading_filler_ratio,
        clip.candidate_metrics.trailing_filler_ratio,
    )
    return _clamp(
        0.45 * clip.candidate_metrics.boundary_punctuation_strength
        + 0.25 * (1.0 - edge_filler_penalty)
        + 0.15 * (1.0 - weak_start)
        + 0.15 * (1.0 - weak_end)
    )
