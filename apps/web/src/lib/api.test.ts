import { describe, expect, it } from "vitest";

import {
  aggregateUploadProgress,
  ApiError,
  buildApiError,
  isRetryableApiError,
  resolveUploadMode,
} from "./api";

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
});
