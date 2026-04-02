import type { ClipRecord } from "./types";

export type ReviewSort = "score" | "confidence" | "start" | "duration";
export type ReviewQuality = "all" | ClipRecord["quality_label"];

export type ReviewFilters = {
  query: string;
  quality: ReviewQuality;
  tag: string;
  sort: ReviewSort;
  pinnedOnly: boolean;
};

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  query: "",
  quality: "all",
  tag: "",
  sort: "score",
  pinnedOnly: false,
};

export function parseWorkspaceTab(value: string | null): "clips" | "timeline" | "export" {
  return value === "timeline" || value === "export" ? value : "clips";
}

export function parseReviewFilters(params: URLSearchParams | ReadonlyURLSearchParamsLike): ReviewFilters {
  const quality = params.get("quality");
  const sort = params.get("sort");

  return {
    query: (params.get("q") || "").trim(),
    quality: quality === "Excellent" || quality === "Good" || quality === "Weak" ? quality : "all",
    tag: (params.get("tag") || "").trim(),
    sort: sort === "confidence" || sort === "start" || sort === "duration" ? sort : "score",
    pinnedOnly: params.get("pinned") === "1",
  };
}

export function filterAndSortClips(clips: ClipRecord[], filters: ReviewFilters): ClipRecord[] {
  const normalizedQuery = filters.query.toLowerCase();

  const filtered = clips.filter((clip) => {
    if (filters.quality !== "all" && clip.quality_label !== filters.quality) {
      return false;
    }

    if (filters.tag && !clip.tags.includes(filters.tag)) {
      return false;
    }

    if (
      normalizedQuery &&
      !clip.text.toLowerCase().includes(normalizedQuery) &&
      !clip.explanation.toLowerCase().includes(normalizedQuery) &&
      !clip.tags.some((tag) => tag.includes(normalizedQuery))
    ) {
      return false;
    }

    return true;
  });

  return filtered.toSorted((left, right) => compareClips(left, right, filters.sort));
}

export function hasActiveReviewFilters(filters: ReviewFilters): boolean {
  return Boolean(filters.query || filters.tag || filters.pinnedOnly || filters.quality !== "all" || filters.sort !== "score");
}

export function serializeReviewFilters(
  params: URLSearchParams,
  filters: ReviewFilters
): URLSearchParams {
  const nextParams = new URLSearchParams(params.toString());
  setParam(nextParams, "q", filters.query);
  setParam(nextParams, "quality", filters.quality === "all" ? "" : filters.quality);
  setParam(nextParams, "tag", filters.tag);
  setParam(nextParams, "sort", filters.sort === "score" ? "" : filters.sort);
  setParam(nextParams, "pinned", filters.pinnedOnly ? "1" : "");
  return nextParams;
}

function compareClips(left: ClipRecord, right: ClipRecord, sort: ReviewSort): number {
  switch (sort) {
    case "confidence":
      return right.confidence - left.confidence || right.score - left.score || left.start - right.start;
    case "start":
      return left.start - right.start || right.score - left.score;
    case "duration":
      return right.duration - left.duration || right.score - left.score || left.start - right.start;
    case "score":
    default:
      return right.score - left.score || left.start - right.start;
  }
}

function setParam(params: URLSearchParams, key: string, value: string) {
  if (!value) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}

type ReadonlyURLSearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};
