import { formatSeconds } from "./format";
import type { BatchUploadItemRecord, UploadPhase, UploadProgress } from "./types";

const MIN_LIVE_ESTIMATE_PROGRESS = 8;
const MIN_LIVE_ESTIMATE_BYTES = 4 * 1024 * 1024;
const MIN_LIVE_ESTIMATE_ELAPSED_MS = 2_000;

type BatchUploadEtaOptions = {
  items: BatchUploadItemRecord[];
  activeItemId: string | null;
  uploadPhase: UploadPhase | "idle";
  uploadStats: UploadProgress | null;
  nowMs: number;
  sourceStartedAtByItemId: Record<string, number>;
  completedSourceDurationsMsByItemId: Record<string, number>;
};

export type BatchUploadEtaEstimate = {
  currentSourceSeconds: number | null;
  currentSourceBasis: BatchUploadEtaBasis | null;
  queueSeconds: number | null;
  queueBasis: BatchUploadEtaBasis | null;
};

export type BatchUploadEtaBasis = "live" | "history" | "mixed";

export function estimateBatchUploadEta({
  items,
  activeItemId,
  uploadPhase,
  uploadStats,
  nowMs,
  sourceStartedAtByItemId,
  completedSourceDurationsMsByItemId,
}: BatchUploadEtaOptions): BatchUploadEtaEstimate {
  if (!activeItemId) {
    return {
      currentSourceSeconds: null,
      currentSourceBasis: null,
      queueSeconds: null,
      queueBasis: null,
    };
  }

  const activeIndex = items.findIndex((item) => item.id === activeItemId);
  if (activeIndex < 0) {
    return {
      currentSourceSeconds: null,
      currentSourceBasis: null,
      queueSeconds: null,
      queueBasis: null,
    };
  }

  const activeItem = items[activeIndex];
  const historicalMsPerByte = getHistoricalMsPerByte(items, completedSourceDurationsMsByItemId);
  const liveMsPerByte = getLiveMsPerByte({
    itemId: activeItem.id,
    uploadPhase,
    uploadStats,
    nowMs,
    sourceStartedAtByItemId,
  });
  const queueMsPerByte = historicalMsPerByte ?? liveMsPerByte;
  const remainingQueueBasis = historicalMsPerByte !== null ? "history" : liveMsPerByte !== null ? "live" : null;

  let currentSourceMs: number | null = null;
  let currentSourceBasis: BatchUploadEtaBasis | null = null;
  if (activeItem.status === "uploading") {
    if (liveMsPerByte !== null && uploadStats) {
      const activeTotalBytes = uploadStats.total > 0 ? uploadStats.total : activeItem.sizeBytes;
      const remainingBytes = Math.max(0, activeTotalBytes - uploadStats.loaded);
      currentSourceMs = remainingBytes * liveMsPerByte;
      currentSourceBasis = "live";
    } else if (queueMsPerByte !== null && activeItem.sizeBytes > 0) {
      currentSourceMs = activeItem.sizeBytes * queueMsPerByte;
      currentSourceBasis = remainingQueueBasis;
    }
  }

  const queuedBytes = items
    .slice(activeIndex + 1)
    .filter((item) => item.status === "queued")
    .reduce((total, item) => total + item.sizeBytes, 0);
  const remainingQueueMs = queueMsPerByte !== null ? queuedBytes * queueMsPerByte : null;
  const queueMs =
    currentSourceMs !== null
      ? currentSourceMs + (remainingQueueMs ?? 0)
      : remainingQueueMs;
  const queueBasis = combineEtaBasis(
    currentSourceMs !== null ? currentSourceBasis : null,
    remainingQueueMs !== null ? remainingQueueBasis : null
  );

  return {
    currentSourceSeconds: toRoundedSeconds(currentSourceMs),
    currentSourceBasis,
    queueSeconds: toRoundedSeconds(queueMs),
    queueBasis,
  };
}

export function formatUploadEta(seconds: number | null) {
  if (seconds === null) {
    return "Estimating";
  }

  return `~${formatSeconds(Math.max(1, Math.ceil(seconds)))}`;
}

export function formatUploadEtaBasis(basis: BatchUploadEtaBasis | null) {
  if (basis === "live") {
    return "Live transfer rate";
  }

  if (basis === "history") {
    return "Completed upload history";
  }

  if (basis === "mixed") {
    return "Live + completed uploads";
  }

  return null;
}

function getHistoricalMsPerByte(
  items: BatchUploadItemRecord[],
  completedSourceDurationsMsByItemId: Record<string, number>
) {
  let totalBytes = 0;
  let totalDurationMs = 0;

  for (const item of items) {
    const durationMs = completedSourceDurationsMsByItemId[item.id];
    if (!durationMs || item.sizeBytes <= 0) {
      continue;
    }

    if (item.status !== "processing" && item.status !== "ready") {
      continue;
    }

    totalBytes += item.sizeBytes;
    totalDurationMs += durationMs;
  }

  if (totalBytes <= 0 || totalDurationMs <= 0) {
    return null;
  }

  return totalDurationMs / totalBytes;
}

function getLiveMsPerByte({
  itemId,
  uploadPhase,
  uploadStats,
  nowMs,
  sourceStartedAtByItemId,
}: {
  itemId: string;
  uploadPhase: UploadPhase | "idle";
  uploadStats: UploadProgress | null;
  nowMs: number;
  sourceStartedAtByItemId: Record<string, number>;
}) {
  if (uploadPhase !== "transferring" || !uploadStats) {
    return null;
  }

  const startedAt = sourceStartedAtByItemId[itemId];
  if (!startedAt || nowMs <= startedAt) {
    return null;
  }

  if (
    uploadStats.percentage < MIN_LIVE_ESTIMATE_PROGRESS ||
    uploadStats.loaded < MIN_LIVE_ESTIMATE_BYTES
  ) {
    return null;
  }

  const elapsedMs = nowMs - startedAt;
  if (elapsedMs < MIN_LIVE_ESTIMATE_ELAPSED_MS) {
    return null;
  }

  return elapsedMs / uploadStats.loaded;
}

function toRoundedSeconds(valueMs: number | null) {
  if (valueMs === null || !Number.isFinite(valueMs) || valueMs <= 0) {
    return null;
  }

  return Math.max(1, Math.ceil(valueMs / 1000));
}

function combineEtaBasis(
  currentBasis: BatchUploadEtaBasis | null,
  remainingBasis: BatchUploadEtaBasis | null
): BatchUploadEtaBasis | null {
  if (!currentBasis) {
    return remainingBasis;
  }

  if (!remainingBasis) {
    return currentBasis;
  }

  if (currentBasis === remainingBasis) {
    return currentBasis;
  }

  return "mixed";
}
