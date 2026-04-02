from __future__ import annotations

import re
from dataclasses import dataclass

from .pipeline_types import CandidateClip, CandidateMetrics, WordToken
from .text_heuristics import boundary_punctuation_strength, is_filler_token, is_weak_boundary_token

BOUNDARY_PATTERN = re.compile(r"[.!?;:]$")
MIN_DURATION = 0.9
TARGET_DURATION = 2.0
MAX_DURATION = 3.2
MAX_GAP_SECONDS = 0.45
SOFT_GAP_SECONDS = 0.28
MIN_WORDS = 3
PAUSE_GAP_SECONDS = 0.22
LOW_CONFIDENCE_THRESHOLD = 0.68
MIN_SPEECH_DENSITY = 0.42
MAX_LOW_CONFIDENCE_RATIO = 0.5
MAX_EDGE_FILLER_RATIO = 0.34


@dataclass(slots=True)
class SegmentationResult:
    clips: list[CandidateClip]
    candidate_count: int
    discarded_count: int


def segment_words(words: list[WordToken]) -> list[CandidateClip]:
    return segment_words_detailed(words).clips


def segment_words_detailed(words: list[WordToken]) -> SegmentationResult:
    if not words:
        return SegmentationResult(clips=[], candidate_count=0, discarded_count=0)

    phrase_groups = _build_phrase_groups(words)
    raw_candidates: list[CandidateClip] = []
    for group in phrase_groups:
        raw_candidates.extend(_split_group(group))

    accepted_candidates: list[CandidateClip] = []
    discarded_count = 0
    for candidate in raw_candidates:
        if _is_candidate_precise_enough(candidate):
            accepted_candidates.append(candidate)
        else:
            discarded_count += 1

    return SegmentationResult(
        clips=accepted_candidates,
        candidate_count=len(raw_candidates),
        discarded_count=discarded_count,
    )


def _build_phrase_groups(words: list[WordToken]) -> list[list[WordToken]]:
    phrase_groups: list[list[WordToken]] = []
    current_group: list[WordToken] = []

    for word in words:
        if current_group:
            gap = max(0.0, word.start - current_group[-1].end)
            current_duration = current_group[-1].end - current_group[0].start
            if gap > MAX_GAP_SECONDS or (
                gap > SOFT_GAP_SECONDS
                and current_duration >= 1.25
                and (is_weak_boundary_token(current_group[-1].text) or is_weak_boundary_token(word.text))
            ):
                phrase_groups.append(current_group)
                current_group = []

        current_group.append(word)

        if BOUNDARY_PATTERN.search(word.raw_text.strip()):
            phrase_groups.append(current_group)
            current_group = []

    if current_group:
        phrase_groups.append(current_group)

    return phrase_groups


def _split_group(group: list[WordToken]) -> list[CandidateClip]:
    if len(group) < MIN_WORDS:
        return []

    duration = group[-1].end - group[0].start
    if MIN_DURATION <= duration <= MAX_DURATION:
        clip = _make_clip(group)
        return [clip] if clip else []

    clips: list[CandidateClip] = []
    index = 0
    while index < len(group):
        best_candidate: CandidateClip | None = None
        best_end_index: int | None = None
        best_cost = float("inf")
        start_time = group[index].start

        for end_index in range(index + MIN_WORDS - 1, len(group)):
            duration = group[end_index].end - start_time
            if duration > MAX_DURATION:
                break
            if duration < MIN_DURATION:
                continue

            candidate = _make_clip(group[index : end_index + 1])
            if not candidate:
                continue

            cost = _candidate_cost(candidate)
            if cost < best_cost:
                best_cost = cost
                best_candidate = candidate
                best_end_index = end_index

        if best_candidate is None or best_end_index is None:
            break

        clips.append(best_candidate)
        index = best_end_index + 1

    if not clips:
        clip = _make_clip(group)
        return [clip] if clip else []

    return clips


def _make_clip(words: list[WordToken]) -> CandidateClip | None:
    trimmed_words = _trim_edge_fillers(words)
    if len(trimmed_words) < MIN_WORDS:
        return None

    start = trimmed_words[0].start
    end = trimmed_words[-1].end
    duration = end - start
    if duration < MIN_DURATION or duration > MAX_DURATION:
        return None

    text = " ".join(word.text for word in trimmed_words)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text).strip()
    text = _sentence_case(text)
    return CandidateClip(
        text=text,
        start=start,
        end=end,
        words=trimmed_words,
        candidate_metrics=_build_candidate_metrics(trimmed_words),
    )


def _trim_edge_fillers(words: list[WordToken]) -> list[WordToken]:
    trimmed = list(words)

    while len(trimmed) > MIN_WORDS and _should_trim_leading_word(trimmed[0]):
        trimmed = trimmed[1:]

    while len(trimmed) > MIN_WORDS and _should_trim_trailing_word(trimmed[-1]):
        trimmed = trimmed[:-1]

    return trimmed


def _build_candidate_metrics(words: list[WordToken]) -> CandidateMetrics:
    duration = max(1e-6, words[-1].end - words[0].start)
    gaps = [max(0.0, current.start - previous.end) for previous, current in zip(words, words[1:])]
    speech_duration = sum(max(0.0, word.end - word.start) for word in words)
    leading_filler_count = _count_leading_fillers(words)
    trailing_filler_count = _count_trailing_fillers(words)

    return CandidateMetrics(
        pause_count=sum(1 for gap in gaps if gap >= PAUSE_GAP_SECONDS),
        max_gap_seconds=round(max(gaps, default=0.0), 3),
        speech_density=round(_clamp(speech_duration / duration), 3),
        low_confidence_ratio=round(
            sum(1 for word in words if word.probability < LOW_CONFIDENCE_THRESHOLD) / len(words),
            3,
        ),
        leading_filler_ratio=round(leading_filler_count / len(words), 3),
        trailing_filler_ratio=round(trailing_filler_count / len(words), 3),
        boundary_punctuation_strength=round(boundary_punctuation_strength(words[-1].raw_text), 3),
    )


def _candidate_cost(candidate: CandidateClip) -> float:
    boundary_cleanliness = _boundary_cleanliness(candidate)
    edge_filler_penalty = candidate.candidate_metrics.leading_filler_ratio + candidate.candidate_metrics.trailing_filler_ratio
    return (
        abs(candidate.duration - TARGET_DURATION)
        - 0.25 * candidate.candidate_metrics.boundary_punctuation_strength
        - 0.2 * boundary_cleanliness
        - 0.18 * candidate.candidate_metrics.speech_density
        + 0.3 * candidate.candidate_metrics.low_confidence_ratio
        + 0.25 * edge_filler_penalty
    )


def _is_candidate_precise_enough(candidate: CandidateClip) -> bool:
    metrics = candidate.candidate_metrics
    return (
        candidate.word_count >= MIN_WORDS
        and MIN_DURATION <= candidate.duration <= MAX_DURATION
        and metrics.speech_density >= MIN_SPEECH_DENSITY
        and metrics.low_confidence_ratio <= MAX_LOW_CONFIDENCE_RATIO
        and metrics.leading_filler_ratio <= MAX_EDGE_FILLER_RATIO
        and metrics.trailing_filler_ratio <= MAX_EDGE_FILLER_RATIO
        and not (_boundary_cleanliness(candidate) < 0.32 and metrics.max_gap_seconds >= SOFT_GAP_SECONDS)
    )


def _boundary_cleanliness(candidate: CandidateClip) -> float:
    metrics = candidate.candidate_metrics
    weak_start = 1.0 if is_weak_boundary_token(candidate.words[0].text) else 0.0
    weak_end = 1.0 if is_weak_boundary_token(candidate.words[-1].text) else 0.0
    edge_filler_penalty = max(metrics.leading_filler_ratio, metrics.trailing_filler_ratio)
    return _clamp(
        0.45 * metrics.boundary_punctuation_strength
        + 0.25 * (1.0 - edge_filler_penalty)
        + 0.15 * (1.0 - weak_start)
        + 0.15 * (1.0 - weak_end)
    )


def _should_trim_leading_word(word: WordToken) -> bool:
    return is_filler_token(word.text) or (is_weak_boundary_token(word.text) and word.probability < 0.58)


def _should_trim_trailing_word(word: WordToken) -> bool:
    return is_filler_token(word.text) or (is_weak_boundary_token(word.text) and word.probability < 0.58)


def _count_leading_fillers(words: list[WordToken]) -> int:
    count = 0
    for word in words:
        if not is_filler_token(word.text):
            break
        count += 1
    return count


def _count_trailing_fillers(words: list[WordToken]) -> int:
    count = 0
    for word in reversed(words):
        if not is_filler_token(word.text):
            break
        count += 1
    return count


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _sentence_case(text: str) -> str:
    for index, character in enumerate(text):
        if character.isalpha():
            return f"{text[:index]}{character.upper()}{text[index + 1:]}"
    return text
