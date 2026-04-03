"use client";

import Link from "next/link";
import { Download, ExternalLink, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { loadBatchSourceFile, removeBatchSourceFile } from "@/lib/batch-source-files";
import { getOrderedBatchItems, getPreferredBatchJobId, hasBatchIssues, isBatchIssueItem } from "@/lib/batch-focus";
import { createJob, downloadBatchClipPackage, getJob, retryJob, ApiError, isRetryableApiError } from "@/lib/api";
import { loadBatchSession, saveBatchSession } from "@/lib/batch-sessions";
import { formatSeconds, formatSignedScore } from "@/lib/format";
import type { BatchSessionRecord, BatchUploadItemRecord, ClipRecord, JobResponse } from "@/lib/types";

type BatchWorkspaceProps = {
  batchId: string;
  prioritizeIssues?: boolean;
};

type AggregateClip = {
  jobId: string;
  fileName: string;
  clip: ClipRecord;
};

export function BatchWorkspace({ batchId, prioritizeIssues = false }: BatchWorkspaceProps) {
  const [session, setSession] = useState<BatchSessionRecord | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(prioritizeIssues);
  const [qualityThreshold, setQualityThreshold] = useState(84);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [retryingItemIds, setRetryingItemIds] = useState<string[]>([]);
  const sessionRef = useRef<BatchSessionRecord | null>(null);

  useEffect(() => {
    const nextSession = loadBatchSession(batchId);
    const nextIssuesOnly = prioritizeIssues && hasBatchIssues(nextSession?.items ?? []);
    const nextQueueItems = getOrderedBatchItems(nextSession?.items ?? [], prioritizeIssues, nextIssuesOnly);
    setSession(nextSession);
    sessionRef.current = nextSession;
    setIssuesOnly(nextIssuesOnly);
    setQualityThreshold(nextSession?.qualityThreshold ?? 84);
    setActiveJobId(getPreferredBatchJobId(nextQueueItems, false));
  }, [batchId, prioritizeIssues]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
  const queueItems = useMemo(
    () => getOrderedBatchItems(session?.items ?? [], prioritizeIssues, issuesOnly),
    [issuesOnly, prioritizeIssues, session?.items]
  );
  const queueItemOrdinals = useMemo(
    () => new Map((session?.items ?? []).map((item, index) => [item.id, index + 1])),
    [session?.items]
  );
  const queueHasIssues = useMemo(() => hasBatchIssues(session?.items ?? []), [session?.items]);
  const issueCount = useMemo(
    () => (session?.items ?? []).filter(isBatchIssueItem).length,
    [session?.items]
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
      session.qualityThreshold !== qualityThreshold ||
      JSON.stringify(nextItems) !== JSON.stringify(session.items);
    if (!sessionChanged) {
      return;
    }

    const nextSession: BatchSessionRecord = {
      ...session,
      qualityThreshold,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };
    commitSession(nextSession);
  }, [jobsById, qualityThreshold, retryingItemIdSet, session]);

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

  const selectedJob =
    (activeJobId ? jobs.find((job) => job.jobId === activeJobId) : null) ??
    null;

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
  const readyCount = session?.items.filter((item) => item.status === "ready").length ?? 0;
  const failedCount = session?.items.filter((item) => item.status === "failed").length ?? 0;
  const processingCount = session?.items.filter((item) => item.status === "processing").length ?? 0;
  const queueProgress =
    session && session.items.length > 0
      ? Math.round(((readyCount + failedCount) / session.items.length) * 100)
      : 0;

  const aggregateSelections = useMemo(() => {
    return jobs
      .map((job) => ({
        jobId: job.jobId,
        clipIds: job.clips.filter((clip) => clip.score >= qualityThreshold).map((clip) => clip.id),
      }))
      .filter((selection) => selection.clipIds.length > 0);
  }, [jobs, qualityThreshold]);

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
        setActiveJobId(item.jobId);
        await mutate();
        return;
      }

      const file = loadBatchSourceFile(batchId, item.id);
      if (!file) {
        updateSessionItem(item.id, (current) => ({
          ...current,
          error: "The original source is no longer available in this tab. Re-queue it from home.",
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
      removeBatchSourceFile(batchId, item.id);
      updateSessionItem(item.id, (current) => ({
        ...current,
        jobId: job.jobId,
        status: "processing",
        uploadPhase: "complete",
        uploadProgress: 100,
        error: null,
        updatedAt: new Date().toISOString(),
      }));
      setActiveJobId(job.jobId);
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
              {aggregateSelections.length > 0 ? `Export ${aggregateClips.length} clips` : "No eligible clips"}
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
              description="Set a score floor, review the total eligible duration, then export one combined package."
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
                  onChange={(event) => setQualityThreshold(Number(event.target.value))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <OverviewMetric label="Eligible clips" value={String(aggregateClips.length)} />
                <OverviewMetric label="Total duration" value={formatSeconds(aggregateDuration)} />
              </div>

              <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">Package layout</div>
                <pre className="mt-3 overflow-auto rounded-[0.9rem] border border-[var(--line)] bg-[var(--surface-dark)] p-4 text-xs leading-6 text-white/75">
{`clipmine-batch-export-${batchId}/
  manifest.json
  jobs/
    <jobId>/clips/clip_001__<clipId>.mp4`}
                </pre>
              </div>
            </div>
          </Card>
        </section>

        <section id="batch-queue" className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
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
                      onClick={() => setIssuesOnly(true)}
                      aria-pressed={issuesOnly}
                    >
                      Only issues
                    </Button>
                    <Button
                      size="sm"
                      variant={issuesOnly ? "secondary" : "primary"}
                      onClick={() => setIssuesOnly(false)}
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

            <div className="mt-6 space-y-3">
              {queueItems.map((item) => {
                const job = item.jobId ? jobsById.get(item.jobId) ?? null : null;
                const active = item.jobId && item.jobId === selectedJob?.jobId;
                const isRetrying = retryingItemIdSet.has(item.id);
                const hasCachedSourceFile = Boolean(loadBatchSourceFile(batchId, item.id));
                const canRetry = item.status === "failed" && (Boolean(item.jobId) || hasCachedSourceFile);
                const statusLabel = job ? (isRetrying ? "processing" : job.status) : item.status;
                const progressValue = statusLabel === "ready" ? 100 : item.uploadProgress;
                const ordinal = queueItemOrdinals.get(item.id) ?? 0;

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
                        onClick={() => item.jobId && setActiveJobId(item.jobId)}
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
                    {item.status === "failed" && !item.jobId && !hasCachedSourceFile ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        The original source is no longer cached in this tab, so this retry has to start from home.
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
                    <Button size="sm" variant="secondary" onClick={() => setIssuesOnly(false)}>
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
