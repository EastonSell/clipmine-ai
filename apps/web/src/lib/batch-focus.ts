import type { BatchUploadItemRecord, PackageExportPreset } from "./types";

export type BatchTriageState = {
  prioritizeIssues: boolean;
  issuesOnly: boolean;
};

export type ReadyBatchJobShortcutDirection = "previous" | "next";

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
  }: BatchTriageState & { selectedJobId?: string | null; selectedPreset?: PackageExportPreset },
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
