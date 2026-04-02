import { describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_FILTERS,
  filterAndSortClips,
  hasActiveReviewFilters,
  parseReviewFilters,
  parseWorkspaceTab,
  serializeReviewFilters,
} from "./review-state";
import type { ClipRecord } from "./types";

const baseClip: ClipRecord = {
  id: "clip-1",
  text: "Keep the transcript clean",
  start: 2,
  end: 4,
  duration: 2,
  confidence: 0.92,
  speech_rate: 2.8,
  energy: 0.78,
  silence_ratio: 0.08,
  instability: 0.12,
  score: 88,
  quality_label: "Excellent",
  explanation: "High confidence and stable pacing.",
  source_video_id: "video-1",
  playback: {
    url: "/api/jobs/job-1/video",
    start: 2,
    end: 4,
  },
  audio_features: {
    volume: { value: 0.78, normalized: 0.78 },
    speech_rate: { value: 2.8, normalized: 0.68 },
    snr: { value: 0.81, normalized: 0.81 },
    spectral: {
      centroid_hz: { value: 1800, normalized: 0.52 },
      bandwidth_hz: { value: 1300, normalized: 0.46 },
      rolloff_hz: { value: 3400, normalized: 0.63 },
      flatness: { value: 0.12, normalized: 0.12 },
      zero_crossing_rate: { value: 0.06, normalized: 0.06 },
    },
  },
  linguistic_features: {
    word_count: 4,
    lexical_diversity: 1,
    filler_word_count: 0,
    filler_words: [],
    pos_distribution: { noun: 0.25, verb: 0.25 },
  },
  word_alignments: [
    { token: "Keep", start: 2, end: 2.3, confidence: 0.95 },
    { token: "clean", start: 3.4, end: 3.9, confidence: 0.91 },
  ],
  visual_features: {
    sampled_frame_count: 12,
    face_detection: { value: 0.94, normalized: 0.94 },
    mouth_movement: { value: 0.76, normalized: 0.76 },
    visibility: { value: 0.91, normalized: 0.91 },
  },
  quality_breakdown: {
    transcription_confidence: 0.92,
    pacing: 0.76,
    acoustic_signal: 0.81,
    continuity: 0.88,
    stability: 0.83,
    linguistic_clarity: 0.74,
    visual_readiness: 0.79,
    boundary_cleanliness: 0.9,
    speech_density: 0.82,
    dedupe_confidence: 0.96,
    overall: 0.88,
  },
  quality_reasoning: {
    summary: "Stable, clean, and training-ready.",
    strengths: ["High confidence"],
    cautions: [],
  },
  candidate_metrics: {
    pause_count: 0,
    max_gap_seconds: 0.08,
    speech_density: 0.82,
    low_confidence_ratio: 0,
    leading_filler_ratio: 0,
    trailing_filler_ratio: 0,
    boundary_punctuation_strength: 1,
  },
  selection_recommendation: "shortlist",
  quality_penalties: [],
  tags: ["training-ready", "clear-speech"],
  recommended_use: ["speech-annotation"],
  embedding_vector: null,
};

const clips: ClipRecord[] = [
  baseClip,
  {
    ...baseClip,
    id: "clip-2",
    text: "Add a little context before the label.",
    explanation: "Slightly slower pace but still useful.",
    start: 5,
    end: 8,
    duration: 3,
    confidence: 0.84,
    score: 71,
    speech_rate: 2.1,
    quality_label: "Good",
    tags: ["contextual"],
    quality_breakdown: {
      ...baseClip.quality_breakdown,
      boundary_cleanliness: 0.74,
      speech_density: 0.71,
      dedupe_confidence: 0.91,
      overall: 0.71,
    },
    candidate_metrics: {
      ...baseClip.candidate_metrics,
      pause_count: 1,
      max_gap_seconds: 0.21,
      speech_density: 0.71,
      boundary_punctuation_strength: 0.6,
    },
    selection_recommendation: "review",
    quality_penalties: ["boundary_messy"],
  },
  {
    ...baseClip,
    id: "clip-3",
    text: "Um this one is weaker.",
    explanation: "Lower confidence and filler-heavy speech.",
    start: 11,
    end: 13,
    confidence: 0.45,
    score: 32,
    speech_rate: 4.8,
    quality_label: "Weak",
    tags: ["filler-heavy"],
    linguistic_features: {
      ...baseClip.linguistic_features,
      filler_word_count: 1,
      filler_words: ["um"],
    },
    quality_breakdown: {
      ...baseClip.quality_breakdown,
      boundary_cleanliness: 0.36,
      speech_density: 0.46,
      dedupe_confidence: 0.62,
      overall: 0.32,
    },
    candidate_metrics: {
      ...baseClip.candidate_metrics,
      pause_count: 2,
      max_gap_seconds: 0.34,
      speech_density: 0.46,
      low_confidence_ratio: 0.42,
      leading_filler_ratio: 0.25,
      boundary_punctuation_strength: 0.2,
    },
    selection_recommendation: "discard",
    quality_penalties: ["filler_heavy", "low_confidence_span"],
  },
];

describe("review-state", () => {
  it("parses tab values safely", () => {
    expect(parseWorkspaceTab("timeline")).toBe("timeline");
    expect(parseWorkspaceTab("export")).toBe("export");
    expect(parseWorkspaceTab("unknown")).toBe("clips");
    expect(parseWorkspaceTab(null)).toBe("clips");
  });

  it("parses query params into review filters", () => {
    const filters = parseReviewFilters(
      new URLSearchParams(
        "q=clean&quality=Excellent&tag=training-ready&recommendation=shortlist&sort=duration&pinned=1&ready=1"
      )
    );

    expect(filters).toEqual({
      query: "clean",
      quality: "Excellent",
      tag: "training-ready",
      recommendation: "shortlist",
      sort: "duration",
      pinnedOnly: true,
      shortlistReadyOnly: true,
    });
  });

  it("filters and sorts clips by search, recommendation, signal, and sort order", () => {
    const byScore = filterAndSortClips(clips, DEFAULT_REVIEW_FILTERS);
    expect(byScore.map((clip) => clip.id)).toEqual(["clip-1", "clip-2", "clip-3"]);

    const filtered = filterAndSortClips(clips, {
      query: "label",
      quality: "Good",
      tag: "boundary_messy",
      recommendation: "review",
      sort: "start",
      pinnedOnly: false,
      shortlistReadyOnly: false,
    });

    expect(filtered.map((clip) => clip.id)).toEqual(["clip-2"]);
  });

  it("can isolate shortlist-ready clips", () => {
    const filtered = filterAndSortClips(clips, {
      ...DEFAULT_REVIEW_FILTERS,
      shortlistReadyOnly: true,
    });

    expect(filtered.map((clip) => clip.id)).toEqual(["clip-1"]);
  });

  it("tracks whether review filters are active", () => {
    expect(hasActiveReviewFilters(DEFAULT_REVIEW_FILTERS)).toBe(false);
    expect(
      hasActiveReviewFilters({
        ...DEFAULT_REVIEW_FILTERS,
        pinnedOnly: true,
      })
    ).toBe(true);
    expect(
      hasActiveReviewFilters({
        ...DEFAULT_REVIEW_FILTERS,
        recommendation: "review",
      })
    ).toBe(true);
  });

  it("serializes filters back into clean query params", () => {
    const params = serializeReviewFilters(new URLSearchParams("tab=timeline"), {
      query: "clean speech",
      quality: "Good",
      tag: "duplicate-risk",
      recommendation: "review",
      sort: "confidence",
      pinnedOnly: true,
      shortlistReadyOnly: true,
    });

    expect(params.toString()).toBe(
      "tab=timeline&q=clean+speech&quality=Good&tag=duplicate-risk&recommendation=review&sort=confidence&pinned=1&ready=1"
    );
  });
});
