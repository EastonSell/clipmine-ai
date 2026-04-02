"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { loadRecentJobs, loadShortlist, saveRecentJob, saveShortlist } from "@/lib/recent-jobs";
import {
  DEFAULT_REVIEW_FILTERS,
  filterAndSortClips,
  hasActiveReviewFilters,
  parseReviewFilters,
  parseWorkspaceTab,
  serializeReviewFilters,
  type ReviewFilters,
} from "@/lib/review-state";
import type { JobResponse, RecentJobRecord } from "@/lib/types";

import type { WorkspaceTab } from "./constants";

type WorkspaceViewModel = {
  activeTab: WorkspaceTab;
  filters: ReviewFilters;
  availableSignals: string[];
  selectedClip: JobResponse["clips"][number] | null;
  resolvedClipId: string | null;
  shortlistedClips: JobResponse["clips"];
  rankedClips: JobResponse["clips"];
  pinnedClipIds: string[];
  recentJobs: RecentJobRecord[];
  hasActiveFilters: boolean;
  setActiveTab: (tab: WorkspaceTab) => void;
  setActiveClipId: (clipId: string | null) => void;
  updateFilters: (partial: Partial<ReviewFilters>) => void;
  clearFilters: () => void;
  isPinned: (clipId: string) => boolean;
  togglePinned: (clipId: string) => void;
};

export function useWorkspaceViewModel(jobId: string, job: JobResponse | undefined): WorkspaceViewModel {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();

  const [pinnedClipIds, setPinnedClipIds] = useState<string[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJobRecord[]>([]);

  useEffect(() => {
    setPinnedClipIds(loadShortlist(jobId));
  }, [jobId]);

  useEffect(() => {
    setRecentJobs(loadRecentJobs());
  }, []);

  useEffect(() => {
    saveShortlist(jobId, pinnedClipIds);
  }, [jobId, pinnedClipIds]);

  useEffect(() => {
    if (!job || job.status !== "ready" || !job.summary) {
      return;
    }

    setRecentJobs(saveRecentJob(job));
  }, [job]);

  const replaceSearchParams = useCallback(
    (mutator: (params: URLSearchParams) => URLSearchParams) => {
      const nextParams = mutator(new URLSearchParams(paramsString));
      const nextSearch = nextParams.toString();

      if (nextSearch === paramsString) {
        return;
      }

      startTransition(() => {
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
      });
    },
    [paramsString, pathname, router]
  );

  const activeTab = parseWorkspaceTab(searchParams.get("tab"));
  const filters = useMemo(() => parseReviewFilters(searchParams), [searchParams]);
  const requestedClipId = searchParams.get("clip");

  const availableSignals = useMemo(
    () =>
      Array.from(
        new Set(
          (job?.clips ?? [])
            .flatMap((clip) => [...clip.tags, ...clip.quality_penalties])
            .filter(Boolean)
        )
      ).toSorted((left, right) => left.localeCompare(right)),
    [job?.clips]
  );

  const filteredClips = useMemo(() => filterAndSortClips(job?.clips ?? [], filters), [job?.clips, filters]);
  const shortlistedClips = useMemo(
    () => filteredClips.filter((clip) => pinnedClipIds.includes(clip.id)),
    [filteredClips, pinnedClipIds]
  );
  const rankedClips = useMemo(() => {
    const base = filters.pinnedOnly ? shortlistedClips : filteredClips;
    return base.filter((clip) => !pinnedClipIds.includes(clip.id) || filters.pinnedOnly);
  }, [filteredClips, filters.pinnedOnly, pinnedClipIds, shortlistedClips]);

  const selectedClip = useMemo(() => {
    const visibleClips = filters.pinnedOnly ? shortlistedClips : [...shortlistedClips, ...rankedClips];
    return visibleClips.find((clip) => clip.id === requestedClipId) ?? visibleClips[0] ?? job?.clips[0] ?? null;
  }, [filters.pinnedOnly, job?.clips, rankedClips, requestedClipId, shortlistedClips]);

  const resolvedClipId = selectedClip?.id ?? null;
  const hasActiveFilters = hasActiveReviewFilters(filters);

  useEffect(() => {
    if (!job?.clips.length || !resolvedClipId || resolvedClipId === requestedClipId) {
      return;
    }

    replaceSearchParams((params) => {
      params.set("clip", resolvedClipId);
      return params;
    });
  }, [job?.clips.length, replaceSearchParams, requestedClipId, resolvedClipId]);

  function updateFilters(partial: Partial<ReviewFilters>) {
    const nextFilters = { ...filters, ...partial };
    const nextTab = activeTab;

    replaceSearchParams((params) => {
      if (nextTab === "clips") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }

      const nextParams = serializeReviewFilters(params, nextFilters);
      nextParams.delete("clip");
      return nextParams;
    });
  }

  function clearFilters() {
    updateFilters(DEFAULT_REVIEW_FILTERS);
  }

  function setActiveTab(tab: WorkspaceTab) {
    replaceSearchParams((params) => {
      if (tab === "clips") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      return params;
    });
  }

  function setActiveClipId(clipId: string | null) {
    replaceSearchParams((params) => {
      if (clipId) {
        params.set("clip", clipId);
      } else {
        params.delete("clip");
      }
      return params;
    });
  }

  function togglePinned(clipId: string) {
    setPinnedClipIds((currentIds) =>
      currentIds.includes(clipId) ? currentIds.filter((value) => value !== clipId) : [clipId, ...currentIds]
    );
  }

  function isPinned(clipId: string) {
    return pinnedClipIds.includes(clipId);
  }
  return {
    activeTab,
    filters,
    availableSignals,
    selectedClip,
    resolvedClipId,
    shortlistedClips,
    rankedClips,
    pinnedClipIds,
    recentJobs,
    hasActiveFilters,
    setActiveTab,
    setActiveClipId,
    updateFilters,
    clearFilters,
    isPinned,
    togglePinned,
  };
}
