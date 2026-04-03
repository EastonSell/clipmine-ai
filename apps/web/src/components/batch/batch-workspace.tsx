"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileJson2,
  Film,
  RefreshCcw,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FooterNotes } from "@/components/ui/footer-notes";
import { PageContainer } from "@/components/ui/page-container";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { TopBar } from "@/components/ui/top-bar";
import {
  getBatchSourceFilePersistenceStatus,
  listBatchSourceFileItemIds,
  loadBatchSourceFile,
  removeBatchSourceFile,
} from "@/lib/batch-source-files";
import {
  BATCH_QUALITY_THRESHOLD_PRESETS,
  DEFAULT_BATCH_QUALITY_THRESHOLD,
  getBatchEligibleClipCount,
  getNextBroaderBatchQualityThresholdPreset,
  getBatchWorkspaceHref,
  getOrderedBatchItems,
  getPreferredBatchJobId,
  getReadyBatchItemPositions,
  getReadyBatchJobNavigation,
  getReadyBatchJobShortcutDirection,
  hasBatchIssues,
  isBatchIssueItem,
  isReadyBatchItem,
} from "@/lib/batch-focus";
import {
  buildBatchPackageRootName,
  buildPackageClipFileName,
  getPackageAssetDirectory,
  getPackageExportPresetOption,
  PACKAGE_EXPORT_PRESET_OPTIONS,
} from "@/lib/package-export";
import { createJob, downloadBatchClipPackage, getJob, retryJob, ApiError, isRetryableApiError } from "@/lib/api";
import { loadBatchSession, saveBatchSession } from "@/lib/batch-sessions";
import { formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { BatchPackageJobSelection, BatchSessionRecord, BatchUploadItemRecord, ClipRecord, JobResponse, PackageExportPreset } from "@/lib/types";

type BatchWorkspaceProps = {
  batchId: string;
  prioritizeIssues?: boolean;
  initialIssuesOnly?: boolean;
  initialReadyOnly?: boolean;
  initialActiveJobId?: string | null;
  initialSelectedPreset?: PackageExportPreset | null;
  initialQualityThreshold?: number | null;
};

type AggregateClip = {
  jobId: string;
  fileName: string;
  clip: ClipRecord;
};

type ReadySourceRecoveryPreview = {
  jobId: string;
  fileName: string;
  eligibleClipCount: number;
  eligibleDuration: number;
  readySourceIndex: number;
};

function formatContributionRank(value: number) {
  const remainderHundred = value % 100;
  if (remainderHundred >= 11 && remainderHundred <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function BatchWorkspace({
  batchId,
  prioritizeIssues = false,
  initialIssuesOnly = prioritizeIssues,
  initialReadyOnly = false,
  initialActiveJobId = null,
  initialSelectedPreset = null,
  initialQualityThreshold = null,
}: BatchWorkspaceProps) {
  const [session, setSession] = useState<BatchSessionRecord | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(initialActiveJobId);
  const [issuesOnly, setIssuesOnly] = useState(prioritizeIssues && initialIssuesOnly);
  const [readyOnly, setReadyOnly] = useState(initialReadyOnly && !initialIssuesOnly);
  const [qualityThreshold, setQualityThreshold] = useState(initialQualityThreshold ?? DEFAULT_BATCH_QUALITY_THRESHOLD);
  const [selectedPreset, setSelectedPreset] = useState<PackageExportPreset>(initialSelectedPreset ?? "full-av");
  const [showContributorsOnly, setShowContributorsOnly] = useState(false);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [retryingItemIds, setRetryingItemIds] = useState<string[]>([]);
  const [cachedSourceFileItemIds, setCachedSourceFileItemIds] = useState<string[]>([]);
  const [retrySourcePersistenceWarning, setRetrySourcePersistenceWarning] = useState<string | null>(null);
  const sessionRef = useRef<BatchSessionRecord | null>(null);
  const queueSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nextSession = loadBatchSession(batchId);
    const nextIssuesOnly = prioritizeIssues && initialIssuesOnly && hasBatchIssues(nextSession?.items ?? []);
    const nextReadyOnly = !nextIssuesOnly && initialReadyOnly && (nextSession?.items ?? []).some(isReadyBatchItem);
    const nextQueueItems = getOrderedBatchItems(nextSession?.items ?? [], prioritizeIssues, nextIssuesOnly, nextReadyOnly);
    const nextActiveJobId =
      initialActiveJobId && nextQueueItems.some((item) => item.jobId === initialActiveJobId)
        ? initialActiveJobId
        : getPreferredBatchJobId(nextQueueItems, false);
    setSession(nextSession);
    sessionRef.current = nextSession;
    setIssuesOnly(nextIssuesOnly);
    setReadyOnly(nextReadyOnly);
    setQualityThreshold(initialQualityThreshold ?? nextSession?.qualityThreshold ?? DEFAULT_BATCH_QUALITY_THRESHOLD);
    setSelectedPreset(initialSelectedPreset ?? nextSession?.batchExportPreset ?? "full-av");
    setActiveJobId(nextActiveJobId);
  }, [batchId, initialActiveJobId, initialIssuesOnly, initialQualityThreshold, initialReadyOnly, initialSelectedPreset, prioritizeIssues]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCachedSourceFileItemIds() {
      const nextItemIds = await listBatchSourceFileItemIds(batchId);
      if (!cancelled) {
        setCachedSourceFileItemIds(nextItemIds);
      }
    }

    void refreshCachedSourceFileItemIds();

    return () => {
      cancelled = true;
    };
  }, [batchId, session?.items]);

  useEffect(() => {
    let cancelled = false;

    async function loadRetrySourcePersistenceWarning() {
      const status = await getBatchSourceFilePersistenceStatus();
      if (!cancelled) {
        setRetrySourcePersistenceWarning(status.warning);
      }
    }

    void loadRetrySourcePersistenceWarning();

    return () => {
      cancelled = true;
    };
  }, []);

  const jobIds = useMemo(
    () => Array.from(new Set((session?.items ?? []).map((item) => item.jobId).filter((value): value is string => Boolean(value)))),
    [session?.items]
  );

  const { data, error, isLoading, mutate } = useSWR<JobResponse[]>(
    jobIds.length > 0 ? ["batch-jobs", ...jobIds] : null,
    async () => Promise.all(jobIds.map((jobId) => getJob(jobId))),
    {
      refreshInterval(currentJobs) {
        if (!currentJobs || currentJobs.length === 0) {
          return 0;
        }

        return currentJobs.some((job) => job.status === "queued" || job.status === "processing") ? 2500 : 0;
      },
      revalidateOnFocus: false,
    }
  );

  const jobs = useMemo(() => data ?? [], [data]);
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.jobId, job])), [jobs]);
  const retryingItemIdSet = useMemo(() => new Set(retryingItemIds), [retryingItemIds]);
  const cachedSourceFileItemIdSet = useMemo(() => new Set(cachedSourceFileItemIds), [cachedSourceFileItemIds]);
  const queueItems = useMemo(
    () => getOrderedBatchItems(session?.items ?? [], prioritizeIssues, issuesOnly, readyOnly && !issuesOnly),
    [issuesOnly, prioritizeIssues, readyOnly, session?.items]
  );
  const selectedQueueItem = useMemo(
    () => (activeJobId ? queueItems.find((item) => item.jobId === activeJobId) ?? null : null),
    [activeJobId, queueItems]
  );
  const queueItemOrdinals = useMemo(
    () => new Map((session?.items ?? []).map((item, index) => [item.id, index + 1])),
    [session?.items]
  );
  const readyQueuePositions = useMemo(
    () => getReadyBatchItemPositions(queueItems, activeJobId),
    [activeJobId, queueItems]
  );
  const queueHasIssues = useMemo(() => hasBatchIssues(session?.items ?? []), [session?.items]);
  const issueCount = useMemo(
    () => (session?.items ?? []).filter(isBatchIssueItem).length,
    [session?.items]
  );
  const readyCount = useMemo(
    () => (session?.items ?? []).filter(isReadyBatchItem).length,
    [session?.items]
  );
  const hasTabOnlyRetrySources = useMemo(
    () =>
      Boolean(retrySourcePersistenceWarning) &&
      queueItems.some((item) => item.status === "failed" && !item.jobId && cachedSourceFileItemIdSet.has(item.id)),
    [cachedSourceFileItemIdSet, queueItems, retrySourcePersistenceWarning]
  );

  function commitSession(nextSession: BatchSessionRecord) {
    sessionRef.current = nextSession;
    setSession(nextSession);
    saveBatchSession(nextSession);
  }

  function updateSessionItem(itemId: string, updater: (item: BatchUploadItemRecord) => BatchUploadItemRecord) {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      return null;
    }

    const nextSession: BatchSessionRecord = {
      ...currentSession,
      items: currentSession.items.map((item) => (item.id === itemId ? updater(item) : item)),
      updatedAt: new Date().toISOString(),
    };
    commitSession(nextSession);
    return nextSession;
  }

  function setBatchTriageScope(nextIssuesOnly: boolean) {
    setIssuesOnly(nextIssuesOnly);
  }

  function setBatchReadyScope(nextReadyOnly: boolean) {
    if (nextReadyOnly && (issuesOnly || readyCount === 0)) {
      return;
    }

    setReadyOnly(nextReadyOnly);
  }

  function updateQualityThreshold(nextThreshold: number) {
    setQualityThreshold(nextThreshold);
    setDownloadError(null);
  }

  const selectBatchJob = useCallback((jobId: string) => {
    startTransition(() => {
      setActiveJobId(jobId);
    });
  }, []);

  const inspectBatchJobFromExportSummary = useCallback(
    (jobId: string) => {
      selectBatchJob(jobId);
      queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [selectBatchJob]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextHref = getBatchWorkspaceHref(
      batchId,
      {
        prioritizeIssues,
        issuesOnly,
        readyOnly,
        selectedJobId: activeJobId,
        selectedPreset,
        selectedQualityThreshold: qualityThreshold,
      },
      window.location.hash
    );

    if (currentHref !== nextHref) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [activeJobId, batchId, issuesOnly, prioritizeIssues, qualityThreshold, readyOnly, selectedPreset]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const nextItems: BatchUploadItemRecord[] = session.items.map((item) => {
      if (retryingItemIdSet.has(item.id)) {
        return item;
      }

      if (!item.jobId) {
        return item;
      }

      const job = jobsById.get(item.jobId);
      if (!job) {
        return item;
      }

      return {
        ...item,
        status: job.status === "ready" ? "ready" : job.status === "failed" ? "failed" : "processing",
        error: job.error,
        updatedAt: job.updatedAt,
      };
    });

    const sessionChanged =
      session.batchExportPreset !== selectedPreset ||
      session.qualityThreshold !== qualityThreshold ||
      JSON.stringify(nextItems) !== JSON.stringify(session.items);
    if (!sessionChanged) {
      return;
    }

    const nextSession: BatchSessionRecord = {
      ...session,
      batchExportPreset: selectedPreset,
      qualityThreshold,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };
    commitSession(nextSession);
  }, [jobsById, qualityThreshold, retryingItemIdSet, selectedPreset, session]);

  useEffect(() => {
    if (queueItems.length === 0) {
      if (activeJobId !== null) {
        setActiveJobId(null);
      }
      return;
    }

    if (activeJobId && queueItems.some((item) => item.jobId === activeJobId)) {
      return;
    }

    setActiveJobId(getPreferredBatchJobId(queueItems, false));
  }, [activeJobId, queueItems]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (readyOnly && (issuesOnly || readyCount === 0)) {
      setReadyOnly(false);
    }
  }, [issuesOnly, readyCount, readyOnly, session]);

  const selectedJob =
    (activeJobId ? jobs.find((job) => job.jobId === activeJobId) : null) ??
    null;
  const readyJobNavigation = useMemo(
    () => getReadyBatchJobNavigation(queueItems, selectedQueueItem?.status === "ready" ? selectedQueueItem.jobId : null),
    [queueItems, selectedQueueItem?.jobId, selectedQueueItem?.status]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (readyJobNavigation.currentIndex < 0 || readyJobNavigation.jobIds.length < 2) {
      return;
    }

    function handleReadySourceShortcut(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const direction = getReadyBatchJobShortcutDirection({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        isContentEditable: target?.isContentEditable ?? false,
        targetTagName: target?.tagName ?? null,
      });

      if (!direction) {
        return;
      }

      const nextJobId = direction === "previous" ? readyJobNavigation.previousJobId : readyJobNavigation.nextJobId;
      if (!nextJobId) {
        return;
      }

      event.preventDefault();
      selectBatchJob(nextJobId);
    }

    window.addEventListener("keydown", handleReadySourceShortcut);
    return () => window.removeEventListener("keydown", handleReadySourceShortcut);
  }, [
    readyJobNavigation.currentIndex,
    readyJobNavigation.jobIds.length,
    readyJobNavigation.nextJobId,
    readyJobNavigation.previousJobId,
    selectBatchJob,
  ]);

  const aggregateClips = useMemo<AggregateClip[]>(() => {
    return jobs
      .flatMap((job) =>
        job.clips.map((clip) => ({
          jobId: job.jobId,
          fileName: job.sourceVideo.file_name,
          clip,
        }))
      )
      .filter((entry) => entry.clip.score >= qualityThreshold)
      .toSorted((left, right) => right.clip.score - left.clip.score || left.clip.start - right.clip.start);
  }, [jobs, qualityThreshold]);

  const aggregateDuration = useMemo(
    () => aggregateClips.reduce((total, entry) => total + entry.clip.duration, 0),
    [aggregateClips]
  );
  const eligibleClipCountsByJobId = useMemo(
    () =>
      new Map(
        jobs.map((job) => [job.jobId, job.clips.filter((clip) => clip.score >= qualityThreshold).length])
      ),
    [jobs, qualityThreshold]
  );
  const eligibleClipDurationsByJobId = useMemo(
    () =>
      new Map(
        jobs.map((job) => [
          job.jobId,
          job.clips.reduce((total, clip) => (clip.score >= qualityThreshold ? total + clip.duration : total), 0),
        ])
      ),
    [jobs, qualityThreshold]
  );
  const readySourceEligibleClipSummaries = useMemo(
    () =>
      (session?.items ?? [])
        .filter((item): item is BatchUploadItemRecord & { jobId: string } => item.status === "ready" && Boolean(item.jobId))
        .map((item, index) => ({
          jobId: item.jobId,
          fileName: jobsById.get(item.jobId)?.sourceVideo.file_name ?? item.fileName,
          eligibleClipCount: eligibleClipCountsByJobId.get(item.jobId) ?? 0,
          eligibleDuration: eligibleClipDurationsByJobId.get(item.jobId) ?? 0,
          readySourceIndex: index,
        }))
        .toSorted(
          (left, right) =>
            right.eligibleDuration - left.eligibleDuration ||
            right.eligibleClipCount - left.eligibleClipCount ||
            left.readySourceIndex - right.readySourceIndex
        ),
    [eligibleClipCountsByJobId, eligibleClipDurationsByJobId, jobsById, session?.items]
  );
  const contributingReadySourceCount = useMemo(
    () => readySourceEligibleClipSummaries.filter((entry) => entry.eligibleClipCount > 0).length,
    [readySourceEligibleClipSummaries]
  );
  const nonContributingReadySourceCount = useMemo(
    () => readySourceEligibleClipSummaries.length - contributingReadySourceCount,
    [contributingReadySourceCount, readySourceEligibleClipSummaries.length]
  );
  const visibleReadySourceEligibleClipSummaries = useMemo(
    () =>
      showContributorsOnly
        ? readySourceEligibleClipSummaries.filter((entry) => entry.eligibleClipCount > 0)
        : readySourceEligibleClipSummaries,
    [readySourceEligibleClipSummaries, showContributorsOnly]
  );
  const totalReadySourceEligibleDuration = useMemo(
    () => readySourceEligibleClipSummaries.reduce((total, entry) => total + entry.eligibleDuration, 0),
    [readySourceEligibleClipSummaries]
  );
  const presetEligibleClipCounts = useMemo(
    () =>
      new Map(
        BATCH_QUALITY_THRESHOLD_PRESETS.map((preset) => [preset.value, getBatchEligibleClipCount(jobs, preset.value)])
      ),
    [jobs]
  );
  const activeThresholdPreset =
    BATCH_QUALITY_THRESHOLD_PRESETS.find((preset) => preset.value === qualityThreshold) ?? null;
  const nextBroaderThresholdPreset = getNextBroaderBatchQualityThresholdPreset(qualityThreshold);
  const nextBroaderPresetEligibleClipCount = nextBroaderThresholdPreset
    ? presetEligibleClipCounts.get(nextBroaderThresholdPreset.value) ?? 0
    : 0;
  const nextBroaderReadySourcePreview = useMemo<ReadySourceRecoveryPreview[]>(
    () =>
      nextBroaderThresholdPreset
        ? (session?.items ?? [])
            .filter((item): item is BatchUploadItemRecord & { jobId: string } => item.status === "ready" && Boolean(item.jobId))
            .map((item, index) => {
              const job = jobsById.get(item.jobId);
              const eligibleMetrics =
                job?.clips.reduce(
                  (metrics, clip) => {
                    if (clip.score >= nextBroaderThresholdPreset.value) {
                      metrics.eligibleClipCount += 1;
                      metrics.eligibleDuration += clip.duration;
                    }

                    return metrics;
                  },
                  { eligibleClipCount: 0, eligibleDuration: 0 }
                ) ?? { eligibleClipCount: 0, eligibleDuration: 0 };

              return {
                jobId: item.jobId,
                fileName: job?.sourceVideo.file_name ?? item.fileName,
                eligibleClipCount: eligibleMetrics.eligibleClipCount,
                eligibleDuration: eligibleMetrics.eligibleDuration,
                readySourceIndex: index,
              };
            })
            .filter((entry) => entry.eligibleClipCount > 0)
            .toSorted(
              (left, right) =>
                right.eligibleDuration - left.eligibleDuration ||
                right.eligibleClipCount - left.eligibleClipCount ||
                left.readySourceIndex - right.readySourceIndex
            )
        : [],
    [jobsById, nextBroaderThresholdPreset, session?.items]
  );
  const nextBroaderReadySourcePreviewList = nextBroaderReadySourcePreview.slice(0, 3);
  const nextBroaderReadySourceOverflowCount = Math.max(
    0,
    nextBroaderReadySourcePreview.length - nextBroaderReadySourcePreviewList.length
  );
  const nextBroaderReadySourceMessage =
    nextBroaderReadySourcePreview.length === 1
      ? `from ${nextBroaderReadySourcePreview[0]?.fileName}`
      : nextBroaderReadySourcePreview.length > 1
        ? `across ${nextBroaderReadySourcePreview.length} ready sources`
        : "";
  const activePreset = getPackageExportPresetOption(selectedPreset);
  const failedCount = session?.items.filter((item) => item.status === "failed").length ?? 0;
  const processingCount = session?.items.filter((item) => item.status === "processing").length ?? 0;
  const queueProgress =
    session && session.items.length > 0
      ? Math.round(((readyCount + failedCount) / session.items.length) * 100)
      : 0;

  useEffect(() => {
    if (showContributorsOnly && nonContributingReadySourceCount === 0) {
      setShowContributorsOnly(false);
    }
  }, [nonContributingReadySourceCount, showContributorsOnly]);

  const aggregateSelections = useMemo(() => {
    return jobs
      .map((job) => ({
        jobId: job.jobId,
        clipIds: job.clips.filter((clip) => clip.score >= qualityThreshold).map((clip) => clip.id),
      }))
      .filter((selection) => selection.clipIds.length > 0);
  }, [jobs, qualityThreshold]);
  const batchPackageTree = useMemo(
    () => buildBatchPackageTree(session?.label || batchId, aggregateSelections, selectedPreset),
    [aggregateSelections, batchId, selectedPreset, session?.label]
  );

  async function handleRetryBatchItem(item: BatchUploadItemRecord) {
    if (retryingItemIdSet.has(item.id)) {
      return;
    }

    setRetryingItemIds((current) => [...current, item.id]);

    try {
      if (item.jobId) {
        updateSessionItem(item.id, (current) => ({
          ...current,
          status: "processing",
          error: null,
          uploadPhase: "complete",
          uploadProgress: 100,
          updatedAt: new Date().toISOString(),
        }));
        await retryJob(item.jobId);
        selectBatchJob(item.jobId);
        await mutate();
        return;
      }

      const file = await loadBatchSourceFile(batchId, item.id);
      if (!file) {
        setCachedSourceFileItemIds((current) => current.filter((value) => value !== item.id));
        updateSessionItem(item.id, (current) => ({
          ...current,
          error: "The original source is no longer cached in this browser. Re-queue it from home.",
          updatedAt: new Date().toISOString(),
        }));
        return;
      }

      updateSessionItem(item.id, (current) => ({
        ...current,
        status: "uploading",
        uploadPhase: "validating",
        uploadProgress: 0,
        error: null,
        updatedAt: new Date().toISOString(),
      }));

      const uploadTask = createJob(file, {
        onPhaseChange(phase) {
          updateSessionItem(item.id, (current) => ({
            ...current,
            status: phase === "processing" ? "processing" : "uploading",
            uploadPhase: phase,
            uploadProgress: phase === "processing" ? 100 : current.uploadProgress,
            error: null,
            updatedAt: new Date().toISOString(),
          }));
        },
        onUploadProgress(progress) {
          updateSessionItem(item.id, (current) => ({
            ...current,
            status: "uploading",
            uploadProgress: progress.percentage,
            error: null,
            updatedAt: new Date().toISOString(),
          }));
        },
      });
      const job = await uploadTask.promise;
      await removeBatchSourceFile(batchId, item.id);
      setCachedSourceFileItemIds((current) => current.filter((value) => value !== item.id));
      updateSessionItem(item.id, (current) => ({
        ...current,
        jobId: job.jobId,
        status: "processing",
        uploadPhase: "complete",
        uploadProgress: 100,
        error: null,
        updatedAt: new Date().toISOString(),
      }));
      selectBatchJob(job.jobId);
    } catch (retryFailure) {
      const apiError =
        retryFailure instanceof ApiError
          ? retryFailure
          : new ApiError({
              code: "request_failed",
              message: "The source could not be retried right now.",
              retryable: true,
            });
      updateSessionItem(item.id, (current) => ({
        ...current,
        status: "failed",
        error: apiError.message,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setRetryingItemIds((current) => current.filter((value) => value !== item.id));
    }
  }

  async function handleDownloadCombinedPackage() {
    if (aggregateSelections.length === 0 || !session) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await downloadBatchClipPackage(aggregateSelections, {
        batchLabel: session.label || batchId,
        preset: selectedPreset,
        qualityThreshold,
      });
      const objectUrl = URL.createObjectURL(response.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = response.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof ApiError
          ? downloadFailure
          : new ApiError({
              code: "batch_package_export_failed",
              message: "The combined package could not be built right now.",
              retryable: true,
            })
      );
    } finally {
      setIsDownloading(false);
    }
  }

  if (!session) {
    return (
      <WorkspaceFrame>
        <EmptyState
          eyebrow="Batch workspace"
          title="Batch session not found"
          description="This browser does not have a saved record for that batch session yet."
          action={
            <Link href="/" className={buttonClassName({ variant: "primary" })}>
              Return home
            </Link>
          }
        />
      </WorkspaceFrame>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <WorkspaceFrame>
        <ErrorState
          title="Batch workspace unavailable"
          description={error instanceof Error ? error.message : "The batch jobs could not be loaded."}
          action={
            <Button variant="secondary" onClick={() => void mutate()}>
              <RefreshCcw className="size-4" />
              Retry
            </Button>
          }
        />
      </WorkspaceFrame>
    );
  }

  const footerNotes = [
    {
      label: "Batch logic",
      body: "Uploads are queued sequentially to keep the intake path predictable while each job continues processing independently on the backend.",
    },
    {
      label: "Aggregate export",
      body: "The combined package groups clip files by job and keeps the manifest linked by job ID, clip ID, and stable file names.",
    },
    {
      label: "Thresholding",
      body: "The score threshold is a review convenience. You can still open any individual job workspace to inspect clips in full detail.",
    },
  ];

  return (
    <WorkspaceFrame>
      <div className="space-y-6">
        <TopBar
          eyebrow="Batch workspace"
          subtitle="Queue multiple sources, monitor every job, and export top clips across the full batch."
          items={[
            { label: "Overview", href: "#batch-overview" },
            { label: "Queue", href: "#batch-queue" },
            { label: "Aggregate export", href: "#aggregate-export" },
            { label: "Notes", href: "#batch-notes" },
          ]}
          action={
            <Button variant="primary" onClick={() => void handleDownloadCombinedPackage()} disabled={aggregateSelections.length === 0 || isDownloading}>
              {isDownloading ? <RefreshCcw className="size-4 animate-spin" /> : <Download className="size-4" />}
              {aggregateSelections.length > 0 ? getBatchExportActionLabel(aggregateClips.length, selectedPreset) : "No eligible clips"}
            </Button>
          }
        />

        <section id="batch-overview" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card tone="elevated">
            <SectionHeader
              eyebrow="Batch summary"
              title={session.label}
              description="Every source keeps its own job and workspace, while the batch session tracks queue progress and makes cross-job export practical."
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetric label="Sources" value={String(session.items.length)} />
              <OverviewMetric label="Ready" value={String(readyCount)} />
              <OverviewMetric label="Processing" value={String(processingCount)} />
              <OverviewMetric label="Failed" value={String(failedCount)} />
            </div>

            <div className="mt-6 rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="metric-label text-[var(--muted)]">Queue completion</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    {readyCount + failedCount} of {session.items.length} sources have reached a terminal state.
                  </div>
                </div>
                <div className="text-sm font-semibold text-[var(--text)]">{queueProgress}%</div>
              </div>
              <ProgressBar value={queueProgress} className="mt-4" />
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Cross-job export"
              title="Top clips across the batch"
              description="Set a score floor, choose a package preset, then export one combined archive that stays aligned with the single-workspace presets."
            />

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="size-4" />
                    Quality threshold
                  </span>
                  <span className="font-semibold text-[var(--text)]">{qualityThreshold}/100</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={qualityThreshold}
                  onChange={(event) => updateQualityThreshold(Number(event.target.value))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {BATCH_QUALITY_THRESHOLD_PRESETS.map((preset) => {
                    const isActive = qualityThreshold === preset.value;
                    const eligibleClipCount = presetEligibleClipCounts.get(preset.value) ?? 0;

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => updateQualityThreshold(preset.value)}
                        className={[
                          "rounded-[1rem] border px-3 py-3 text-left transition",
                          isActive
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]"
                            : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[var(--text)]">{preset.label}</span>
                          <span className="font-mono text-xs text-[var(--muted-strong)]">{preset.value}+</span>
                        </div>
                        <div className="mt-2 inline-flex rounded-full border border-[var(--line)] bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium tracking-[0.01em] text-[var(--muted-strong)]">
                          {eligibleClipCount} eligible {eligibleClipCount === 1 ? "clip" : "clips"}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  {activeThresholdPreset
                    ? `${activeThresholdPreset.label} keeps clips at ${qualityThreshold}+ so the batch export stays aligned with a common review floor.`
                    : `Custom threshold keeps clips at ${qualityThreshold}+ for a more specific review pass.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <OverviewMetric label="Eligible clips" value={String(aggregateClips.length)} />
                <OverviewMetric label="Total duration" value={formatSeconds(aggregateDuration)} />
              </div>

              <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="metric-label text-[var(--muted)]">Eligible clips by ready source</div>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      {readySourceEligibleClipSummaries.length > 0
                        ? `${contributingReadySourceCount} of ${readySourceEligibleClipSummaries.length} ready ${
                            readySourceEligibleClipSummaries.length === 1 ? "source contributes" : "sources contribute"
                          } clips at ${qualityThreshold}+ before export.${showContributorsOnly && nonContributingReadySourceCount > 0 ? ` Contributors-only view hides ${nonContributingReadySourceCount} ${nonContributingReadySourceCount === 1 ? "source" : "sources"} below the current threshold.` : ""}`
                        : "Ready sources will appear here as soon as their jobs finish processing."}
                    </p>
                  </div>
                  {nonContributingReadySourceCount > 0 ? (
                    <Button
                      size="sm"
                      variant={showContributorsOnly ? "primary" : "secondary"}
                      aria-pressed={showContributorsOnly}
                      onClick={() => setShowContributorsOnly((current) => !current)}
                    >
                      Contributors only
                    </Button>
                  ) : null}
                </div>
                {contributingReadySourceCount > 0 && visibleReadySourceEligibleClipSummaries.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {visibleReadySourceEligibleClipSummaries.map((entry, index) => {
                      const isActiveSource = entry.jobId === activeJobId;
                      const eligibleDurationShare =
                        totalReadySourceEligibleDuration > 0 ? entry.eligibleDuration / totalReadySourceEligibleDuration : 0;
                      const contributionRankLabel = `${formatContributionRank(index + 1)} by contribution`;

                      return (
                        <div
                          key={entry.jobId}
                          data-testid={`aggregate-source-summary-${entry.jobId}`}
                          className={[
                            "flex flex-wrap items-center justify-between gap-3 rounded-[0.95rem] border px-3 py-3 transition",
                            isActiveSource
                              ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                              : "border-[var(--line)] bg-[var(--surface-dark)]/35",
                          ].join(" ")}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-[var(--text)]">{entry.fileName}</div>
                              <Badge
                                tone={index === 0 ? "accent" : "neutral"}
                                className="shrink-0 px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]"
                              >
                                {contributionRankLabel}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              {entry.eligibleClipCount > 0 ? "Included in the current export selection." : "Below the current threshold."}
                            </div>
                            <div className="mt-3 max-w-xl">
                              <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted-strong)]">
                                <span>Contribution</span>
                                <span>{formatPercent(eligibleDurationShare)} of eligible duration</span>
                              </div>
                              <ProgressBar
                                value={eligibleDurationShare * 100}
                                ariaLabel={`${entry.fileName} contribution to eligible duration`}
                                className="mt-1.5 h-2 border-[var(--line)] bg-white/[0.04]"
                                barClassName={isActiveSource ? "bg-[var(--accent-strong)]" : undefined}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="rounded-full border border-[var(--line)] bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-[var(--muted-strong)]">
                              {entry.eligibleClipCount} eligible {entry.eligibleClipCount === 1 ? "clip" : "clips"}
                            </span>
                            <span className="rounded-full border border-[var(--line)] bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-[var(--muted-strong)]">
                              {formatSeconds(entry.eligibleDuration)} eligible duration
                            </span>
                            <Button
                              size="sm"
                              variant={isActiveSource ? "primary" : "secondary"}
                              onClick={() => inspectBatchJobFromExportSummary(entry.jobId)}
                              aria-label={`Inspect ${entry.fileName}`}
                              aria-pressed={isActiveSource}
                            >
                              Inspect source
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : readySourceEligibleClipSummaries.length > 0 ? (
                  <div className="mt-4 rounded-[0.95rem] border border-dashed border-[var(--line)] bg-[var(--surface-dark)]/25 px-4 py-4">
                    <p className="text-sm text-[var(--muted)]">
                      No ready sources contribute clips at {qualityThreshold}+ right now.
                    </p>
                    {nextBroaderThresholdPreset ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="text-xs leading-5 text-[var(--muted)]">
                          {nextBroaderPresetEligibleClipCount > 0
                            ? `${nextBroaderThresholdPreset.label} ${nextBroaderThresholdPreset.value}+ reopens ${nextBroaderPresetEligibleClipCount} eligible ${
                                nextBroaderPresetEligibleClipCount === 1 ? "clip" : "clips"
                              }${nextBroaderReadySourceMessage ? ` ${nextBroaderReadySourceMessage}` : ""} without dragging the slider.`
                            : `Jump to ${nextBroaderThresholdPreset.label} ${nextBroaderThresholdPreset.value}+ to keep broadening the export floor.`}
                        </p>
                        {nextBroaderReadySourcePreviewList.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {nextBroaderReadySourcePreviewList.map((entry) => {
                              const isActivePreviewSource = activeJobId === entry.jobId;
                              return (
                                <Button
                                  key={entry.jobId}
                                  size="sm"
                                  variant={isActivePreviewSource ? "primary" : "secondary"}
                                  className="rounded-full px-2.5 py-1 text-[11px]"
                                  onClick={() => inspectBatchJobFromExportSummary(entry.jobId)}
                                  aria-label={`Inspect ${entry.fileName} from the broader-threshold preview`}
                                  aria-pressed={isActivePreviewSource}
                                >
                                  {entry.fileName} · {entry.eligibleClipCount} {entry.eligibleClipCount === 1 ? "clip" : "clips"} ·{" "}
                                  {formatSeconds(entry.eligibleDuration)} duration
                                </Button>
                              );
                            })}
                            {nextBroaderReadySourceOverflowCount > 0 ? (
                              <span className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
                                +{nextBroaderReadySourceOverflowCount} more{" "}
                                {nextBroaderReadySourceOverflowCount === 1 ? "source" : "sources"}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateQualityThreshold(nextBroaderThresholdPreset.value)}
                        >
                          Try {nextBroaderThresholdPreset.label} {nextBroaderThresholdPreset.value}+
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 xl:grid-cols-3">
                {PACKAGE_EXPORT_PRESET_OPTIONS.map((option) => {
                  const isActive = option.value === selectedPreset;
                  const Icon = option.value === "full-av" ? Film : option.value === "audio-only" ? Waves : FileJson2;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedPreset(option.value);
                        setDownloadError(null);
                      }}
                      className={[
                        "rounded-[1.2rem] border px-4 py-4 text-left transition",
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]"
                          : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-10 items-center justify-center rounded-[1rem] border border-[var(--line)] bg-white/[0.04] text-[var(--accent)]">
                          <Icon className="size-4" />
                        </div>
                        <span className="rounded-full border border-[var(--line)] bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                          {option.accent}
                        </span>
                      </div>
                      <div className="mt-4 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{option.title}</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">{activePreset.treeLabel}</div>
                <pre className="mt-3 overflow-auto rounded-[0.9rem] border border-[var(--line)] bg-[var(--surface-dark)] p-4 text-xs leading-6 text-white/75">
{batchPackageTree}
                </pre>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {selectedPreset === "metadata-only"
                    ? "The batch manifest keeps each clip grouped under its original job without re-encoding any media."
                    : "Each selected clip keeps a stable file name inside its job folder so cross-job downloads still map cleanly back to the source workspace."}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section id="batch-queue" ref={queueSectionRef} className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <Card>
            <SectionHeader
              eyebrow="Queued jobs"
              title="Switch between uploaded sources"
              description="Click any source to inspect its latest status and top clips, or open the full single-job workspace when you need deeper review."
            />

            {prioritizeIssues && queueHasIssues ? (
              <div
                data-testid="batch-queue-attention-banner"
                className="mt-6 rounded-[1.1rem] border border-red-500/25 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-100"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Attention-first view</div>
                    <p className="mt-2 leading-6">
                      {issuesOnly
                        ? "Failed and cancelled sources are isolated below so retry triage stays focused before you return to the ready jobs."
                        : "Failed and cancelled sources stay pinned to the top of this reopened batch so the items that need retry or cleanup remain visible first."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={issuesOnly ? "primary" : "secondary"}
                      onClick={() => setBatchTriageScope(true)}
                      aria-pressed={issuesOnly}
                    >
                      Only issues
                    </Button>
                    <Button
                      size="sm"
                      variant={issuesOnly ? "secondary" : "primary"}
                      onClick={() => setBatchTriageScope(false)}
                      aria-pressed={!issuesOnly}
                    >
                      All sources
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-red-100/80">
                  {issuesOnly
                    ? `Showing ${issueCount} issue ${issueCount === 1 ? "source" : "sources"} out of ${session.items.length}.`
                    : "Ready and processing jobs are visible again, with issue items still pinned first."}
                </p>
              </div>
            ) : null}

            {!issuesOnly ? (
              <div className="mt-6 rounded-[1.1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--text)]">Queue focus</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Collapse the queue to ready workspaces when you want to stay in clip review mode without scanning uploads that are still processing or need cleanup.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={readyOnly ? "secondary" : "primary"}
                      onClick={() => setBatchReadyScope(false)}
                      aria-pressed={!readyOnly}
                    >
                      Full queue
                    </Button>
                    <Button
                      size="sm"
                      variant={readyOnly ? "primary" : "secondary"}
                      onClick={() => setBatchReadyScope(true)}
                      disabled={readyCount === 0}
                      aria-pressed={readyOnly}
                    >
                      Ready only
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {readyOnly
                    ? `Showing ${queueItems.length} ready ${queueItems.length === 1 ? "source" : "sources"} out of ${session.items.length} in the full queue.`
                    : readyCount > 0
                      ? `${readyCount} ready ${readyCount === 1 ? "source is" : "sources are"} available for focused review.`
                      : "Ready sources will appear here as soon as processing finishes."}
                </p>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {hasTabOnlyRetrySources ? (
                <div
                  data-testid="batch-retry-persistence-warning"
                  className="rounded-[1rem] border border-[var(--line-strong)] bg-white/[0.05] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">Tab-only retry cache</Badge>
                    <p className="text-sm text-[var(--text)]">{retrySourcePersistenceWarning}</p>
                  </div>
                </div>
              ) : null}
              {queueItems.map((item) => {
                const job = item.jobId ? jobsById.get(item.jobId) ?? null : null;
                const active = item.jobId && item.jobId === selectedJob?.jobId;
                const isRetrying = retryingItemIdSet.has(item.id);
                const hasCachedSourceFile = cachedSourceFileItemIdSet.has(item.id);
                const canRetry = item.status === "failed" && (Boolean(item.jobId) || hasCachedSourceFile);
                const statusLabel = job ? (isRetrying ? "processing" : job.status) : item.status;
                const progressValue = statusLabel === "ready" ? 100 : item.uploadProgress;
                const ordinal = queueItemOrdinals.get(item.id) ?? 0;
                const readyQueuePosition = readyQueuePositions.get(item.id) ?? null;

                return (
                  <div
                    key={item.id}
                    data-testid="batch-queue-item"
                    className={[
                      "w-full rounded-[1.15rem] border px-4 py-4 text-left transition duration-200",
                      active
                        ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => item.jobId && selectBatchJob(item.jobId)}
                        disabled={!item.jobId}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-[var(--muted)]">{ordinal.toString().padStart(2, "0")}</span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--text)]">{item.fileName}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              {job
                                ? `${statusLabel} · ${job.sourceVideo.duration_seconds ? formatSeconds(job.sourceVideo.duration_seconds) : "Duration pending"}`
                                : item.error || item.status}
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {readyQueuePosition ? (
                          <Badge tone={readyQueuePosition.isCurrent ? "accent" : "muted"}>
                            Ready source {readyQueuePosition.index} of {readyQueuePosition.total}
                          </Badge>
                        ) : null}
                        {readyQueuePosition?.total === 1 ? (
                          <Badge tone="accent">Only ready source</Badge>
                        ) : null}
                        {readyQueuePosition?.total !== 1 && readyQueuePosition?.isFirst ? (
                          <Badge tone="muted">First ready</Badge>
                        ) : null}
                        {readyQueuePosition?.total !== 1 && readyQueuePosition?.isLast ? (
                          <Badge tone="muted">Last ready</Badge>
                        ) : null}
                        {readyQueuePosition?.isCurrent ? (
                          <Badge tone="accent">Current ready</Badge>
                        ) : null}
                        <Badge tone={statusLabel === "ready" ? "accent" : statusLabel === "failed" ? "danger" : "neutral"}>
                          {statusLabel}
                        </Badge>
                        {canRetry ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleRetryBatchItem(item)}
                            disabled={isRetrying}
                            aria-label={`Retry ${item.fileName}`}
                          >
                            <RefreshCcw className={isRetrying ? "size-4 animate-spin" : "size-4"} />
                            {isRetrying ? "Retrying" : "Retry source"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <ProgressBar value={progressValue} className="mt-4" />
                    {item.status === "failed" && !item.jobId && hasCachedSourceFile && retrySourcePersistenceWarning ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        This retry source is cached only in the current tab. If you refresh or reopen the workspace, re-queue it from home.
                      </p>
                    ) : null}
                    {item.status === "failed" && !item.jobId && !hasCachedSourceFile ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        The original source is no longer cached in this browser, so this retry has to start from home.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card tone="elevated">
            {selectedJob ? (
              <>
                <SectionHeader
                  eyebrow="Selected source"
                  title={selectedJob.sourceVideo.file_name}
                  description="Review the strongest clips from the active upload, then jump into the full workspace if you need the timeline and detailed reasoning."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <OverviewMetric label="Status" value={selectedJob.status} />
                  <OverviewMetric label="Clips" value={String(selectedJob.summary?.clip_count ?? selectedJob.clips.length)} />
                  <OverviewMetric label="Top score" value={formatSignedScore(selectedJob.summary?.top_score ?? 0)} />
                </div>

                {readyJobNavigation.currentIndex >= 0 && readyJobNavigation.jobIds.length > 1 ? (
                  <div className="mt-6 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="metric-label text-[var(--muted)]">Ready source navigation</div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Source {readyJobNavigation.currentIndex + 1} of {readyJobNavigation.jobIds.length} ready workspaces in the current queue order. Use{" "}
                          <ShortcutKey>[</ShortcutKey> and <ShortcutKey>]</ShortcutKey> to step between neighbors, or jump straight to the first and last ready sources below.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => readyJobNavigation.firstJobId && selectBatchJob(readyJobNavigation.firstJobId)}
                          disabled={!readyJobNavigation.firstJobId || readyJobNavigation.currentIndex <= 0}
                          aria-label="First ready source"
                        >
                          <ChevronsLeft className="size-4" />
                          First source
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => readyJobNavigation.previousJobId && selectBatchJob(readyJobNavigation.previousJobId)}
                          disabled={!readyJobNavigation.previousJobId}
                          aria-label="Previous ready source"
                        >
                          <ChevronLeft className="size-4" />
                          Previous source
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => readyJobNavigation.nextJobId && selectBatchJob(readyJobNavigation.nextJobId)}
                          disabled={!readyJobNavigation.nextJobId}
                          aria-label="Next ready source"
                        >
                          Next source
                          <ChevronRight className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => readyJobNavigation.lastJobId && selectBatchJob(readyJobNavigation.lastJobId)}
                          disabled={!readyJobNavigation.lastJobId || readyJobNavigation.currentIndex === readyJobNavigation.jobIds.length - 1}
                          aria-label="Last ready source"
                        >
                          Last source
                          <ChevronsRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/jobs/${selectedJob.jobId}`}
                    className={buttonClassName({ variant: "primary" })}
                  >
                    Open full workspace
                    <ExternalLink className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void mutate()}
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    <RefreshCcw className="size-4" />
                    Refresh jobs
                  </button>
                </div>

                {selectedJob.status === "failed" ? (
                  <div className="mt-6 rounded-[1.1rem] border border-red-500/30 bg-[rgba(120,24,32,0.18)] px-4 py-4 text-sm text-red-100">
                    <div className="font-medium">Processing failed for this source</div>
                    <p className="mt-2 leading-6">{selectedJob.error ?? "The backend could not finish processing this source."}</p>
                    <p className="mt-2 text-xs text-red-100/80">
                      Use the retry action beside this source in the queue list to run it again without leaving the batch workspace.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {selectedJob.clips.slice(0, 5).map((clip) => (
                      <Link
                        key={`${selectedJob.jobId}-${clip.id}`}
                        href={`/jobs/${selectedJob.jobId}?clip=${clip.id}`}
                        className="block rounded-[1.15rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4 transition duration-200 hover:border-[var(--line-strong)] hover:bg-white/[0.05]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={clip.quality_label === "Excellent" ? "accent" : clip.quality_label === "Good" ? "neutral" : "danger"}>
                              {clip.quality_label}
                            </Badge>
                            <Badge tone="neutral">{clip.selection_recommendation}</Badge>
                          </div>
                          <div className="font-mono text-xs text-[var(--muted)]">{formatSignedScore(clip.score)}</div>
                        </div>
                        <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{clip.text}</div>
                        <div className="mt-3 text-sm text-[var(--muted)]">
                          {selectedJob.sourceVideo.file_name} · {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : issuesOnly && queueHasIssues ? (
              <>
                <SectionHeader
                  eyebrow="Selected source"
                  title="Issue triage is active"
                  description="The visible failed or cancelled sources do not have a ready workspace yet. Retry them from the queue, or switch back to all sources when you want to review completed jobs again."
                />

                <div className="mt-6 rounded-[1.1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                  <div className="metric-label text-[var(--muted)]">Visible issue sources</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">{queueItems.length}</div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    Keep the list collapsed while you retry the failed uploads, then switch back to all sources to reopen the
                    ready jobs and continue review.
                  </p>
                  <div className="mt-4">
                    <Button size="sm" variant="secondary" onClick={() => setBatchTriageScope(false)}>
                      Show all sources
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                eyebrow="Selected source"
                title={isLoading ? "Loading queued jobs" : "No completed jobs yet"}
                description="As soon as one job reaches the processing or ready state, you will be able to inspect it here."
              />
            )}
          </Card>
        </section>

        <section id="aggregate-export">
          <Card>
            <SectionHeader
              eyebrow="Aggregate review"
              title="Thresholded top clips"
              description="These clips already meet the current quality floor across every ready upload in the batch."
            />

            {aggregateClips.length > 0 ? (
              <div className="mt-6 grid gap-3 xl:grid-cols-2">
                {aggregateClips.slice(0, 10).map((entry, index) => (
                  <div
                    key={`${entry.jobId}-${entry.clip.id}`}
                    className="rounded-[1.1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={entry.clip.quality_label === "Excellent" ? "accent" : entry.clip.quality_label === "Good" ? "neutral" : "danger"}>
                          {entry.clip.quality_label}
                        </Badge>
                        <Badge tone="neutral">{entry.fileName}</Badge>
                      </div>
                      <span className="font-mono text-xs text-[var(--muted)]">{`#${index + 1}`}</span>
                    </div>
                    <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{entry.clip.text}</div>
                    <div className="mt-2 text-sm text-[var(--muted)]">
                      Score {formatSignedScore(entry.clip.score)} · {formatSeconds(entry.clip.duration)} · {entry.clip.selection_recommendation}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  eyebrow="Aggregate export"
                  title="No clips clear the current threshold"
                  description="Lower the quality slider or wait for more jobs to finish processing."
                />
              </div>
            )}

            {downloadError ? (
              <div className="mt-6 rounded-[1.1rem] border border-red-500/30 bg-[rgba(120,24,32,0.18)] px-4 py-4 text-sm text-red-100">
                <div className="font-medium">Combined export failed</div>
                <p className="mt-2 leading-6">{downloadError.message}</p>
                <p className="mt-2 text-xs text-red-100/80">
                  {isRetryableApiError(downloadError)
                    ? "You can retry the combined export without changing the current threshold."
                    : "Adjust the threshold or refresh the batch session before retrying."}
                </p>
              </div>
            ) : null}
          </Card>
        </section>

        <FooterNotes id="batch-notes" title="Batch notes" notes={footerNotes} />
      </div>
    </WorkspaceFrame>
  );
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-dark)] px-1.5 py-0.5 font-mono text-[11px] text-white/80">
      {children}
    </span>
  );
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <PageContainer className="pt-4 pb-16 sm:pt-5">{children}</PageContainer>
    </AppShell>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</div>
    </div>
  );
}

function getBatchExportActionLabel(clipCount: number, preset: PackageExportPreset) {
  if (preset === "audio-only") {
    return `Export ${clipCount} audio ${clipCount === 1 ? "clip" : "clips"}`;
  }

  if (preset === "metadata-only") {
    return `Export ${clipCount} manifest ${clipCount === 1 ? "entry" : "entries"}`;
  }

  return `Export ${clipCount} clips`;
}

function buildBatchPackageTree(
  batchLabel: string,
  selections: BatchPackageJobSelection[],
  preset: PackageExportPreset
) {
  const rootName = buildBatchPackageRootName(batchLabel, preset);
  const assetDirectory = getPackageAssetDirectory(preset);
  const lines = [`${rootName}/`, "  manifest.json"];

  if (!assetDirectory || selections.length === 0) {
    return lines.join("\n");
  }

  lines.push("  jobs/");

  selections.slice(0, 3).forEach((selection) => {
    lines.push(`    ${selection.jobId}/`, `      ${assetDirectory}/`);
    selection.clipIds
      .slice(0, 2)
      .forEach((clipId, index) => {
        const fileName = buildPackageClipFileName(index + 1, clipId, preset);
        if (fileName) {
          lines.push(`        ${fileName}`);
        }
      });

    const extraCount = Math.max(0, selection.clipIds.length - 2);
    if (extraCount > 0) {
      lines.push(`        ... ${extraCount} more ${preset === "audio-only" ? "audio" : "clip"} files`);
    }
  });

  const extraJobs = Math.max(0, selections.length - 3);
  if (extraJobs > 0) {
    lines.push(`    ... ${extraJobs} more ${extraJobs === 1 ? "job" : "jobs"}`);
  }

  return lines.join("\n");
}
