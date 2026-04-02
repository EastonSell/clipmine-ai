from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


def _default_pos_distribution() -> dict[str, float]:
    return {
        "noun": 0.0,
        "verb": 0.0,
        "adjective": 0.0,
        "adverb": 0.0,
        "pronoun": 0.0,
        "determiner": 0.0,
        "adposition": 0.0,
        "conjunction": 0.0,
        "numeral": 0.0,
        "interjection": 0.0,
        "other": 0.0,
    }


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ProgressPhase(str, Enum):
    QUEUED = "queued"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    SEGMENTING = "segmenting"
    SCORING = "scoring"
    READY = "ready"
    FAILED = "failed"


class SourceVideoRecord(BaseModel):
    id: str
    file_name: str
    content_type: str
    size_bytes: int
    relative_path: str
    duration_seconds: float | None = None


class PlaybackMetadata(BaseModel):
    url: str
    start: float
    end: float


class ScalarFeature(BaseModel):
    value: float = 0.0
    normalized: float = 0.0


class SpectralFeatures(BaseModel):
    centroid_hz: ScalarFeature = Field(default_factory=ScalarFeature)
    bandwidth_hz: ScalarFeature = Field(default_factory=ScalarFeature)
    rolloff_hz: ScalarFeature = Field(default_factory=ScalarFeature)
    flatness: ScalarFeature = Field(default_factory=ScalarFeature)
    zero_crossing_rate: ScalarFeature = Field(default_factory=ScalarFeature)


class AudioFeatures(BaseModel):
    volume: ScalarFeature = Field(default_factory=ScalarFeature)
    speech_rate: ScalarFeature = Field(default_factory=ScalarFeature)
    snr: ScalarFeature = Field(default_factory=ScalarFeature)
    spectral: SpectralFeatures = Field(default_factory=SpectralFeatures)


class LinguisticFeatures(BaseModel):
    word_count: int = 0
    lexical_diversity: float = 0.0
    filler_word_count: int = 0
    filler_words: list[str] = Field(default_factory=list)
    pos_distribution: dict[str, float] = Field(default_factory=_default_pos_distribution)


class WordAlignment(BaseModel):
    token: str
    start: float
    end: float
    confidence: float


class VisualFeatures(BaseModel):
    sampled_frame_count: int = 0
    face_detection: ScalarFeature = Field(default_factory=ScalarFeature)
    mouth_movement: ScalarFeature = Field(default_factory=ScalarFeature)
    visibility: ScalarFeature = Field(default_factory=ScalarFeature)


class QualityBreakdown(BaseModel):
    transcription_confidence: float = 0.0
    pacing: float = 0.0
    acoustic_signal: float = 0.0
    continuity: float = 0.0
    stability: float = 0.0
    linguistic_clarity: float = 0.0
    visual_readiness: float = 0.0
    overall: float = 0.0


class QualityReasoning(BaseModel):
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)


class ClipRecord(BaseModel):
    id: str
    text: str
    start: float
    end: float
    duration: float
    confidence: float
    speech_rate: float
    energy: float
    silence_ratio: float
    instability: float
    score: float
    quality_label: str
    explanation: str
    source_video_id: str
    playback: PlaybackMetadata
    audio_features: AudioFeatures = Field(default_factory=AudioFeatures)
    linguistic_features: LinguisticFeatures = Field(default_factory=LinguisticFeatures)
    word_alignments: list[WordAlignment] = Field(default_factory=list)
    visual_features: VisualFeatures = Field(default_factory=VisualFeatures)
    quality_breakdown: QualityBreakdown = Field(default_factory=QualityBreakdown)
    quality_reasoning: QualityReasoning = Field(default_factory=QualityReasoning)
    tags: list[str] = Field(default_factory=list)
    recommended_use: list[str] = Field(default_factory=list)
    embedding_vector: list[float] | None = None


class TimelineBin(BaseModel):
    start: float
    end: float
    score: float
    quality_label: str
    top_clip_id: str | None = None


class JobSummary(BaseModel):
    duration_seconds: float
    transcript_preview: str
    clip_count: int
    excellent_count: int
    good_count: int
    weak_count: int
    average_score: float
    top_score: float


class ProcessingStats(BaseModel):
    source_duration_seconds: float = 0.0
    transcript_word_count: int = 0
    candidate_clip_count: int = 0
    clip_count: int = 0
    timeline_bin_count: int = 0


class JobManifest(BaseModel):
    job_id: str
    status: JobStatus
    progress_phase: ProgressPhase
    error: str | None = None
    created_at: str
    updated_at: str
    source_video: SourceVideoRecord
    transcript_text: str | None = None
    language: str | None = None
    clips: list[ClipRecord] = Field(default_factory=list)
    timeline: list[TimelineBin] = Field(default_factory=list)
    summary: JobSummary | None = None
    processing_timings: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    processing_stats: ProcessingStats = Field(default_factory=ProcessingStats)
