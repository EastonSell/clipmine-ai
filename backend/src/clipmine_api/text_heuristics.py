from __future__ import annotations

import re

FILLER_SINGLE_WORDS = {"um", "uh", "erm", "ah", "like"}
FILLER_PHRASES = ("you know", "kind of", "sort of", "i mean")
WEAK_BOUNDARY_TOKENS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "because",
    "but",
    "for",
    "from",
    "if",
    "in",
    "into",
    "like",
    "of",
    "on",
    "or",
    "so",
    "than",
    "that",
    "the",
    "then",
    "to",
    "with",
}
STRONG_BOUNDARY_PATTERN = re.compile(r"[.!?;:]$")
SOFT_BOUNDARY_PATTERN = re.compile(r",$")
BREAK_BOUNDARY_PATTERN = re.compile(r"[-–—]$")


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9']+", "", value.lower()).strip("'")


def is_filler_token(value: str) -> bool:
    return normalize_token(value) in FILLER_SINGLE_WORDS


def is_weak_boundary_token(value: str) -> bool:
    token = normalize_token(value)
    return token in WEAK_BOUNDARY_TOKENS or token in FILLER_SINGLE_WORDS


def detect_fillers(tokens: list[str], clip_text: str) -> list[str]:
    hits: list[str] = []
    seen: set[str] = set()

    for token in tokens:
        normalized = normalize_token(token)
        if normalized in FILLER_SINGLE_WORDS and normalized not in seen:
            hits.append(normalized)
            seen.add(normalized)

    lowered_text = re.sub(r"\s+", " ", clip_text.lower())
    for phrase in FILLER_PHRASES:
        if phrase in lowered_text and phrase not in seen:
            hits.append(phrase)
            seen.add(phrase)

    return hits


def boundary_punctuation_strength(raw_text: str) -> float:
    cleaned = raw_text.strip()
    if STRONG_BOUNDARY_PATTERN.search(cleaned):
        return 1.0
    if SOFT_BOUNDARY_PATTERN.search(cleaned):
        return 0.7
    if BREAK_BOUNDARY_PATTERN.search(cleaned):
        return 0.45
    return 0.25


def token_similarity(left_text: str, right_text: str) -> float:
    left_tokens = {normalize_token(token) for token in left_text.split() if normalize_token(token)}
    right_tokens = {normalize_token(token) for token in right_text.split() if normalize_token(token)}
    if not left_tokens or not right_tokens:
        return 0.0

    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    return intersection / union if union else 0.0
