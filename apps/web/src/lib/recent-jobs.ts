import type { JobResponse, RecentJobRecord } from "./types";

const RECENT_JOBS_KEY = "clipmine:recent-jobs:v1";
const SHORTLIST_KEY_PREFIX = "clipmine:shortlist:";
const SELECTED_CLIPS_KEY_PREFIX = "clipmine:selected:";
const MAX_RECENT_JOBS = 6;
const EMPTY_RECENT_JOBS_SNAPSHOT = "[]";

export const RECENT_JOBS_STORAGE_EVENT = "clipmine:recent-jobs-change";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadRecentJobs(storage: StorageLike | null = getBrowserStorage()): RecentJobRecord[] {
  return parseRecentJobsSnapshot(getRecentJobsSnapshot(storage));
}

export function getRecentJobsSnapshot(storage: StorageLike | null = getBrowserStorage()): string {
  if (!storage) {
    return EMPTY_RECENT_JOBS_SNAPSHOT;
  }

  try {
    const raw = storage.getItem(RECENT_JOBS_KEY);
    return raw || EMPTY_RECENT_JOBS_SNAPSHOT;
  } catch {
    return EMPTY_RECENT_JOBS_SNAPSHOT;
  }
}

export function saveRecentJob(
  job: JobResponse,
  storage: StorageLike | null = getBrowserStorage()
): RecentJobRecord[] {
  if (!storage || job.status !== "ready" || !job.summary) {
    return loadRecentJobs(storage);
  }

  const nextRecord: RecentJobRecord = {
    jobId: job.jobId,
    fileName: job.sourceVideo.file_name,
    updatedAt: job.updatedAt,
    clipCount: job.summary.clip_count,
    topScore: job.summary.top_score,
    durationSeconds: job.sourceVideo.duration_seconds ?? 0,
    language: job.language,
  };

  const records = loadRecentJobs(storage)
    .filter((record) => record.jobId !== nextRecord.jobId)
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const nextRecords = [nextRecord, ...records].slice(0, MAX_RECENT_JOBS);
  storage.setItem(RECENT_JOBS_KEY, JSON.stringify(nextRecords));
  dispatchRecentJobsStorageEvent();
  return nextRecords;
}

export function loadShortlist(jobId: string, storage: StorageLike | null = getBrowserStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(getShortlistKey(jobId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function saveShortlist(
  jobId: string,
  clipIds: string[],
  storage: StorageLike | null = getBrowserStorage()
): string[] {
  if (!storage) {
    return clipIds;
  }

  const normalized = Array.from(new Set(clipIds)).slice(0, 12);
  if (normalized.length === 0) {
    storage.removeItem(getShortlistKey(jobId));
    return [];
  }

  storage.setItem(getShortlistKey(jobId), JSON.stringify(normalized));
  return normalized;
}

export function loadSelectedClips(jobId: string, storage: StorageLike | null = getBrowserStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(getSelectedClipsKey(jobId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function saveSelectedClips(
  jobId: string,
  clipIds: string[],
  storage: StorageLike | null = getBrowserStorage()
): string[] {
  if (!storage) {
    return clipIds;
  }

  const normalized = Array.from(new Set(clipIds)).slice(0, 128);
  if (normalized.length === 0) {
    storage.removeItem(getSelectedClipsKey(jobId));
    return [];
  }

  storage.setItem(getSelectedClipsKey(jobId), JSON.stringify(normalized));
  return normalized;
}

function getShortlistKey(jobId: string) {
  return `${SHORTLIST_KEY_PREFIX}${jobId}`;
}

function getSelectedClipsKey(jobId: string) {
  return `${SELECTED_CLIPS_KEY_PREFIX}${jobId}`;
}

function parseRecentJobsSnapshot(snapshot: string): RecentJobRecord[] {
  try {
    const parsed = JSON.parse(snapshot) as RecentJobRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dispatchRecentJobsStorageEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(RECENT_JOBS_STORAGE_EVENT));
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
