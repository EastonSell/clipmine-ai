import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateUploadProgress,
  ApiError,
  buildApiError,
  getApiBaseUrl,
  getJob,
  isRetryableApiError,
  resetApiBaseUrlMemory,
  resolveUploadMode,
} from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  resetApiBaseUrlMemory();
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

describe("api upload helpers", () => {
  it("resolves upload mode safely", () => {
    expect(resolveUploadMode(undefined)).toBe("direct");
    expect(resolveUploadMode("direct")).toBe("direct");
    expect(resolveUploadMode("multipart")).toBe("multipart");
    expect(resolveUploadMode("MULTIPART")).toBe("multipart");
    expect(resolveUploadMode("unknown")).toBe("direct");
  });

  it("aggregates upload progress and caps loaded bytes", () => {
    expect(aggregateUploadProgress([4, 8], 20)).toEqual({
      loaded: 12,
      total: 20,
      percentage: 60,
    });

    expect(aggregateUploadProgress([10, 20, 30], 40)).toEqual({
      loaded: 40,
      total: 40,
      percentage: 100,
    });
  });

  it("maps backend error codes into plain-language api errors", () => {
    const error = buildApiError(
      {
        code: "object_store_unavailable",
        message: "Storage backend missing",
        retryable: true,
      },
      503
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("object_store_unavailable");
    expect(error.message).toBe("Upload storage is unavailable right now. Try again in a moment.");
    expect(error.retryable).toBe(true);
    expect(isRetryableApiError(error)).toBe(true);
  });

  it("maps export selection errors into plain language", () => {
    const error = buildApiError(
      {
        code: "export_selection_required",
        message: "Need clip ids",
        retryable: false,
      },
      400
    );

    expect(error.code).toBe("export_selection_required");
    expect(error.message).toBe("Select at least one clip before downloading a package.");
    expect(error.retryable).toBe(false);
  });

  it("preserves invalid clip selection details from the backend", () => {
    const error = buildApiError(
      {
        code: "invalid_clip_selection",
        message: "Unknown clip ids for this job: clip-999",
        retryable: false,
      },
      400
    );

    expect(error.message).toBe("Unknown clip ids for this job: clip-999");
  });

  it("treats unknown values as non-retryable only when they are not api errors", () => {
    const error = buildApiError("Something custom happened.", 400);

    expect(error.code).toBe("request_failed");
    expect(error.message).toBe("Something custom happened.");
    expect(error.retryable).toBe(false);
    expect(isRetryableApiError(new Error("nope"))).toBe(false);
  });

  it("remembers the successful fallback api base url for asset links", async () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
      },
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connect ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job-fallback",
            status: "ready",
            progressPhase: "ready",
            error: null,
            sourceVideo: {
              id: "job-fallback",
              file_name: "sample.mp4",
              content_type: "video/mp4",
              size_bytes: 128,
              duration_seconds: 1.2,
              url: "/api/jobs/job-fallback/video",
            },
            summary: null,
            clips: [],
            timeline: [],
            language: "en",
            processingTimings: {},
            warnings: [],
            processingStats: {
              source_duration_seconds: 1.2,
              transcript_word_count: 0,
              candidate_clip_count: 0,
              discarded_candidate_count: 0,
              deduped_candidate_count: 0,
              shortlist_recommended_count: 0,
              clip_count: 0,
              timeline_bin_count: 0,
            },
            createdAt: "2026-04-02T12:00:00.000Z",
            updatedAt: "2026-04-02T12:00:00.000Z",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    await getJob("job-fallback");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/api/jobs/job-fallback",
      { cache: "no-store" }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/jobs/job-fallback",
      { cache: "no-store" }
    );
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000");
  });
});
