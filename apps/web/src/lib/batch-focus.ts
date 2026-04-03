import type { BatchUploadItemRecord } from "./types";

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

export function hasBatchIssues(items: BatchUploadItemRecord[]) {
  return items.some(isBatchIssueItem);
}
