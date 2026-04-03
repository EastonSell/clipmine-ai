import { describe, expect, it } from "vitest";

import { buildBatchQueueGuidance } from "./batch-queue-guidance";
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

describe("batch-queue-guidance", () => {
  it("explains the backlog and missing ETA signal before the first handoff", () => {
    const guidance = buildBatchQueueGuidance({
      items: [
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
          sizeBytes: 2 * 1024 * 1024,
        }),
      ],
      activeItemId: "source-1",
      queueEtaSeconds: null,
      queueEtaBasis: null,
      queueEtaHistorySampleCount: null,
    });

    expect(guidance).toEqual([
      {
        title: "Intake runway",
        emphasis: "1 queued · 2.0 MB waiting",
        description:
          "1 more source stays queued behind alpha.mp4. 2.0 MB still needs to clear intake after this file.",
        tone: "accent",
      },
      {
        title: "Review handoff",
        emphasis: "Review opens after the first handoff",
        description:
          "As soon as one upload finalizes, ClipMine keeps processing it in the background while the queue advances to the next file.",
        tone: "neutral",
      },
      {
        title: "Estimator",
        emphasis: "ETA waiting for enough signal",
        description:
          "ClipMine starts estimating after the current transfer reaches about 8% progress, 4 MB uploaded, and roughly two seconds of elapsed upload time.",
        tone: "neutral",
      },
    ]);
  });

  it("surfaces final-source runway and low-confidence timing after the first handoff", () => {
    const guidance = buildBatchQueueGuidance({
      items: [
        createItem({
          id: "source-1",
          fileName: "alpha.mp4",
          status: "processing",
          uploadPhase: "complete",
          uploadProgress: 100,
          jobId: "job-alpha",
        }),
        createItem({
          id: "source-2",
          fileName: "beta.mp4",
          status: "uploading",
          uploadPhase: "transferring",
          uploadProgress: 42,
        }),
      ],
      activeItemId: "source-2",
      queueEtaSeconds: 75,
      queueEtaBasis: "history",
      queueEtaHistorySampleCount: 1,
    });

    expect(guidance).toEqual([
      {
        title: "Intake runway",
        emphasis: "Final source in intake",
        description: "beta.mp4 is the last intake step. ~1:15 remains before the grouped batch workspace can open.",
        tone: "accent",
      },
      {
        title: "Review handoff",
        emphasis: "1 source already in backend",
        description:
          "Those uploads keep transcribing and scoring while intake continues, so the batch workspace opens with live progress already attached.",
        tone: "neutral",
      },
      {
        title: "Estimator",
        emphasis: "ETA is still low confidence",
        description:
          "The runway currently leans on one completed upload. It should stabilize after the next source finishes transferring.",
        tone: "neutral",
      },
    ]);
  });

  it("prioritizes recovery guidance when sources fail mid-queue", () => {
    const guidance = buildBatchQueueGuidance({
      items: [
        createItem({
          id: "source-1",
          fileName: "alpha.mp4",
          status: "processing",
          uploadPhase: "complete",
          uploadProgress: 100,
          jobId: "job-alpha",
        }),
        createItem({
          id: "source-2",
          fileName: "beta.mp4",
          status: "failed",
          error: "Upload failed",
        }),
        createItem({
          id: "source-3",
          fileName: "gamma.mp4",
          status: "uploading",
          uploadPhase: "transferring",
          uploadProgress: 35,
        }),
      ],
      activeItemId: "source-3",
      queueEtaSeconds: 24,
      queueEtaBasis: "live",
      queueEtaHistorySampleCount: null,
    });

    expect(guidance[2]).toEqual({
      title: "Recovery",
      emphasis: "1 source needs follow-up",
      description:
        "Failed or cancelled sources stay visible in the queue summary, so you can retry them after intake without losing successful uploads.",
      tone: "danger",
    });
  });
});
