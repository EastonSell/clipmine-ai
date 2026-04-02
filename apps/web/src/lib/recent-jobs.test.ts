import { describe, expect, it } from "vitest";

import { loadRecentJobs, loadShortlist, saveRecentJob, saveShortlist } from "./recent-jobs";
import type { JobResponse } from "./types";

function createStorage() {
  const state = new Map<string, string>();

  return {
    getItem(key: string) {
      return state.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      state.set(key, value);
    },
    removeItem(key: string) {
      state.delete(key);
    },
  };
}

function createJob(overrides: Partial<JobResponse> = {}): JobResponse {
  return {
    jobId: "job-1",
    status: "ready",
    progressPhase: "ready",
    error: null,
    sourceVideo: {
      id: "video-1",
      file_name: "sample.mp4",
      content_type: "video/mp4",
      size_bytes: 1024,
      duration_seconds: 12,
      url: "/api/jobs/job-1/video",
    },
    summary: {
      duration_seconds: 12,
      transcript_preview: "Short preview",
      clip_count: 2,
      excellent_count: 1,
      good_count: 1,
      weak_count: 0,
      average_score: 79.5,
      top_score: 88,
    },
    clips: [],
    timeline: [],
    language: "en",
    processingTimings: { total: 8.4 },
    warnings: [],
    processingStats: {
      source_duration_seconds: 12,
      transcript_word_count: 18,
      candidate_clip_count: 4,
      clip_count: 2,
      timeline_bin_count: 48,
    },
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:10:00.000Z",
    ...overrides,
  };
}

describe("recent-jobs", () => {
  it("stores successful jobs in newest-first order", () => {
    const storage = createStorage();

    saveRecentJob(createJob(), storage);
    const records = saveRecentJob(
      createJob({
        jobId: "job-2",
        sourceVideo: {
          id: "video-2",
          file_name: "newer.mp4",
          content_type: "video/mp4",
          size_bytes: 2048,
          duration_seconds: 24,
          url: "/api/jobs/job-2/video",
        },
        updatedAt: "2026-04-01T12:20:00.000Z",
      }),
      storage
    );

    expect(records.map((record) => record.jobId)).toEqual(["job-2", "job-1"]);
    expect(loadRecentJobs(storage)[0]?.fileName).toBe("newer.mp4");
  });

  it("ignores incomplete jobs when saving recents", () => {
    const storage = createStorage();

    const records = saveRecentJob(
      createJob({
        status: "processing",
        progressPhase: "transcribing",
        summary: null,
      }),
      storage
    );

    expect(records).toEqual([]);
    expect(loadRecentJobs(storage)).toEqual([]);
  });

  it("normalizes shortlist values and clears the key when empty", () => {
    const storage = createStorage();

    const saved = saveShortlist("job-1", ["clip-1", "clip-2", "clip-1"], storage);
    expect(saved).toEqual(["clip-1", "clip-2"]);
    expect(loadShortlist("job-1", storage)).toEqual(["clip-1", "clip-2"]);

    expect(saveShortlist("job-1", [], storage)).toEqual([]);
    expect(loadShortlist("job-1", storage)).toEqual([]);
  });
});
