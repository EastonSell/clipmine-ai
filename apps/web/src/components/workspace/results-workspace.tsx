"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCcw } from "lucide-react";
import { startTransition, useDeferredValue, useRef, useState } from "react";
import useSWR from "swr";

import { buttonClassName } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { ProcessingState } from "@/components/ui/processing-state";
import { Tabs } from "@/components/ui/tabs";
import { AppShell } from "@/components/ui/app-shell";
import { PageContainer } from "@/components/ui/page-container";
import { getApiBaseUrl, getJob } from "@/lib/api";
import type { JobResponse } from "@/lib/types";

import { ClipDetailPanel } from "./clip-detail-panel";
import { ClipListPanel } from "./clip-list-panel";
import { ExportPanel } from "./export-panel";
import { phaseCopy, workspaceTabs, type WorkspaceTab } from "./constants";
import { JobStatusPanel } from "./job-status-panel";
import { JobSummaryPanel } from "./job-summary-panel";
import { SourceVideoPanel } from "./source-video-panel";
import { TimelineChart } from "./timeline-chart";
import { WorkspaceHeader } from "./workspace-header";

type ResultsWorkspaceProps = {
  jobId: string;
};

export function ResultsWorkspace({ jobId }: ResultsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("clips");
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const deferredActiveClipId = useDeferredValue(activeClipId);
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

  const selectedClip =
    data?.clips.find((clip) => clip.id === deferredActiveClipId) ??
    data?.clips[0] ??
    null;
  const resolvedClipId = deferredActiveClipId ?? selectedClip?.id ?? null;

  function handleSeek(start: number, clipId?: string | null) {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      void videoRef.current.play().catch(() => undefined);
    }

    if (clipId) {
      startTransition(() => {
        setActiveClipId(clipId);
      });
    }
  }

  function handleTabChange(tab: WorkspaceTab) {
    startTransition(() => {
      setActiveTab(tab);
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

  return (
    <WorkspaceFrame>
      <div className="space-y-6">
        <WorkspaceHeader
          title={data.sourceVideo.file_name}
          sourceVideo={data.sourceVideo}
          language={data.language}
          statusLabel={phaseCopy[data.progressPhase]}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_22rem]">
          <div className="space-y-6">
            <SourceVideoPanel videoRef={videoRef} videoUrl={videoUrl} />
            <ClipDetailPanel clip={selectedClip} onSeek={handleSeek} />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs options={workspaceTabs} value={activeTab} onChange={handleTabChange} />
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
                key={activeTab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === "clips" ? (
                  <ClipListPanel clips={data.clips} activeClipId={resolvedClipId} onSelect={handleSeek} />
                ) : null}
                {activeTab === "timeline" ? (
                  <TimelineChart
                    bins={data.timeline}
                    clips={data.clips}
                    activeClipId={resolvedClipId}
                    onSeek={handleSeek}
                  />
                ) : null}
                {activeTab === "export" ? (
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
