from __future__ import annotations

import logging
import math
import re
from pathlib import Path

import av
import numpy as np

from .pipeline_types import CandidateClip, WordToken
from .schemas import (
    AudioFeatures,
    ClipRecord,
    LinguisticFeatures,
    QualityBreakdown,
    QualityReasoning,
    ScalarFeature,
    SpectralFeatures,
    VisualFeatures,
    WordAlignment,
)
from .text_heuristics import FILLER_SINGLE_WORDS, detect_fillers, normalize_token

logger = logging.getLogger("uvicorn.error")

PRONOUNS = {
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "our",
    "their",
    "mine",
    "yours",
    "ours",
    "theirs",
}
DETERMINERS = {"a", "an", "the", "this", "that", "these", "those", "each", "every", "some", "any"}
ADPOSITIONS = {
    "in",
    "on",
    "at",
    "by",
    "for",
    "from",
    "to",
    "with",
    "about",
    "into",
    "over",
    "after",
    "before",
    "under",
    "between",
    "through",
}
CONJUNCTIONS = {"and", "or", "but", "so", "because", "if", "while", "though", "although", "yet"}
INTERJECTIONS = {"oh", "wow", "hey", "ah", "hmm"}
VERB_LEXICON = {
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "say",
    "says",
    "said",
    "make",
    "makes",
    "made",
    "know",
    "think",
    "want",
    "need",
    "use",
    "build",
    "learn",
    "train",
    "run",
    "show",
    "see",
    "find",
    "work",
    "talk",
    "talking",
}
POS_CATEGORIES = (
    "noun",
    "verb",
    "adjective",
    "adverb",
    "pronoun",
    "determiner",
    "adposition",
    "conjunction",
    "numeral",
    "interjection",
    "other",
)


def enrich_scored_clips(
    clips: list[ClipRecord],
    *,
    candidate_clips: list[CandidateClip],
    audio_samples: np.ndarray,
    sample_rate: int,
    video_path: Path,
) -> list[ClipRecord]:
    if not clips:
        return []

    candidate_lookup = {_candidate_key(candidate): candidate for candidate in candidate_clips}
    enriched: list[ClipRecord] = []

    for clip in clips:
        candidate = candidate_lookup.get(_clip_key(clip))
        words = candidate.words if candidate else []

        audio_features = _build_audio_features(
            clip=clip,
            audio_samples=audio_samples,
            sample_rate=sample_rate,
        )
        linguistic_features = _build_linguistic_features(words, clip.text)
        word_alignments = _build_word_alignments(words)
        visual_features = _build_visual_features(video_path, start=clip.start, end=clip.end)
        quality_breakdown = _build_quality_breakdown(
            clip=clip,
            audio_features=audio_features,
            linguistic_features=linguistic_features,
            visual_features=visual_features,
        )
        quality_reasoning = _build_quality_reasoning(
            clip=clip,
            audio_features=audio_features,
            linguistic_features=linguistic_features,
            visual_features=visual_features,
            quality_breakdown=quality_breakdown,
        )
        tags = _build_tags(
            clip=clip,
            linguistic_features=linguistic_features,
            visual_features=visual_features,
            quality_breakdown=quality_breakdown,
        )
        recommended_use = _build_recommended_use(
            clip=clip,
            visual_features=visual_features,
            quality_breakdown=quality_breakdown,
            tags=tags,
        )
        embedding_vector = _build_embedding_vector(
            clip=clip,
            audio_features=audio_features,
            linguistic_features=linguistic_features,
            visual_features=visual_features,
            quality_breakdown=quality_breakdown,
        )

        enriched.append(
            clip.model_copy(
                update={
                    "audio_features": audio_features,
                    "linguistic_features": linguistic_features,
                    "word_alignments": word_alignments,
                    "visual_features": visual_features,
                    "quality_breakdown": quality_breakdown,
                    "quality_reasoning": quality_reasoning,
                    "tags": tags,
                    "recommended_use": recommended_use,
                    "embedding_vector": embedding_vector,
                }
            )
        )

    return enriched


def _build_audio_features(*, clip: ClipRecord, audio_samples: np.ndarray, sample_rate: int) -> AudioFeatures:
    segment = _clip_audio_slice(audio_samples, sample_rate, clip.start, clip.end)
    raw_volume = _rms(segment)
    frame_rms = _frame_rms(segment, sample_rate)
    snr_db, snr_normalized = _estimate_snr(frame_rms)
    spectral = _build_spectral_features(segment, sample_rate)

    return AudioFeatures(
        volume=ScalarFeature(value=round(raw_volume, 6), normalized=round(clip.energy, 3)),
        speech_rate=ScalarFeature(value=round(clip.speech_rate, 3), normalized=round(_pace_fit(clip.speech_rate), 3)),
        snr=ScalarFeature(value=round(snr_db, 3), normalized=round(snr_normalized, 3)),
        spectral=spectral,
    )


def _build_linguistic_features(words: list[WordToken], clip_text: str) -> LinguisticFeatures:
    normalized_tokens = [_normalize_token(word.text) for word in words if _normalize_token(word.text)]
    word_count = len(normalized_tokens)
    unique_words = len(set(normalized_tokens))
    lexical_diversity = round(_safe_divide(unique_words, word_count), 3)
    filler_hits = detect_fillers(normalized_tokens, clip_text)
    filler_word_count = len(filler_hits)
    pos_distribution = _build_pos_distribution(normalized_tokens)

    return LinguisticFeatures(
        word_count=word_count,
        lexical_diversity=lexical_diversity,
        filler_word_count=filler_word_count,
        filler_words=filler_hits,
        pos_distribution=pos_distribution,
    )


def _build_word_alignments(words: list[WordToken]) -> list[WordAlignment]:
    return [
        WordAlignment(
            token=word.text,
            start=round(word.start, 3),
            end=round(word.end, 3),
            confidence=round(word.probability, 3),
        )
        for word in words
    ]


def _build_visual_features(video_path: Path, *, start: float, end: float) -> VisualFeatures:
    if end <= start or not video_path.exists():
        return VisualFeatures()

    try:
        frames = _sample_video_frames(video_path, start=start, end=end)
    except Exception:
        logger.exception("visual.sample_failed path=%s start=%s end=%s", video_path, start, end)
        return VisualFeatures()

    if not frames:
        return VisualFeatures()

    face_scores: list[float] = []
    visibility_scores: list[float] = []
    mouth_regions: list[np.ndarray] = []

    for frame in frames:
        rgb = frame.astype(np.float32) / 255.0
        gray = np.dot(rgb[..., :3], np.array([0.299, 0.587, 0.114], dtype=np.float32))
        height, width = gray.shape
        center = rgb[height // 6 : max(height // 6 + 1, height * 5 // 6), width // 4 : max(width // 4 + 1, width * 3 // 4)]
        center_gray = gray[height // 6 : max(height // 6 + 1, height * 5 // 6), width // 4 : max(width // 4 + 1, width * 3 // 4)]

        brightness = float(center_gray.mean()) if center_gray.size else 0.0
        contrast = float(center_gray.std()) if center_gray.size else 0.0
        sharpness = _edge_strength(center_gray)
        skin_ratio = _skin_ratio(center)

        brightness_fit = _clamp(1.0 - abs(brightness - 0.55) / 0.45)
        contrast_fit = _clamp(contrast / 0.24)
        sharpness_fit = _clamp(sharpness / 0.18)
        face_score = _clamp(0.5 * _clamp((skin_ratio - 0.03) / 0.17) + 0.25 * brightness_fit + 0.25 * contrast_fit)
        visibility = _clamp(0.4 * brightness_fit + 0.3 * contrast_fit + 0.3 * sharpness_fit)

        mouth_region = gray[height * 11 // 20 : max(height * 11 // 20 + 1, height * 16 // 20), width * 7 // 20 : max(width * 7 // 20 + 1, width * 13 // 20)]
        face_scores.append(face_score)
        visibility_scores.append(visibility * max(0.4, face_score))
        mouth_regions.append(mouth_region)

    mouth_movement = _mouth_movement_score(mouth_regions, face_scores)
    face_detection = round(float(np.mean(face_scores)), 3)
    visibility = round(float(np.mean(visibility_scores)), 3)

    return VisualFeatures(
        sampled_frame_count=len(frames),
        face_detection=ScalarFeature(value=face_detection, normalized=face_detection),
        mouth_movement=ScalarFeature(value=mouth_movement, normalized=mouth_movement),
        visibility=ScalarFeature(value=visibility, normalized=visibility),
    )


def _build_quality_breakdown(
    *,
    clip: ClipRecord,
    audio_features: AudioFeatures,
    linguistic_features: LinguisticFeatures,
    visual_features: VisualFeatures,
) -> QualityBreakdown:
    filler_penalty = _clamp(
        linguistic_features.filler_word_count / max(1.0, linguistic_features.word_count / 3.0),
    )
    word_count_fit = _clamp(linguistic_features.word_count / 8.0)
    linguistic_clarity = _clamp(
        0.45 * linguistic_features.lexical_diversity + 0.3 * word_count_fit + 0.25 * (1.0 - filler_penalty)
    )
    acoustic_signal = _clamp(
        0.45 * clip.energy
        + 0.35 * audio_features.snr.normalized
        + 0.2 * (1.0 - audio_features.spectral.flatness.normalized)
    )
    visual_readiness = _clamp(
        0.45 * visual_features.face_detection.normalized
        + 0.2 * visual_features.mouth_movement.normalized
        + 0.35 * visual_features.visibility.normalized
    )

    return QualityBreakdown(
        transcription_confidence=round(clip.confidence, 3),
        pacing=round(audio_features.speech_rate.normalized, 3),
        acoustic_signal=round(acoustic_signal, 3),
        continuity=round(_clamp(1.0 - clip.silence_ratio), 3),
        stability=round(_clamp(1.0 - clip.instability), 3),
        linguistic_clarity=round(linguistic_clarity, 3),
        visual_readiness=round(visual_readiness, 3),
        boundary_cleanliness=round(_boundary_cleanliness(clip), 3),
        speech_density=round(clip.candidate_metrics.speech_density, 3),
        dedupe_confidence=1.0,
        overall=round(_clamp(clip.score / 100.0), 3),
    )


def _build_quality_reasoning(
    *,
    clip: ClipRecord,
    audio_features: AudioFeatures,
    linguistic_features: LinguisticFeatures,
    visual_features: VisualFeatures,
    quality_breakdown: QualityBreakdown,
) -> QualityReasoning:
    strengths: list[str] = []
    cautions: list[str] = []

    if quality_breakdown.transcription_confidence >= 0.85:
        strengths.append("High transcription confidence")
    elif quality_breakdown.transcription_confidence < 0.65:
        cautions.append("Confidence drops below the strongest training range")

    if quality_breakdown.acoustic_signal >= 0.72:
        strengths.append("Audio signal stays clean and strong")
    elif quality_breakdown.acoustic_signal < 0.45:
        cautions.append("Audio signal is weaker than ideal")

    if quality_breakdown.pacing >= 0.92:
        strengths.append("Delivery pace fits short-clip review well")
    elif clip.speech_rate > 3.8:
        cautions.append("Delivery pace runs fast")
    elif clip.speech_rate < 2.2:
        cautions.append("Delivery pace runs slow")

    if linguistic_features.filler_word_count == 0 and quality_breakdown.linguistic_clarity >= 0.65:
        strengths.append("Language stays concise with low filler")
    elif linguistic_features.filler_word_count > 0:
        cautions.append("Filler words may require extra review")

    if quality_breakdown.boundary_cleanliness >= 0.72:
        strengths.append("Boundaries are clean enough for short-clip export")
    elif quality_breakdown.boundary_cleanliness < 0.45:
        cautions.append("Clip boundaries may need manual cleanup")

    if visual_features.face_detection.normalized >= 0.55 and visual_features.visibility.normalized >= 0.55:
        strengths.append("Face remains visible enough for multimodal review")
    elif visual_features.sampled_frame_count > 0 and quality_breakdown.visual_readiness < 0.45:
        cautions.append("Visual track is less reliable than the audio track")

    summary_parts = strengths[:2]
    if cautions:
        summary_parts.append(cautions[0])
    if not summary_parts:
        summary_parts = ["Balanced clip signals", "Worth a quick human review"]

    return QualityReasoning(
        summary=_sentence_case(", ".join(summary_parts[:3])),
        strengths=strengths[:4],
        cautions=cautions[:4],
    )


def _build_tags(
    *,
    clip: ClipRecord,
    linguistic_features: LinguisticFeatures,
    visual_features: VisualFeatures,
    quality_breakdown: QualityBreakdown,
) -> list[str]:
    tags: list[str] = []

    if clip.confidence >= 0.85:
        tags.append("high-confidence")
    if quality_breakdown.acoustic_signal >= 0.7:
        tags.append("clean-audio")
    if quality_breakdown.pacing >= 0.9:
        tags.append("balanced-pace")
    if quality_breakdown.continuity >= 0.75:
        tags.append("steady-delivery")
    if visual_features.face_detection.normalized >= 0.55:
        tags.append("face-visible")
    if visual_features.mouth_movement.normalized >= 0.5:
        tags.append("mouth-active")
    if linguistic_features.filler_word_count > 0:
        tags.append("filler-words")
    if quality_breakdown.overall >= 0.78:
        tags.append("training-ready")
    elif quality_breakdown.overall < 0.55:
        tags.append("review-needed")

    return tags[:6]


def _build_recommended_use(
    *,
    clip: ClipRecord,
    visual_features: VisualFeatures,
    quality_breakdown: QualityBreakdown,
    tags: list[str],
) -> list[str]:
    recommendations: list[str] = []

    if clip.confidence >= 0.82 and quality_breakdown.acoustic_signal >= 0.6:
        recommendations.append("speech_recognition_training")
    if clip.confidence >= 0.78 and quality_breakdown.continuity >= 0.65:
        recommendations.append("alignment_review")
    if visual_features.face_detection.normalized >= 0.55 and visual_features.mouth_movement.normalized >= 0.45:
        recommendations.append("audiovisual_speech_training")
    if "review-needed" in tags or quality_breakdown.visual_readiness < 0.45:
        recommendations.append("human_annotation_review")

    if not recommendations:
        recommendations.append("general_clip_review")

    return recommendations[:4]


def _build_embedding_vector(
    *,
    clip: ClipRecord,
    audio_features: AudioFeatures,
    linguistic_features: LinguisticFeatures,
    visual_features: VisualFeatures,
    quality_breakdown: QualityBreakdown,
) -> list[float]:
    return [
        round(value, 4)
        for value in (
            clip.confidence,
            clip.energy,
            audio_features.snr.normalized,
            quality_breakdown.pacing,
            quality_breakdown.continuity,
            quality_breakdown.stability,
            quality_breakdown.linguistic_clarity,
            visual_features.face_detection.normalized,
            visual_features.mouth_movement.normalized,
            quality_breakdown.visual_readiness,
            quality_breakdown.overall,
            _clamp(linguistic_features.lexical_diversity),
        )
    ]


def _build_spectral_features(audio_segment: np.ndarray, sample_rate: int) -> SpectralFeatures:
    if audio_segment.size == 0:
        return SpectralFeatures()

    window = np.hanning(audio_segment.size)
    spectrum = np.abs(np.fft.rfft(audio_segment * window)).astype(np.float64)
    if not spectrum.size or float(spectrum.sum()) <= 1e-6:
        return SpectralFeatures()

    frequencies = np.fft.rfftfreq(audio_segment.size, d=1.0 / sample_rate)
    total_energy = float(spectrum.sum())
    centroid = float(np.sum(frequencies * spectrum) / total_energy)
    bandwidth = float(np.sqrt(np.sum(((frequencies - centroid) ** 2) * spectrum) / total_energy))
    cumulative = np.cumsum(spectrum)
    rolloff_index = int(np.searchsorted(cumulative, total_energy * 0.85))
    rolloff = float(frequencies[min(rolloff_index, len(frequencies) - 1)])
    flatness = float(np.exp(np.mean(np.log(spectrum + 1e-8))) / (np.mean(spectrum) + 1e-8))
    zero_crossing_rate = float(np.mean(np.abs(np.diff(np.signbit(audio_segment).astype(np.float32)))))
    nyquist = sample_rate / 2.0

    return SpectralFeatures(
        centroid_hz=ScalarFeature(value=round(centroid, 3), normalized=round(_clamp(centroid / nyquist), 3)),
        bandwidth_hz=ScalarFeature(value=round(bandwidth, 3), normalized=round(_clamp(bandwidth / nyquist), 3)),
        rolloff_hz=ScalarFeature(value=round(rolloff, 3), normalized=round(_clamp(rolloff / nyquist), 3)),
        flatness=ScalarFeature(value=round(flatness, 3), normalized=round(_clamp(flatness), 3)),
        zero_crossing_rate=ScalarFeature(
            value=round(zero_crossing_rate, 3),
            normalized=round(_clamp(zero_crossing_rate / 0.25), 3),
        ),
    )


def _estimate_snr(frame_rms: np.ndarray) -> tuple[float, float]:
    if frame_rms.size == 0:
        return 0.0, 0.0

    noise_floor = float(np.percentile(frame_rms, 20))
    signal_floor = float(np.percentile(frame_rms, 85))
    snr_db = 20.0 * math.log10((signal_floor + 1e-6) / (noise_floor + 1e-6))
    return snr_db, _clamp(snr_db / 30.0)


def _sample_video_frames(video_path: Path, *, start: float, end: float, max_frames: int = 5) -> list[np.ndarray]:
    sample_count = max(2, min(max_frames, int(math.ceil(max(end - start, 0.4) / 0.45))))
    sample_times = np.linspace(start, end, num=sample_count, endpoint=True)
    frames: list[np.ndarray] = []

    with av.open(str(video_path)) as container:
        video_stream = next((stream for stream in container.streams if stream.type == "video"), None)
        if video_stream is None:
            return []

        stream_time_base = float(video_stream.time_base) if video_stream.time_base is not None else 0.0
        for sample_time in sample_times:
            if stream_time_base <= 0:
                break
            timestamp = max(0, int(sample_time / stream_time_base))
            container.seek(timestamp, stream=video_stream, backward=True, any_frame=False)
            for frame in container.decode(video_stream):
                if frame.pts is None:
                    continue
                frame_time = float(frame.pts * video_stream.time_base)
                if frame_time + 0.08 >= sample_time:
                    frames.append(frame.to_ndarray(format="rgb24"))
                    break
                if frame_time > sample_time + 0.6:
                    break

    return frames


def _build_pos_distribution(tokens: list[str]) -> dict[str, float]:
    counts = {category: 0 for category in POS_CATEGORIES}
    if not tokens:
        return counts

    for token in tokens:
        counts[_guess_pos(token)] += 1

    word_count = len(tokens)
    return {category: round(count / word_count, 3) for category, count in counts.items()}


def _guess_pos(token: str) -> str:
    if token.isdigit():
        return "numeral"
    if token in PRONOUNS:
        return "pronoun"
    if token in DETERMINERS:
        return "determiner"
    if token in ADPOSITIONS:
        return "adposition"
    if token in CONJUNCTIONS:
        return "conjunction"
    if token in INTERJECTIONS or token in FILLER_SINGLE_WORDS:
        return "interjection"
    if token in VERB_LEXICON or token.endswith(("ed", "ing")):
        return "verb"
    if token.endswith("ly"):
        return "adverb"
    if token.endswith(("ous", "ful", "able", "ible", "ive", "al", "ic", "less", "y")):
        return "adjective"
    if token.endswith(("tion", "ment", "ness", "ity", "ship")):
        return "noun"
    if token.isalpha():
        return "noun"
    return "other"


def _mouth_movement_score(mouth_regions: list[np.ndarray], face_scores: list[float]) -> float:
    if len(mouth_regions) < 2:
        return 0.0

    motions: list[float] = []
    for previous, current in zip(mouth_regions, mouth_regions[1:]):
        min_height = min(previous.shape[0], current.shape[0])
        min_width = min(previous.shape[1], current.shape[1])
        if min_height == 0 or min_width == 0:
            continue
        diff = np.abs(previous[:min_height, :min_width] - current[:min_height, :min_width])
        motions.append(float(np.mean(diff)))

    if not motions:
        return 0.0

    face_support = float(np.mean(face_scores)) if face_scores else 0.0
    return round(_clamp((float(np.mean(motions)) / 0.09)) * max(0.45, face_support), 3)


def _skin_ratio(region: np.ndarray) -> float:
    if region.size == 0:
        return 0.0

    rgb = region * 255.0
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
    mask = (cb >= 77.0) & (cb <= 127.0) & (cr >= 133.0) & (cr <= 173.0)
    return float(mask.mean())


def _edge_strength(region_gray: np.ndarray) -> float:
    if region_gray.size == 0:
        return 0.0
    vertical = np.abs(np.diff(region_gray, axis=0)).mean() if region_gray.shape[0] > 1 else 0.0
    horizontal = np.abs(np.diff(region_gray, axis=1)).mean() if region_gray.shape[1] > 1 else 0.0
    return float((vertical + horizontal) / 2.0)


def _candidate_key(candidate: CandidateClip) -> tuple[float, float, str]:
    return (round(candidate.start, 3), round(candidate.end, 3), candidate.text)


def _clip_key(clip: ClipRecord) -> tuple[float, float, str]:
    return (round(clip.start, 3), round(clip.end, 3), clip.text)


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


def _normalize_token(value: str) -> str:
    return normalize_token(value)


def _safe_divide(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _sentence_case(text: str) -> str:
    if not text:
        return ""
    return text[0].upper() + text[1:]


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _boundary_cleanliness(clip: ClipRecord) -> float:
    edge_filler_penalty = max(
        clip.candidate_metrics.leading_filler_ratio,
        clip.candidate_metrics.trailing_filler_ratio,
    )
    return _clamp(
        0.5 * clip.candidate_metrics.boundary_punctuation_strength
        + 0.25 * clip.candidate_metrics.speech_density
        + 0.25 * (1.0 - edge_filler_penalty)
    )
