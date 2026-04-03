import { describe, expect, it } from "vitest";

import {
  estimateBatchUploadEta,
  formatUploadEta,
  formatUploadEtaBasis,
  isLowConfidenceUploadEta,
} from "./batch-upload-eta";
import type { BatchUploadItemRecord } from "./types";

function createItem(
  overrides: Partial<BatchUploadItemRecord> & Pick<BatchUploadItemRecord, "id" | "fileName" | "status">
): BatchUploadItemRecord {
  return {
    id: overrides.id,
    fileName: overrides.fileName,
    sizeBytes: overrides.sizeBytes ?? 100 * 1024 * 1024,
    jobId: overrides.jobId ?? null,
    status: overrides.status,
    uploadPhase: overrides.uploadPhase ?? "queued",
    uploadProgress: overrides.uploadProgress ?? 0,
    error: overrides.error ?? null,
    updatedAt: overrides.updatedAt ?? "2026-04-03T05:00:00.000Z",
  };
}

describe("batch-upload-eta", () => {
  it("estimates the active source and full queue from the live transfer rate", () => {
    const items = [
      createItem({
        id: "source-1",
        fileName: "alpha.mp4",
        status: "uploading",
        uploadPhase: "transferring",
        uploadProgress: 50,
      }),
      createItem({
        id: "source-2",
        fileName: "beta.mp4",
        status: "queued",
      }),
    ];

    expect(
      estimateBatchUploadEta({
        items,
        activeItemId: "source-1",
        uploadPhase: "transferring",
        uploadStats: {
          loaded: 50 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          percentage: 50,
        },
        nowMs: 30_000,
        sourceStartedAtByItemId: {
          "source-1": 20_000,
        },
        completedSourceDurationsMsByItemId: {},
      })
    ).toEqual({
      currentSourceSeconds: 10,
      currentSourceBasis: "live",
      currentSourceHistorySampleCount: null,
      queueSeconds: 30,
      queueBasis: "live",
      queueHistorySampleCount: null,
    });
  });

  it("uses completed uploads to estimate later sources before transfer bytes arrive", () => {
    const items = [
      createItem({
        id: "source-1",
        fileName: "alpha.mp4",
        status: "processing",
        uploadPhase: "complete",
        uploadProgress: 100,
      }),
      createItem({
        id: "source-2",
        fileName: "beta.mp4",
        sizeBytes: 150 * 1024 * 1024,
        status: "uploading",
        uploadPhase: "validating",
      }),
      createItem({
        id: "source-3",
        fileName: "gamma.mp4",
        sizeBytes: 50 * 1024 * 1024,
        status: "queued",
      }),
    ];

    expect(
      estimateBatchUploadEta({
        items,
        activeItemId: "source-2",
        uploadPhase: "validating",
        uploadStats: {
          loaded: 0,
          total: 150 * 1024 * 1024,
          percentage: 0,
        },
        nowMs: 30_000,
        sourceStartedAtByItemId: {
          "source-2": 28_000,
        },
        completedSourceDurationsMsByItemId: {
          "source-1": 20_000,
        },
      })
    ).toEqual({
      currentSourceSeconds: 30,
      currentSourceBasis: "history",
      currentSourceHistorySampleCount: 1,
      queueSeconds: 40,
      queueBasis: "history",
      queueHistorySampleCount: 1,
    });
  });

  it("marks the queue ETA as mixed when the active source is live but later sources use completed uploads", () => {
    const items = [
      createItem({
        id: "source-1",
        fileName: "alpha.mp4",
        status: "processing",
        uploadPhase: "complete",
        uploadProgress: 100,
      }),
      createItem({
        id: "source-2",
        fileName: "beta.mp4",
        status: "uploading",
        uploadPhase: "transferring",
        uploadProgress: 50,
      }),
      createItem({
        id: "source-3",
        fileName: "gamma.mp4",
        sizeBytes: 50 * 1024 * 1024,
        status: "queued",
      }),
    ];

    expect(
      estimateBatchUploadEta({
        items,
        activeItemId: "source-2",
        uploadPhase: "transferring",
        uploadStats: {
          loaded: 50 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          percentage: 50,
        },
        nowMs: 30_000,
        sourceStartedAtByItemId: {
          "source-2": 20_000,
        },
        completedSourceDurationsMsByItemId: {
          "source-1": 40_000,
        },
      })
    ).toEqual({
      currentSourceSeconds: 10,
      currentSourceBasis: "live",
      currentSourceHistorySampleCount: null,
      queueSeconds: 30,
      queueBasis: "mixed",
      queueHistorySampleCount: 1,
    });
  });

  it("stays in estimating mode until the first queue has enough signal", () => {
    const items = [
      createItem({
        id: "source-1",
        fileName: "alpha.mp4",
        status: "uploading",
        uploadPhase: "validating",
      }),
      createItem({
        id: "source-2",
        fileName: "beta.mp4",
        status: "queued",
      }),
    ];

    expect(
      estimateBatchUploadEta({
        items,
        activeItemId: "source-1",
        uploadPhase: "validating",
        uploadStats: {
          loaded: 0,
          total: 100 * 1024 * 1024,
          percentage: 0,
        },
        nowMs: 10_000,
        sourceStartedAtByItemId: {
          "source-1": 9_500,
        },
        completedSourceDurationsMsByItemId: {},
      })
    ).toEqual({
      currentSourceSeconds: null,
      currentSourceBasis: null,
      currentSourceHistorySampleCount: null,
      queueSeconds: null,
      queueBasis: null,
      queueHistorySampleCount: null,
    });
  });

  it("formats ETA labels for the queue card", () => {
    expect(formatUploadEta(125)).toBe("~2:05");
    expect(formatUploadEta(null)).toBe("Estimating");
    expect(formatUploadEtaBasis("live")).toBe("Live transfer rate");
    expect(formatUploadEtaBasis("history")).toBe("Completed upload history");
    expect(formatUploadEtaBasis("history", 1)).toBe("Completed upload history · 1 completed source · Low confidence");
    expect(formatUploadEtaBasis("history", 3)).toBe("Completed upload history · 3 completed sources");
    expect(formatUploadEtaBasis("mixed")).toBe("Live + completed uploads");
    expect(formatUploadEtaBasis("mixed", 1)).toBe("Live + completed uploads · 1 completed source · Low confidence");
    expect(formatUploadEtaBasis("mixed", 2)).toBe("Live + completed uploads · 2 completed sources");
    expect(formatUploadEtaBasis(null)).toBeNull();
  });

  it("flags single-sample history estimates as low confidence", () => {
    expect(isLowConfidenceUploadEta("live", 1)).toBe(false);
    expect(isLowConfidenceUploadEta("history", 1)).toBe(true);
    expect(isLowConfidenceUploadEta("mixed", 1)).toBe(true);
    expect(isLowConfidenceUploadEta("history", 2)).toBe(false);
    expect(isLowConfidenceUploadEta(null, 1)).toBe(false);
  });
});
