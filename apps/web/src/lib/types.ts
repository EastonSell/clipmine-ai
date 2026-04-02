export type UploadJobResponse = {
  jobId: string;
  status: string;
  fileName: string;
};

export type SourceVideo = {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  url: string;
};

export type PlaybackMetadata = {
  url: string;
  start: number;
  end: number;
};

export type ClipRecord = {
  id: string;
  text: string;
  start: number;
  end: number;
  duration: number;
  confidence: number;
  speech_rate: number;
  energy: number;
  silence_ratio: number;
  instability: number;
  score: number;
  quality_label: "Excellent" | "Good" | "Weak";
  explanation: string;
  source_video_id: string;
  playback: PlaybackMetadata;
};

export type TimelineBin = {
  start: number;
  end: number;
  score: number;
  quality_label: "Excellent" | "Good" | "Weak";
  top_clip_id: string | null;
};

export type JobSummary = {
  duration_seconds: number;
  transcript_preview: string;
  clip_count: number;
  excellent_count: number;
  good_count: number;
  weak_count: number;
  average_score: number;
  top_score: number;
};

export type JobResponse = {
  jobId: string;
  status: "queued" | "processing" | "ready" | "failed";
  progressPhase:
    | "queued"
    | "extracting_audio"
    | "transcribing"
    | "segmenting"
    | "scoring"
    | "ready"
    | "failed";
  error: string | null;
  sourceVideo: SourceVideo;
  summary: JobSummary | null;
  clips: ClipRecord[];
  timeline: TimelineBin[];
  language: string | null;
  createdAt: string;
  updatedAt: string;
};

