export type UploadJobResponse = {
  jobId: string;
  status: string;
  fileName: string;
};

export type UploadMode = "direct" | "multipart";
export type UploadPhase = "validating" | "transferring" | "finalizing" | "processing";

export type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export type ApiErrorDetail = {
  code: string;
  message: string;
  retryable: boolean;
};

export type UploadPartDescriptor = {
  partNumber: number;
  url: string;
};

export type UploadInitResponse = {
  uploadSessionId: string;
  jobId: string;
  fileName: string;
  partSizeBytes: number;
  expiresAt: string;
  parts: UploadPartDescriptor[];
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

export type ScalarFeature = {
  value: number;
  normalized: number;
};

export type AudioFeatures = {
  volume: ScalarFeature;
  speech_rate: ScalarFeature;
  snr: ScalarFeature;
  spectral: {
    centroid_hz: ScalarFeature;
    bandwidth_hz: ScalarFeature;
    rolloff_hz: ScalarFeature;
    flatness: ScalarFeature;
    zero_crossing_rate: ScalarFeature;
  };
};

export type LinguisticFeatures = {
  word_count: number;
  lexical_diversity: number;
  filler_word_count: number;
  filler_words: string[];
  pos_distribution: Record<string, number>;
};

export type WordAlignment = {
  token: string;
  start: number;
  end: number;
  confidence: number;
};

export type VisualFeatures = {
  sampled_frame_count: number;
  face_detection: ScalarFeature;
  mouth_movement: ScalarFeature;
  visibility: ScalarFeature;
};

export type QualityBreakdown = {
  transcription_confidence: number;
  pacing: number;
  acoustic_signal: number;
  continuity: number;
  stability: number;
  linguistic_clarity: number;
  visual_readiness: number;
  boundary_cleanliness: number;
  speech_density: number;
  dedupe_confidence: number;
  overall: number;
};

export type CandidateMetrics = {
  pause_count: number;
  max_gap_seconds: number;
  speech_density: number;
  low_confidence_ratio: number;
  leading_filler_ratio: number;
  trailing_filler_ratio: number;
  boundary_punctuation_strength: number;
};

export type SelectionRecommendation = "shortlist" | "review" | "discard";

export type QualityReasoning = {
  summary: string;
  strengths: string[];
  cautions: string[];
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
  audio_features: AudioFeatures;
  linguistic_features: LinguisticFeatures;
  word_alignments: WordAlignment[];
  visual_features: VisualFeatures;
  quality_breakdown: QualityBreakdown;
  quality_reasoning: QualityReasoning;
  candidate_metrics: CandidateMetrics;
  selection_recommendation: SelectionRecommendation;
  quality_penalties: string[];
  tags: string[];
  recommended_use: string[];
  embedding_vector: number[] | null;
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
  shortlist_recommended_count: number;
};

export type ProcessingStats = {
  source_duration_seconds: number;
  transcript_word_count: number;
  candidate_clip_count: number;
  discarded_candidate_count: number;
  deduped_candidate_count: number;
  shortlist_recommended_count: number;
  clip_count: number;
  timeline_bin_count: number;
};

export type RecentJobRecord = {
  jobId: string;
  fileName: string;
  updatedAt: string;
  clipCount: number;
  topScore: number;
  durationSeconds: number;
  language: string | null;
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
  processingTimings: Record<string, number>;
  warnings: string[];
  processingStats: ProcessingStats;
  createdAt: string;
  updatedAt: string;
};
