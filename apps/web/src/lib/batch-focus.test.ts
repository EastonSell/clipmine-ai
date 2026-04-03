import { describe, expect, it } from "vitest";

import {
  BATCH_QUALITY_THRESHOLD_PRESETS,
  DEFAULT_BATCH_QUALITY_THRESHOLD,
  getBatchWorkspaceHref,
  getOrderedBatchItems,
  getPreferredBatchJobId,
  getReadyBatchJobNavigation,
  getReadyBatchJobShortcutDirection,
  hasBatchIssues,
  isBatchIssueItem,
  parseBatchQualityThreshold,
  parseBatchSelectedJobId,
  parseBatchSelectedPreset,
  parseBatchTriageState,
} from "./batch-focus";
import type { BatchUploadItemRecord } from "./types";

function createItem(
  overrides: Partial<BatchUploadItemRecord> & Pick<BatchUploadItemRecord, "id" | "fileName" | "status">
): BatchUploadItemRecord {
  return {
    id: overrides.id,
    fileName: overrides.fileName,
    sizeBytes: 1_024,
    jobId: overrides.jobId ?? null,
    status: overrides.status,
    uploadPhase: overrides.uploadPhase ?? "complete",
    uploadProgress: overrides.uploadProgress ?? 100,
    error: overrides.error ?? null,
    updatedAt: overrides.updatedAt ?? "2026-04-03T01:00:00.000Z",
  };
}

describe("batch-focus", () => {
  it("defines shared batch threshold quick presets around the default floor", () => {
    expect(BATCH_QUALITY_THRESHOLD_PRESETS.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Strict", value: 92 },
      { label: "Balanced", value: DEFAULT_BATCH_QUALITY_THRESHOLD },
      { label: "Broad", value: 72 },
    ]);
  });

  it("parses the saved batch triage state from search params", () => {
    expect(parseBatchTriageState("issues", undefined)).toEqual({
      prioritizeIssues: true,
      issuesOnly: true,
    });
    expect(parseBatchTriageState("issues", "all")).toEqual({
      prioritizeIssues: true,
      issuesOnly: false,
    });
    expect(parseBatchTriageState(undefined, "all")).toEqual({
      prioritizeIssues: false,
      issuesOnly: false,
    });
  });

  it("builds batch workspace links that preserve the current triage scope", () => {
    expect(
      getBatchWorkspaceHref("saved-batch-failures", {
        prioritizeIssues: false,
        issuesOnly: false,
      })
    ).toBe("/batches/saved-batch-failures");

    expect(
      getBatchWorkspaceHref(
        "saved-batch-failures",
        {
          prioritizeIssues: true,
          issuesOnly: true,
        },
        "#batch-queue"
      )
    ).toBe("/batches/saved-batch-failures?focus=issues#batch-queue");

    expect(
      getBatchWorkspaceHref(
        "saved-batch-failures",
        {
          prioritizeIssues: true,
          issuesOnly: false,
          selectedJobId: "job-alpha",
          selectedPreset: "audio-only",
          selectedQualityThreshold: 90,
        },
        "#batch-queue"
      )
    ).toBe("/batches/saved-batch-failures?focus=issues&scope=all&job=job-alpha&preset=audio-only&threshold=90#batch-queue");
  });

  it("normalizes the selected batch job id from search params", () => {
    expect(parseBatchSelectedJobId("job-alpha")).toBe("job-alpha");
    expect(parseBatchSelectedJobId("   job-beta   ")).toBe("job-beta");
    expect(parseBatchSelectedJobId("")).toBeNull();
    expect(parseBatchSelectedJobId(undefined)).toBeNull();
  });

  it("normalizes the selected batch export preset from search params", () => {
    expect(parseBatchSelectedPreset("full-av")).toBe("full-av");
    expect(parseBatchSelectedPreset("audio-only")).toBe("audio-only");
    expect(parseBatchSelectedPreset("metadata-only")).toBe("metadata-only");
    expect(parseBatchSelectedPreset("unknown")).toBeNull();
    expect(parseBatchSelectedPreset(undefined)).toBeNull();
  });

  it("normalizes the selected batch quality threshold from search params", () => {
    expect(parseBatchQualityThreshold("84")).toBe(84);
    expect(parseBatchQualityThreshold(" 90 ")).toBe(90);
    expect(parseBatchQualityThreshold("49")).toBeNull();
    expect(parseBatchQualityThreshold("101")).toBeNull();
    expect(parseBatchQualityThreshold("90.5")).toBeNull();
    expect(parseBatchQualityThreshold("bad")).toBeNull();
    expect(parseBatchQualityThreshold(undefined)).toBeNull();
  });

  it("pins failed and cancelled sources to the front when issue focus is enabled", () => {
    const items = [
      createItem({ id: "ready-1", fileName: "alpha.mp4", status: "ready", jobId: "job-alpha" }),
      createItem({ id: "failed-1", fileName: "broken-intro.mov", status: "failed", error: "Upload failed." }),
      createItem({ id: "processing-1", fileName: "gamma.mp4", status: "processing", jobId: "job-gamma" }),
      createItem({ id: "cancelled-1", fileName: "retake.mp4", status: "cancelled", error: "Queue cancelled." }),
    ];

    expect(getOrderedBatchItems(items, true).map((item) => item.fileName)).toEqual([
      "broken-intro.mov",
      "retake.mp4",
      "alpha.mp4",
      "gamma.mp4",
    ]);
    expect(getOrderedBatchItems(items, false).map((item) => item.fileName)).toEqual([
      "alpha.mp4",
      "broken-intro.mov",
      "gamma.mp4",
      "retake.mp4",
    ]);
  });

  it("can collapse the queue to only failed and cancelled sources", () => {
    const items = [
      createItem({ id: "ready-1", fileName: "alpha.mp4", status: "ready", jobId: "job-alpha" }),
      createItem({ id: "failed-1", fileName: "broken-intro.mov", status: "failed", error: "Upload failed." }),
      createItem({ id: "processing-1", fileName: "gamma.mp4", status: "processing", jobId: "job-gamma" }),
      createItem({ id: "cancelled-1", fileName: "retake.mp4", status: "cancelled", error: "Queue cancelled." }),
    ];

    expect(getOrderedBatchItems(items, true, true).map((item) => item.fileName)).toEqual([
      "broken-intro.mov",
      "retake.mp4",
    ]);
    expect(items.filter(isBatchIssueItem).map((item) => item.fileName)).toEqual([
      "broken-intro.mov",
      "retake.mp4",
    ]);
  });

  it("prefers the first available job after issue ordering is applied", () => {
    const items = [
      createItem({ id: "cancelled-1", fileName: "retake.mp4", status: "cancelled", error: "Queue cancelled." }),
      createItem({ id: "ready-1", fileName: "alpha.mp4", status: "ready", jobId: "job-alpha" }),
      createItem({ id: "failed-1", fileName: "broken-intro.mov", status: "failed", jobId: "job-broken", error: "Processing failed." }),
    ];

    expect(getPreferredBatchJobId(items, true)).toBe("job-broken");
    expect(getPreferredBatchJobId(items, false)).toBe("job-alpha");
  });

  it("returns previous and next ready jobs from the current visible queue order", () => {
    const items = [
      createItem({ id: "ready-1", fileName: "alpha.mp4", status: "ready", jobId: "job-alpha" }),
      createItem({ id: "failed-1", fileName: "broken-intro.mov", status: "failed", error: "Upload failed." }),
      createItem({ id: "ready-2", fileName: "beta.mp4", status: "ready", jobId: "job-beta" }),
      createItem({ id: "processing-1", fileName: "gamma.mp4", status: "processing", jobId: "job-gamma" }),
      createItem({ id: "ready-3", fileName: "delta.mp4", status: "ready", jobId: "job-delta" }),
    ];

    expect(getReadyBatchJobNavigation(items, "job-beta")).toEqual({
      jobIds: ["job-alpha", "job-beta", "job-delta"],
      currentIndex: 1,
      firstJobId: "job-alpha",
      lastJobId: "job-delta",
      previousJobId: "job-alpha",
      nextJobId: "job-delta",
    });
    expect(getReadyBatchJobNavigation(items, "job-gamma")).toEqual({
      jobIds: ["job-alpha", "job-beta", "job-delta"],
      currentIndex: -1,
      firstJobId: "job-alpha",
      lastJobId: "job-delta",
      previousJobId: null,
      nextJobId: null,
    });
  });

  it("maps ready-source keyboard shortcuts and ignores text-entry targets", () => {
    expect(
      getReadyBatchJobShortcutDirection({
        key: "[",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      })
    ).toBe("previous");

    expect(
      getReadyBatchJobShortcutDirection({
        key: "]",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      })
    ).toBe("next");

    expect(
      getReadyBatchJobShortcutDirection({
        key: "]",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        targetTagName: "input",
      })
    ).toBeNull();

    expect(
      getReadyBatchJobShortcutDirection({
        key: "[",
        altKey: false,
        ctrlKey: true,
        metaKey: false,
      })
    ).toBeNull();
  });

  it("detects whether a saved batch has issue items", () => {
    expect(
      hasBatchIssues([
        createItem({ id: "ready-1", fileName: "alpha.mp4", status: "ready", jobId: "job-alpha" }),
        createItem({ id: "processing-1", fileName: "beta.mp4", status: "processing", jobId: "job-beta" }),
      ])
    ).toBe(false);

    expect(
      hasBatchIssues([
        createItem({ id: "failed-1", fileName: "broken-intro.mov", status: "failed", error: "Upload failed." }),
      ])
    ).toBe(true);
  });
});
