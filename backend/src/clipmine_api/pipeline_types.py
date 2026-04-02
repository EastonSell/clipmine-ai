from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class CandidateMetrics:
    pause_count: int = 0
    max_gap_seconds: float = 0.0
    speech_density: float = 0.0
    low_confidence_ratio: float = 0.0
    leading_filler_ratio: float = 0.0
    trailing_filler_ratio: float = 0.0
    boundary_punctuation_strength: float = 0.0


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
    candidate_metrics: CandidateMetrics = field(default_factory=CandidateMetrics)

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
