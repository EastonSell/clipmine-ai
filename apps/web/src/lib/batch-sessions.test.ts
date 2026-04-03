import { describe, expect, it } from "vitest";

import {
  loadBatchSession,
  loadBatchSessions,
  loadLatestCompletedBatchSession,
  removeBatchSession,
  saveBatchSession,
} from "./batch-sessions";
import type { BatchCompletionSummary, BatchSessionRecord } from "./types";

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

const BATCH_SESSIONS_KEY = "clipmine:batches:v1";

function createBatchSession(overrides: Partial<BatchSessionRecord> = {}): BatchSessionRecord {
  return {
    batchId: "batch-1",
    label: "2 sources queued",
    createdAt: "2026-04-02T12:00:00.000Z",
    updatedAt: "2026-04-02T12:00:00.000Z",
    qualityThreshold: 84,
    items: [
      {
        id: "upload-1",
        fileName: "alpha.mp4",
        sizeBytes: 1024,
        jobId: "job-alpha",
        status: "ready",
        uploadPhase: "complete",
        uploadProgress: 100,
        error: null,
        updatedAt: "2026-04-02T12:10:00.000Z",
      },
    ],
    ...overrides,
  };
}

function createCompletionSummary(overrides: Partial<BatchCompletionSummary> = {}): BatchCompletionSummary {
  return {
    batchId: "batch-1",
    label: "2 sources queued",
    finishedAt: "2026-04-02T12:12:00.000Z",
    totalSources: 2,
    readyCount: 2,
    failedCount: 0,
    cancelledCount: 0,
    ...overrides,
  };
}

describe("batch-sessions", () => {
  it("stores batches newest first and reloads an individual session", () => {
    const storage = createStorage();

    saveBatchSession(createBatchSession(), storage);
    saveBatchSession(
      createBatchSession({
        batchId: "batch-2",
        label: "3 sources queued",
        updatedAt: "2026-04-02T12:20:00.000Z",
      }),
      storage
    );

    expect(loadBatchSessions(storage).map((session) => session.batchId)).toEqual(["batch-2", "batch-1"]);
    expect(loadBatchSession("batch-1", storage)?.label).toBe("2 sources queued");
  });

  it("removes saved sessions cleanly", () => {
    const storage = createStorage();
    saveBatchSession(createBatchSession(), storage);

    expect(removeBatchSession("batch-1", storage)).toEqual([]);
    expect(loadBatchSession("batch-1", storage)).toBeNull();
  });

  it("preserves the latest completion summary when sessions reload", () => {
    const storage = createStorage();
    saveBatchSession(
      createBatchSession({
        lastCompletionSummary: createCompletionSummary(),
      }),
      storage
    );

    expect(loadBatchSession("batch-1", storage)?.lastCompletionSummary).toEqual(createCompletionSummary());
  });

  it("returns the newest completed batch session with a reusable workspace", () => {
    const storage = createStorage();

    storage.setItem(
      BATCH_SESSIONS_KEY,
      JSON.stringify([
        createBatchSession({
          batchId: "batch-3",
          updatedAt: "2026-04-02T12:30:00.000Z",
          lastCompletionSummary: createCompletionSummary({
            batchId: "batch-3",
            finishedAt: "2026-04-02T12:30:00.000Z",
            readyCount: 1,
          }),
        }),
        createBatchSession({
          batchId: "batch-2",
          updatedAt: "2026-04-02T12:20:00.000Z",
        }),
        createBatchSession({
          batchId: "batch-1",
          updatedAt: "2026-04-02T12:10:00.000Z",
          lastCompletionSummary: createCompletionSummary({
            batchId: "batch-1",
            finishedAt: "2026-04-02T12:10:00.000Z",
            readyCount: 2,
          }),
        }),
      ])
    );

    expect(loadLatestCompletedBatchSession(storage)?.batchId).toBe("batch-3");
  });

  it("ignores completed-session summaries that cannot reopen any workspace", () => {
    const storage = createStorage();

    storage.setItem(
      BATCH_SESSIONS_KEY,
      JSON.stringify([
        createBatchSession({
          batchId: "batch-empty",
          lastCompletionSummary: createCompletionSummary({
            batchId: "batch-empty",
            readyCount: 0,
            failedCount: 2,
          }),
        }),
      ])
    );

    expect(loadLatestCompletedBatchSession(storage)).toBeNull();
  });
});
