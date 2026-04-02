from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


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

