from __future__ import annotations

import re

from .pipeline_types import CandidateClip, WordToken

BOUNDARY_PATTERN = re.compile(r"[.!?;:]$")
MIN_DURATION = 0.9
TARGET_DURATION = 2.0
MAX_DURATION = 3.2
MAX_GAP_SECONDS = 0.45
MIN_WORDS = 3


def segment_words(words: list[WordToken]) -> list[CandidateClip]:
    if not words:
        return []

    phrase_groups: list[list[WordToken]] = []
    current_group: list[WordToken] = []

    for word in words:
        if current_group and word.start - current_group[-1].end > MAX_GAP_SECONDS:
            phrase_groups.append(current_group)
            current_group = []

        current_group.append(word)

        if BOUNDARY_PATTERN.search(word.raw_text.strip()):
            phrase_groups.append(current_group)
            current_group = []

    if current_group:
        phrase_groups.append(current_group)

    clips: list[CandidateClip] = []
    for group in phrase_groups:
        clips.extend(_split_group(group))

    return [clip for clip in clips if clip.word_count >= MIN_WORDS and MIN_DURATION <= clip.duration <= MAX_DURATION]


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
        best_end_index: int | None = None
        best_cost = float("inf")
        start_time = group[index].start

        for end_index in range(index + MIN_WORDS - 1, len(group)):
            duration = group[end_index].end - start_time
            if duration > MAX_DURATION:
                break
            if duration < MIN_DURATION:
                continue

            cost = abs(duration - TARGET_DURATION)
            if BOUNDARY_PATTERN.search(group[end_index].raw_text.strip()):
                cost -= 0.2

            if cost < best_cost:
                best_cost = cost
                best_end_index = end_index

        if best_end_index is None:
            break

        clip = _make_clip(group[index : best_end_index + 1])
        if clip:
            clips.append(clip)

        index = best_end_index + 1

    if not clips:
        clip = _make_clip(group)
        return [clip] if clip else []

    return clips


def _make_clip(words: list[WordToken]) -> CandidateClip | None:
    if len(words) < MIN_WORDS:
        return None
    start = words[0].start
    end = words[-1].end
    duration = end - start
    if duration < MIN_DURATION or duration > MAX_DURATION:
        return None
    text = " ".join(word.text for word in words)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text).strip()
    return CandidateClip(text=text, start=start, end=end, words=words)

