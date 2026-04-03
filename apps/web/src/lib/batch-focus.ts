import type { BatchUploadItemRecord, JobResponse, PackageExportPreset } from "./types";

export type BatchTriageState = {
  prioritizeIssues: boolean;
  issuesOnly: boolean;
};

export type BatchQualityThresholdPreset = {
  label: string;
  value: number;
  description: string;
};

export type ReadyBatchJobShortcutDirection = "previous" | "next";
export type ReadyBatchItemPosition = {
  index: number;
  total: number;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
};

export const DEFAULT_BATCH_QUALITY_THRESHOLD = 84;
const MIN_BATCH_QUALITY_THRESHOLD = 50;
const MAX_BATCH_QUALITY_THRESHOLD = 100;
export const BATCH_QUALITY_THRESHOLD_PRESETS: BatchQualityThresholdPreset[] = [
  {
    label: "Strict",
    value: 92,
    description: "Keep only the strongest, most training-ready clips.",
  },
  {
    label: "Balanced",
    value: DEFAULT_BATCH_QUALITY_THRESHOLD,
    description: "Start from the default review floor for shortlist-quality clips.",
  },
  {
    label: "Broad",
    value: 72,
    description: "Include more review candidates before a final trim pass.",
  },
];

export function parseBatchSelectedJobId(jobId: string | null | undefined) {
  const normalizedJobId = jobId?.trim();
  return normalizedJobId ? normalizedJobId : null;
}

export function parseBatchSelectedPreset(preset: string | null | undefined): PackageExportPreset | null {
  if (preset === "full-av" || preset === "audio-only" || preset === "metadata-only") {
    return preset;
  }

  return null;
}

export function parseBatchQualityThreshold(threshold: string | null | undefined): number | null {
  const normalizedThreshold = threshold?.trim();
  if (!normalizedThreshold) {
    return null;
  }

  const parsedThreshold = Number(normalizedThreshold);
  if (
    !Number.isInteger(parsedThreshold) ||
    parsedThreshold < MIN_BATCH_QUALITY_THRESHOLD ||
    parsedThreshold > MAX_BATCH_QUALITY_THRESHOLD
  ) {
    return null;
  }

  return parsedThreshold;
}

export function parseBatchTriageState(focus: string | null | undefined, scope: string | null | undefined): BatchTriageState {
  const prioritizeIssues = focus === "issues";
  return {
    prioritizeIssues,
    issuesOnly: prioritizeIssues && scope !== "all",
  };
}

export function getBatchWorkspaceHref(
  batchId: string,
  {
    prioritizeIssues,
    issuesOnly = prioritizeIssues,
    selectedJobId = null,
    selectedPreset = "full-av",
    selectedQualityThreshold = DEFAULT_BATCH_QUALITY_THRESHOLD,
  }: BatchTriageState & {
    selectedJobId?: string | null;
    selectedPreset?: PackageExportPreset;
    selectedQualityThreshold?: number;
  },
  hash = ""
) {
  const searchParams = new URLSearchParams();

  if (prioritizeIssues) {
    searchParams.set("focus", "issues");

    if (!issuesOnly) {
      searchParams.set("scope", "all");
    }
  }

  if (selectedJobId) {
    searchParams.set("job", selectedJobId);
  }

  if (selectedPreset !== "full-av") {
    searchParams.set("preset", selectedPreset);
  }

  if (selectedQualityThreshold !== DEFAULT_BATCH_QUALITY_THRESHOLD) {
    searchParams.set("threshold", String(selectedQualityThreshold));
  }

  const search = searchParams.toString();
  return `/batches/${batchId}${search ? `?${search}` : ""}${hash}`;
}

export function isBatchIssueItem(item: BatchUploadItemRecord) {
  return item.status === "failed" || item.status === "cancelled";
}

function getBatchIssueRank(item: BatchUploadItemRecord) {
  if (item.status === "failed") {
    return 0;
  }

  if (item.status === "cancelled") {
    return 1;
  }

  return 2;
}

export function getOrderedBatchItems(
  items: BatchUploadItemRecord[],
  prioritizeIssues: boolean,
  issuesOnly = false
): BatchUploadItemRecord[] {
  const visibleItems = issuesOnly ? items.filter(isBatchIssueItem) : items;

  if (!prioritizeIssues) {
    return visibleItems;
  }

  return visibleItems
    .map((item, index) => ({ item, index }))
    .toSorted((left, right) => {
      const rankDifference = getBatchIssueRank(left.item) - getBatchIssueRank(right.item);
      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function getPreferredBatchJobId(
  items: BatchUploadItemRecord[],
  prioritizeIssues: boolean
): string | null {
  return getOrderedBatchItems(items, prioritizeIssues).find((item) => item.jobId)?.jobId ?? null;
}

export function getReadyBatchJobNavigation(
  items: BatchUploadItemRecord[],
  activeJobId: string | null
) {
  const jobIds = items.flatMap((item) => (item.status === "ready" && item.jobId ? [item.jobId] : []));
  const currentIndex = activeJobId ? jobIds.indexOf(activeJobId) : -1;
  const firstJobId = jobIds[0] ?? null;
  const lastJobId = jobIds.length > 0 ? jobIds[jobIds.length - 1] : null;

  return {
    jobIds,
    currentIndex,
    firstJobId,
    lastJobId,
    previousJobId: currentIndex > 0 ? jobIds[currentIndex - 1] : null,
    nextJobId: currentIndex >= 0 && currentIndex < jobIds.length - 1 ? jobIds[currentIndex + 1] : null,
  };
}

export function getReadyBatchItemPositions(
  items: BatchUploadItemRecord[],
  activeJobId: string | null
) {
  const readyItems = items.flatMap((item) =>
    item.status === "ready" && item.jobId
      ? [{ itemId: item.id, jobId: item.jobId }]
      : []
  );
  const total = readyItems.length;

  return new Map<string, ReadyBatchItemPosition>(
    readyItems.map(({ itemId, jobId }, index) => [
      itemId,
      {
        index: index + 1,
        total,
        isCurrent: jobId === activeJobId,
        isFirst: index === 0,
        isLast: index === total - 1,
      },
    ])
  );
}

export function getReadyBatchJobShortcutDirection({
  key,
  altKey,
  ctrlKey,
  metaKey,
  isContentEditable = false,
  targetTagName = null,
}: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isContentEditable?: boolean;
  targetTagName?: string | null;
}): ReadyBatchJobShortcutDirection | null {
  if (altKey || ctrlKey || metaKey || isContentEditable) {
    return null;
  }

  const normalizedTagName = targetTagName?.toLowerCase();
  if (normalizedTagName === "input" || normalizedTagName === "textarea" || normalizedTagName === "select") {
    return null;
  }

  if (key === "[") {
    return "previous";
  }

  if (key === "]") {
    return "next";
  }

  return null;
}

export function hasBatchIssues(items: BatchUploadItemRecord[]) {
  return items.some(isBatchIssueItem);
}

export function getBatchEligibleClipCount(
  jobs: Array<Pick<JobResponse, "clips">>,
  threshold: number
) {
  return jobs.reduce(
    (total, job) => total + job.clips.filter((clip) => clip.score >= threshold).length,
    0
  );
}
