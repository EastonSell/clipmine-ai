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
  queueSeconds: number | null;
};

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
      queueSeconds: null,
    };
  }

  const activeIndex = items.findIndex((item) => item.id === activeItemId);
  if (activeIndex < 0) {
    return {
      currentSourceSeconds: null,
      queueSeconds: null,
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
  const msPerByte = historicalMsPerByte ?? liveMsPerByte;

  let currentSourceMs: number | null = null;
  if (activeItem.status === "uploading") {
    if (liveMsPerByte !== null && uploadStats) {
      const activeTotalBytes = uploadStats.total > 0 ? uploadStats.total : activeItem.sizeBytes;
      const remainingBytes = Math.max(0, activeTotalBytes - uploadStats.loaded);
      currentSourceMs = remainingBytes * liveMsPerByte;
    } else if (msPerByte !== null && activeItem.sizeBytes > 0) {
      currentSourceMs = activeItem.sizeBytes * msPerByte;
    }
  }

  const queuedBytes = items
    .slice(activeIndex + 1)
    .filter((item) => item.status === "queued")
    .reduce((total, item) => total + item.sizeBytes, 0);
  const remainingQueueMs = msPerByte !== null ? queuedBytes * msPerByte : null;
  const queueMs =
    currentSourceMs !== null
      ? currentSourceMs + (remainingQueueMs ?? 0)
      : remainingQueueMs;

  return {
    currentSourceSeconds: toRoundedSeconds(currentSourceMs),
    queueSeconds: toRoundedSeconds(queueMs),
  };
}

export function formatUploadEta(seconds: number | null) {
  if (seconds === null) {
    return "Estimating";
  }

  return `~${formatSeconds(Math.max(1, Math.ceil(seconds)))}`;
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
