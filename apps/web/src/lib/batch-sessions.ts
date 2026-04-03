import type { BatchSessionRecord } from "./types";

const BATCH_SESSIONS_KEY = "clipmine:batches:v1";
const MAX_BATCH_SESSIONS = 8;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadBatchSessions(storage: StorageLike | null = getBrowserStorage()): BatchSessionRecord[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(BATCH_SESSIONS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as BatchSessionRecord[];
    return Array.isArray(parsed) ? parsed.filter(isBatchSessionRecord) : [];
  } catch {
    return [];
  }
}

export function loadBatchSession(
  batchId: string,
  storage: StorageLike | null = getBrowserStorage()
): BatchSessionRecord | null {
  return loadBatchSessions(storage).find((session) => session.batchId === batchId) ?? null;
}

export function loadLatestCompletedBatchSession(
  storage: StorageLike | null = getBrowserStorage()
): BatchSessionRecord | null {
  return loadBatchSessions(storage).find((session) => Boolean(session.lastCompletionSummary)) ?? null;
}

export function saveBatchSession(
  session: BatchSessionRecord,
  storage: StorageLike | null = getBrowserStorage()
): BatchSessionRecord[] {
  if (!storage) {
    return [session];
  }

  const nextSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  const existing = loadBatchSessions(storage).filter((record) => record.batchId !== nextSession.batchId);
  const nextSessions = [nextSession, ...existing]
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_BATCH_SESSIONS);
  storage.setItem(BATCH_SESSIONS_KEY, JSON.stringify(nextSessions));
  return nextSessions;
}

export function removeBatchSession(
  batchId: string,
  storage: StorageLike | null = getBrowserStorage()
): BatchSessionRecord[] {
  if (!storage) {
    return [];
  }

  const nextSessions = loadBatchSessions(storage).filter((session) => session.batchId !== batchId);
  if (nextSessions.length === 0) {
    storage.removeItem(BATCH_SESSIONS_KEY);
    return [];
  }

  storage.setItem(BATCH_SESSIONS_KEY, JSON.stringify(nextSessions));
  return nextSessions;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function isBatchSessionRecord(value: unknown): value is BatchSessionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<BatchSessionRecord>;
  const hasValidBatchExportPreset =
    typeof record.batchExportPreset === "undefined" ||
    record.batchExportPreset === "full-av" ||
    record.batchExportPreset === "audio-only" ||
    record.batchExportPreset === "metadata-only";
  return (
    typeof record.batchId === "string" &&
    typeof record.label === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    typeof record.qualityThreshold === "number" &&
    hasValidBatchExportPreset &&
    Array.isArray(record.items)
  );
}
