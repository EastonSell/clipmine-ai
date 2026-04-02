import type { ClipRecord, SelectionRecommendation } from "./types";

export type ReviewSort = "score" | "confidence" | "start" | "duration";
export type ReviewQuality = "all" | ClipRecord["quality_label"];
export type ReviewRecommendation = "all" | SelectionRecommendation;

export type ReviewFilters = {
  query: string;
  quality: ReviewQuality;
  tag: string;
  recommendation: ReviewRecommendation;
  sort: ReviewSort;
  pinnedOnly: boolean;
  shortlistReadyOnly: boolean;
};

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  query: "",
  quality: "all",
  tag: "",
  recommendation: "all",
  sort: "score",
  pinnedOnly: false,
  shortlistReadyOnly: false,
};

export function parseWorkspaceTab(value: string | null): "clips" | "timeline" | "export" {
  return value === "timeline" || value === "export" ? value : "clips";
}

export function parseReviewFilters(params: URLSearchParams | ReadonlyURLSearchParamsLike): ReviewFilters {
  const quality = params.get("quality");
  const sort = params.get("sort");
  const recommendation = params.get("recommendation");

  return {
    query: (params.get("q") || "").trim(),
    quality: quality === "Excellent" || quality === "Good" || quality === "Weak" ? quality : "all",
    tag: (params.get("tag") || "").trim(),
    recommendation:
      recommendation === "shortlist" || recommendation === "review" || recommendation === "discard"
        ? recommendation
        : "all",
    sort: sort === "confidence" || sort === "start" || sort === "duration" ? sort : "score",
    pinnedOnly: params.get("pinned") === "1",
    shortlistReadyOnly: params.get("ready") === "1",
  };
}

export function filterAndSortClips(clips: ClipRecord[], filters: ReviewFilters): ClipRecord[] {
  const normalizedQuery = filters.query.toLowerCase();

  const filtered = clips.filter((clip) => {
    if (filters.quality !== "all" && clip.quality_label !== filters.quality) {
      return false;
    }

    if (filters.recommendation !== "all" && clip.selection_recommendation !== filters.recommendation) {
      return false;
    }

    if (filters.shortlistReadyOnly && clip.selection_recommendation !== "shortlist") {
      return false;
    }

    if (
      filters.tag &&
      !clip.tags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase()) &&
      !clip.quality_penalties.some((penalty) => penalty.toLowerCase() === filters.tag.toLowerCase())
    ) {
      return false;
    }

    if (
      normalizedQuery &&
      !clip.text.toLowerCase().includes(normalizedQuery) &&
      !clip.explanation.toLowerCase().includes(normalizedQuery) &&
      !clip.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) &&
      !clip.quality_penalties.some((penalty) => penalty.toLowerCase().includes(normalizedQuery)) &&
      !clip.selection_recommendation.includes(normalizedQuery)
    ) {
      return false;
    }

    return true;
  });

  return filtered.toSorted((left, right) => compareClips(left, right, filters.sort));
}

export function hasActiveReviewFilters(filters: ReviewFilters): boolean {
  return Boolean(
    filters.query ||
      filters.tag ||
      filters.pinnedOnly ||
      filters.shortlistReadyOnly ||
      filters.quality !== "all" ||
      filters.recommendation !== "all" ||
      filters.sort !== "score"
  );
}

export function serializeReviewFilters(
  params: URLSearchParams,
  filters: ReviewFilters
): URLSearchParams {
  const nextParams = new URLSearchParams(params.toString());
  setParam(nextParams, "q", filters.query);
  setParam(nextParams, "quality", filters.quality === "all" ? "" : filters.quality);
  setParam(nextParams, "tag", filters.tag);
  setParam(nextParams, "recommendation", filters.recommendation === "all" ? "" : filters.recommendation);
  setParam(nextParams, "sort", filters.sort === "score" ? "" : filters.sort);
  setParam(nextParams, "pinned", filters.pinnedOnly ? "1" : "");
  setParam(nextParams, "ready", filters.shortlistReadyOnly ? "1" : "");
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
