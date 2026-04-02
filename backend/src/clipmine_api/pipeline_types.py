from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class WordToken:
    text: str
    raw_text: str
    start: float
    end: float
    probability: float


@dataclass(slots=True)
class CandidateClip:
    text: str
    start: float
    end: float
    words: list[WordToken]

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def word_count(self) -> int:
        return len(self.words)


@dataclass(slots=True)
class TranscriptionResult:
    words: list[WordToken]
    transcript_text: str
    language: str | None
    duration_seconds: float | None

