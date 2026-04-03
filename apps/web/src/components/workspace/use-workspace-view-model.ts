"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import {
  loadRecentJobs,
  loadSelectedClips,
  loadShortlist,
  saveRecentJob,
  saveSelectedClips,
  saveShortlist,
} from "@/lib/recent-jobs";
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
  comparedClipIds: string[];
  comparedClips: JobResponse["clips"];
  selectedClipIds: string[];
  selectedClips: JobResponse["clips"];
  selectedClipDuration: number;
  visibleClips: JobResponse["clips"];
  recentJobs: RecentJobRecord[];
  hasActiveFilters: boolean;
  setActiveTab: (tab: WorkspaceTab) => void;
  setActiveClipId: (clipId: string | null) => void;
  updateFilters: (partial: Partial<ReviewFilters>) => void;
  clearFilters: () => void;
  isPinned: (clipId: string) => boolean;
  togglePinned: (clipId: string) => void;
  isCompared: (clipId: string) => boolean;
  toggleCompared: (clipId: string) => void;
  clearCompared: () => void;
  isSelected: (clipId: string) => boolean;
  toggleSelected: (clipId: string) => void;
  selectVisible: () => void;
  selectShortlistReady: () => void;
  selectAllShortlisted: () => void;
  clearSelected: () => void;
};

export function useWorkspaceViewModel(jobId: string, job: JobResponse | undefined): WorkspaceViewModel {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();

  const [pinnedClipIds, setPinnedClipIds] = useState<string[]>([]);
  const [comparedClipIds, setComparedClipIds] = useState<string[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJobRecord[]>([]);

  useEffect(() => {
    setPinnedClipIds(loadShortlist(jobId));
    setSelectedClipIds(loadSelectedClips(jobId));
  }, [jobId]);

  useEffect(() => {
    setRecentJobs(loadRecentJobs());
  }, []);

  useEffect(() => {
    saveShortlist(jobId, pinnedClipIds);
  }, [jobId, pinnedClipIds]);

  useEffect(() => {
    saveSelectedClips(jobId, selectedClipIds);
  }, [jobId, selectedClipIds]);

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
  const visibleClips = useMemo(
    () => (filters.pinnedOnly ? shortlistedClips : [...shortlistedClips, ...rankedClips]),
    [filters.pinnedOnly, rankedClips, shortlistedClips]
  );
  const selectedClips = useMemo(() => {
    const selectedSet = new Set(selectedClipIds);
    return (job?.clips ?? []).filter((clip) => selectedSet.has(clip.id));
  }, [job?.clips, selectedClipIds]);
  const comparedClips = useMemo(() => {
    if (!job) {
      return [];
    }

    const clipsById = new Map(job.clips.map((clip) => [clip.id, clip]));
    return comparedClipIds
      .map((clipId) => clipsById.get(clipId))
      .filter((clip): clip is JobResponse["clips"][number] => Boolean(clip));
  }, [comparedClipIds, job]);
  const selectedClipDuration = useMemo(
    () => selectedClips.reduce((total, clip) => total + clip.duration, 0),
    [selectedClips]
  );

  const selectedClip = useMemo(() => {
    return visibleClips.find((clip) => clip.id === requestedClipId) ?? visibleClips[0] ?? job?.clips[0] ?? null;
  }, [job?.clips, requestedClipId, visibleClips]);

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

  useEffect(() => {
    if (!job?.clips.length) {
      return;
    }

    const validIds = new Set(job.clips.map((clip) => clip.id));
    setPinnedClipIds((currentIds) => currentIds.filter((clipId) => validIds.has(clipId)));
    setComparedClipIds((currentIds) => currentIds.filter((clipId) => validIds.has(clipId)));
    setSelectedClipIds((currentIds) => currentIds.filter((clipId) => validIds.has(clipId)));
  }, [job?.clips]);

  useEffect(() => {
    setComparedClipIds((currentIds) => currentIds.filter((clipId) => pinnedClipIds.includes(clipId)));
  }, [pinnedClipIds]);

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

  function isCompared(clipId: string) {
    return comparedClipIds.includes(clipId);
  }

  function toggleCompared(clipId: string) {
    if (!pinnedClipIds.includes(clipId)) {
      return;
    }

    setComparedClipIds((currentIds) => {
      if (currentIds.includes(clipId)) {
        return currentIds.filter((value) => value !== clipId);
      }

      return [...currentIds, clipId].slice(-2);
    });
  }

  function isSelected(clipId: string) {
    return selectedClipIds.includes(clipId);
  }

  function toggleSelected(clipId: string) {
    setSelectedClipIds((currentIds) =>
      currentIds.includes(clipId) ? currentIds.filter((value) => value !== clipId) : normalizeSelectionIds(job, [...currentIds, clipId])
    );
  }

  function clearSelected() {
    setSelectedClipIds([]);
  }

  function clearCompared() {
    setComparedClipIds([]);
  }

  function selectVisible() {
    setSelectedClipIds((currentIds) => normalizeSelectionIds(job, [...currentIds, ...visibleClips.map((clip) => clip.id)]));
  }

  function selectShortlistReady() {
    const shortlistReadyIds = visibleClips
      .filter((clip) => clip.selection_recommendation === "shortlist")
      .map((clip) => clip.id);
    setSelectedClipIds((currentIds) => normalizeSelectionIds(job, [...currentIds, ...shortlistReadyIds]));
  }

  function selectAllShortlisted() {
    setSelectedClipIds((currentIds) => normalizeSelectionIds(job, [...currentIds, ...pinnedClipIds]));
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
    comparedClipIds,
    comparedClips,
    selectedClipIds,
    selectedClips,
    selectedClipDuration,
    visibleClips,
    recentJobs,
    hasActiveFilters,
    setActiveTab,
    setActiveClipId,
    updateFilters,
    clearFilters,
    isPinned,
    togglePinned,
    isCompared,
    toggleCompared,
    clearCompared,
    isSelected,
    toggleSelected,
    selectVisible,
    selectShortlistReady,
    selectAllShortlisted,
    clearSelected,
  };
}

function normalizeSelectionIds(job: JobResponse | undefined, clipIds: string[]) {
  const uniqueIds = Array.from(new Set(clipIds));
  if (!job) {
    return uniqueIds;
  }

  const selectionSet = new Set(uniqueIds);
  return job.clips.filter((clip) => selectionSet.has(clip.id)).map((clip) => clip.id);
}
