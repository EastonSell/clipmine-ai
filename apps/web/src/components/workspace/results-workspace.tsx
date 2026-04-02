"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCcw } from "lucide-react";
import { useMemo, useRef } from "react";
import useSWR from "swr";

import { buttonClassName } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FooterNotes } from "@/components/ui/footer-notes";
import { ProcessingState } from "@/components/ui/processing-state";
import { Tabs } from "@/components/ui/tabs";
import { AppShell } from "@/components/ui/app-shell";
import { PageContainer } from "@/components/ui/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { getApiBaseUrl, getJob } from "@/lib/api";
import type { JobResponse } from "@/lib/types";

import { ClipDetailPanel } from "./clip-detail-panel";
import { ClipListPanel } from "./clip-list-panel";
import { ExportPanel } from "./export-panel";
import { phaseCopy, workspaceTabs, type WorkspaceTab } from "./constants";
import { JobStatusPanel } from "./job-status-panel";
import { JobSummaryPanel } from "./job-summary-panel";
import { ReviewToolbar } from "./review-toolbar";
import { SourceVideoPanel } from "./source-video-panel";
import { TimelineChart } from "./timeline-chart";
import { useWorkspaceViewModel } from "./use-workspace-view-model";
import { WorkspaceHeader } from "./workspace-header";

type ResultsWorkspaceProps = {
  jobId: string;
};

export function ResultsWorkspace({ jobId }: ResultsWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { data, error, isLoading, mutate } = useSWR<JobResponse>(
    ["job", jobId],
    () => getJob(jobId),
    {
      refreshInterval(currentJob) {
        if (!currentJob) {
          return 2500;
        }

        return currentJob.status === "queued" || currentJob.status === "processing" ? 2500 : 0;
      },
      revalidateOnFocus: false,
    }
  );

  const viewModel = useWorkspaceViewModel(jobId, data);
  const selectedClip = viewModel.selectedClip;
  const resolvedClipId = viewModel.resolvedClipId;
  const reviewSequence = useMemo(
    () => (viewModel.filters.pinnedOnly ? viewModel.shortlistedClips : [...viewModel.shortlistedClips, ...viewModel.rankedClips]),
    [viewModel.filters.pinnedOnly, viewModel.rankedClips, viewModel.shortlistedClips]
  );
  const selectedClipIndex = reviewSequence.findIndex((clip) => clip.id === resolvedClipId);

  function handleSeek(start: number, clipId?: string | null) {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      void videoRef.current.play().catch(() => undefined);
    }

    if (clipId) {
      viewModel.setActiveClipId(clipId);
    }
  }

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNavigate(target: "source" | "clips" | "timeline" | "export" | "notes") {
    if (target === "source") {
      scrollToId("source-video");
      return;
    }

    if (target === "notes") {
      scrollToId("workspace-notes");
      return;
    }

    const nextTab: WorkspaceTab =
      target === "clips" ? "clips" : target === "timeline" ? "timeline" : "export";

    viewModel.setActiveTab(nextTab);
    requestAnimationFrame(() => {
      scrollToId("workspace-features");
    });
  }

  if (isLoading) {
    return (
      <WorkspaceFrame>
        <ProcessingState
          title="Loading workspace"
          description="Fetching the latest job state from the processing API."
        />
      </WorkspaceFrame>
    );
  }

  if (error || !data) {
    return (
      <WorkspaceFrame>
        <ErrorState
          title="Workspace unavailable"
          description={error instanceof Error ? error.message : "The backend response was unavailable."}
          action={
            <button
              type="button"
              onClick={() => void mutate()}
              className={buttonClassName({ variant: "secondary" })}
            >
              <RefreshCcw className="size-4" />
              Retry
            </button>
          }
        />
      </WorkspaceFrame>
    );
  }

  const processing = data.status === "queued" || data.status === "processing";
  const exportUrl = `${getApiBaseUrl()}/api/jobs/${jobId}/export.json`;
  const videoUrl = `${getApiBaseUrl()}${data.sourceVideo.url}`;
  const footerNotes = [
    {
      label: "Source handling",
      body: "Uploads go straight to the backend job service, which keeps the original media available for playback throughout the workspace.",
    },
    {
      label: "Large files",
      body: "ClipMine now defaults to a 1 GB upload limit. Larger sources take longer to transfer, but the workspace URL stays stable while processing continues.",
    },
    {
      label: "Export",
      body: "JSON export stays aligned with the same clip ranking and timeline state shown in the workspace.",
    },
  ];

  return (
    <WorkspaceFrame>
      <div className="space-y-6">
        <TopBar
          eyebrow="ClipMine AI"
          subtitle="Review the source, inspect ranked clips, and export structured output."
          items={[
            { label: "Source", onClick: () => handleNavigate("source") },
            { label: "Best clips", onClick: () => handleNavigate("clips"), active: viewModel.activeTab === "clips" },
            { label: "Timeline", onClick: () => handleNavigate("timeline"), active: viewModel.activeTab === "timeline" },
            { label: "Export", onClick: () => handleNavigate("export"), active: viewModel.activeTab === "export" },
            { label: "Notes", onClick: () => handleNavigate("notes") },
          ]}
          action={
            <a
              href={exportUrl}
              className={buttonClassName({
                variant: processing ? "secondary" : "primary",
                className: processing ? "pointer-events-none opacity-60" : "",
              })}
              aria-disabled={processing}
              onClick={(event) => {
                if (processing) {
                  event.preventDefault();
                }
              }}
            >
              <Download className="size-4" />
              {processing ? "Export pending" : "Export JSON"}
            </a>
          }
        />

        <WorkspaceHeader
          title={data.sourceVideo.file_name}
          sourceVideo={data.sourceVideo}
          language={data.language}
          statusLabel={phaseCopy[data.progressPhase]}
          navigation={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleNavigate("clips")}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Best clips
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("timeline")}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("export")}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Export
              </button>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_20rem] xl:grid-cols-[minmax(0,1.55fr)_22rem]">
          <div className="space-y-6">
            <div id="source-video">
              <SourceVideoPanel videoRef={videoRef} videoUrl={videoUrl} />
            </div>
            <ClipDetailPanel
              clip={selectedClip}
              onSeek={handleSeek}
              isPinned={selectedClip ? viewModel.isPinned(selectedClip.id) : false}
              onTogglePinned={viewModel.togglePinned}
              onPrevious={() => {
                const previousClip = selectedClipIndex > 0 ? reviewSequence[selectedClipIndex - 1] : null;
                if (previousClip) {
                  handleSeek(previousClip.start, previousClip.id);
                }
              }}
              onNext={() => {
                const nextClip =
                  selectedClipIndex >= 0 && selectedClipIndex < reviewSequence.length - 1
                    ? reviewSequence[selectedClipIndex + 1]
                    : null;
                if (nextClip) {
                  handleSeek(nextClip.start, nextClip.id);
                }
              }}
              hasPrevious={selectedClipIndex > 0}
              hasNext={selectedClipIndex >= 0 && selectedClipIndex < reviewSequence.length - 1}
            />

            <div
              id="workspace-features"
              className="flex flex-wrap items-center justify-between gap-4 rounded-[1.35rem] border border-[var(--line)] bg-white/[0.04] px-4 py-3 backdrop-blur-xl"
            >
              <Tabs options={workspaceTabs} value={viewModel.activeTab} onChange={viewModel.setActiveTab} />
              <a
                href={exportUrl}
                className={buttonClassName({
                  variant: processing ? "secondary" : "primary",
                  className: processing ? "pointer-events-none opacity-60" : "",
                })}
                aria-disabled={processing}
                onClick={(event) => {
                  if (processing) {
                    event.preventDefault();
                  }
                }}
              >
                <Download className="size-4" />
                {processing ? "Export when ready" : "Download JSON"}
              </a>
            </div>

            <AnimatePresence mode="wait">
              <motion.section
                key={viewModel.activeTab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {viewModel.activeTab === "clips" ? (
                  <div className="space-y-6">
                    <ReviewToolbar
                      filters={viewModel.filters}
                      availableSignals={viewModel.availableSignals}
                      visibleCount={viewModel.shortlistedClips.length + viewModel.rankedClips.length}
                      totalCount={data.clips.length}
                      shortlistedCount={viewModel.pinnedClipIds.length}
                      hasActiveFilters={viewModel.hasActiveFilters}
                      onFiltersChange={viewModel.updateFilters}
                      onClear={viewModel.clearFilters}
                    />
                    <ClipListPanel
                      shortlistedClips={viewModel.shortlistedClips}
                      clips={viewModel.rankedClips}
                      activeClipId={resolvedClipId}
                      totalClipCount={data.clips.length}
                      hasActiveFilters={viewModel.hasActiveFilters}
                      pinnedOnly={viewModel.filters.pinnedOnly}
                      onSelect={handleSeek}
                    />
                  </div>
                ) : null}
                {viewModel.activeTab === "timeline" ? (
                  <TimelineChart
                    bins={data.timeline}
                    clips={data.clips}
                    activeClipId={resolvedClipId}
                    onSeek={handleSeek}
                  />
                ) : null}
                {viewModel.activeTab === "export" ? (
                  <ExportPanel job={data} exportUrl={exportUrl} disabled={processing} />
                ) : null}
              </motion.section>
            </AnimatePresence>
          </div>

          <aside className="space-y-6">
            <JobStatusPanel job={data} onRefresh={() => void mutate()} />
            <JobSummaryPanel job={data} />
          </aside>
        </div>

        <FooterNotes id="workspace-notes" title="Workspace notes" notes={footerNotes} />
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
