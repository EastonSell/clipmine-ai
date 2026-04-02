"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  CircleAlert,
  CircleDashed,
  Clock3,
  Download,
  FileJson2,
  Gauge,
  LoaderCircle,
  Play,
  RefreshCcw,
  Video,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { startTransition, useDeferredValue, useRef, useState } from "react";
import useSWR from "swr";

import { getApiBaseUrl, getJob } from "@/lib/api";
import { formatBytes, formatDateTime, formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord, JobResponse, TimelineBin } from "@/lib/types";

type WorkspaceTab = "clips" | "timeline" | "export";

const phaseCopy: Record<JobResponse["progressPhase"], string> = {
  queued: "Queued",
  extracting_audio: "Extracting audio",
  transcribing: "Transcribing",
  segmenting: "Segmenting",
  scoring: "Scoring",
  ready: "Ready",
  failed: "Failed",
};

const phaseSteps: Array<{ id: JobResponse["progressPhase"]; label: string }> = [
  { id: "queued", label: "Queued" },
  { id: "extracting_audio", label: "Audio" },
  { id: "transcribing", label: "Transcript" },
  { id: "segmenting", label: "Segments" },
  { id: "scoring", label: "Score" },
  { id: "ready", label: "Ready" },
];

const tabLabels: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "clips", label: "Best Clips" },
  { id: "timeline", label: "Timeline" },
  { id: "export", label: "Export" },
];

export function ResultsWorkspace({ jobId }: { jobId: string }) {
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
      <WorkspaceFrame title="Loading workspace">
        <LoadingState copy="Fetching job state from the processing API." />
      </WorkspaceFrame>
    );
  }

  if (error || !data) {
    return (
      <WorkspaceFrame title="Workspace unavailable">
        <div className="section-frame rounded-[2.25rem] p-6 sm:p-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-red-500/30 bg-[var(--danger-soft)] px-4 py-2 text-sm font-medium text-red-300">
            <CircleAlert className="size-4" />
            The workspace could not be loaded
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted)]">
            {error instanceof Error ? error.message : "The backend response was unavailable."}
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            <RefreshCcw className="size-4" />
            Retry
          </button>
        </div>
      </WorkspaceFrame>
    );
  }

  const processing = data.status === "queued" || data.status === "processing";
  const exportUrl = `${getApiBaseUrl()}/api/jobs/${jobId}/export.json`;
  const videoUrl = `${getApiBaseUrl()}${data.sourceVideo.url}`;
  const strongestRegions = [...data.timeline]
    .filter((bin) => bin.top_clip_id)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  const telemetryItems = [
    ["Clip count", data.summary ? String(data.summary.clip_count) : "Pending"],
    ["Top score", data.summary ? formatSignedScore(data.summary.top_score) : "Pending"],
    ["Average", data.summary ? formatSignedScore(data.summary.average_score) : "Pending"],
    ["Excellent", data.summary ? String(data.summary.excellent_count) : "Pending"],
  ];

  return (
    <WorkspaceFrame title={data.sourceVideo.file_name}>
      <section className="telemetry-strip rounded-[2rem] p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
          <div>
            <div className="metric-label text-[var(--accent)]">Workspace overview</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Inspect the source once, promote the best clips, export only signal.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {telemetryItems.map(([label, value]) => (
              <div key={label} className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">{label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.32fr)_22rem]">
        <section className="workspace-shell section-frame overflow-hidden rounded-[2.4rem]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div className="space-y-2">
              <div className="metric-label text-[var(--accent)]">Source analysis</div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <span>{formatBytes(data.sourceVideo.size_bytes)}</span>
                <span>{formatSeconds(data.sourceVideo.duration_seconds ?? 0)}</span>
                <span>{data.language ? data.language.toUpperCase() : "Language pending"}</span>
              </div>
            </div>
            <div
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                data.status === "ready"
                  ? "bg-[var(--accent)] text-[#051118]"
                  : data.status === "failed"
                    ? "bg-[var(--danger-soft)] text-red-300"
                    : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted-strong)]"
              }`}
            >
              {phaseCopy[data.progressPhase]}
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-5">
              <div className="workspace-gridline overflow-hidden rounded-[2rem] border border-[var(--line)] bg-black">
                <video ref={videoRef} controls className="aspect-video w-full" src={videoUrl} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface-elevated)] px-5 py-5 soft-shadow">
                  <div className="metric-label text-[var(--muted)]">Selected clip</div>
                  {selectedClip ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className={qualityBadgeClass(selectedClip.quality_label)}>{selectedClip.quality_label}</span>
                        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
                          {formatSignedScore(selectedClip.score)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSeek(selectedClip.start, selectedClip.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium"
                        >
                          <Play className="size-4" />
                          Jump to clip
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          `${formatSeconds(selectedClip.start)} - ${formatSeconds(selectedClip.end)}`,
                          `${selectedClip.duration.toFixed(1)}s`,
                          `${selectedClip.speech_rate.toFixed(1)} words/s`,
                          `${Math.round(selectedClip.confidence * 100)}% confidence`,
                        ].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em]">{selectedClip.text}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{selectedClip.explanation}</p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      The first ranked clip will appear here once processing completes.
                    </p>
                  )}
                </div>

                <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5">
                  <div className="metric-label text-[var(--muted)]">Transcript preview</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {data.summary?.transcript_preview || "Transcript preview will appear once the transcription phase completes."}
                  </p>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <SelectedClipInspector clip={selectedClip} />
              <QuickStatsPanel data={data} />
            </aside>
          </div>
        </section>

        <aside className="space-y-4">
          <StatusPanel data={data} onRefresh={() => void mutate()} />
          <JobSummaryPanel data={data} />
        </aside>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <LayoutGroup id="workspace-tabs">
          <div className="relative flex flex-wrap gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] p-1">
            {tabLabels.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? "text-[var(--text)]" : "text-[var(--muted)]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="active-workspace-tab"
                      className="absolute inset-0 rounded-full bg-[var(--accent)]"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void mutate()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            <RefreshCcw className="size-4" />
            Refresh
          </button>
          <a
            href={exportUrl}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              processing
                ? "cursor-not-allowed border border-[var(--line)] text-[var(--muted)]"
                : "bg-[var(--accent)] text-[#051118]"
            }`}
            aria-disabled={processing}
            onClick={(event) => {
              if (processing) {
                event.preventDefault();
              }
            }}
          >
            <Download className="size-4" />
            Export JSON
          </a>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          {activeTab === "clips" ? (
            <BestClipsPanel clips={data.clips} activeClipId={resolvedClipId} onSelect={handleSeek} />
          ) : null}
          {activeTab === "timeline" ? (
            <TimelinePanel
              bins={data.timeline}
              clips={data.clips}
              activeClipId={resolvedClipId}
              strongestRegions={strongestRegions}
              onSeek={handleSeek}
            />
          ) : null}
          {activeTab === "export" ? (
            <ExportPanel data={data} exportUrl={exportUrl} disabled={processing} />
          ) : null}
        </motion.section>
      </AnimatePresence>
    </WorkspaceFrame>
  );
}

function WorkspaceFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[96rem] flex-col gap-8 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface-strong)]/88 px-5 py-5 backdrop-blur-xl sm:px-6">
        <div>
          <p className="metric-label text-[var(--accent)]">ClipMine AI Workspace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            One source video, one ranking surface, one export path.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[var(--muted)]">
            Frontier curation surface
          </div>
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Upload another video
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}

function LoadingState({ copy }: { copy: string }) {
  return (
    <div className="section-frame rounded-[2.25rem] p-6 sm:p-8">
      <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" />
        {copy}
      </div>
    </div>
  );
}

function StatusPanel({ data, onRefresh }: { data: JobResponse; onRefresh: () => void }) {
  const activeIndex = data.progressPhase === "failed" ? phaseSteps.length - 1 : phaseSteps.findIndex((step) => step.id === data.progressPhase);
  const processing = data.status === "queued" || data.status === "processing";

  return (
    <div className="section-frame rounded-[2.25rem] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="metric-label text-[var(--accent)]">Pipeline status</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{phaseCopy[data.progressPhase]}</div>
        </div>
        <div
          className={`rounded-full px-3 py-2 text-xs font-medium ${
            data.status === "ready"
              ? "bg-[var(--accent)] text-[#051118]"
              : data.status === "failed"
                ? "bg-[var(--danger-soft)] text-red-300"
                : "border border-[var(--line)] bg-[var(--surface-strong)]"
          }`}
        >
          {data.status}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {phaseSteps.map((step, index) => {
          const complete = activeIndex > index || (data.status === "ready" && index === phaseSteps.length - 1);
          const current = data.progressPhase === step.id;
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  complete || current
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#051118]"
                    : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {index + 1}
              </div>
              <div className={`text-sm ${current ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"}`}>{step.label}</div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
        {processing
          ? "This workspace refreshes automatically while extraction, transcription, segmentation, and scoring complete."
          : data.error ?? "Processing completed and export is available."}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
          <Clock3 className="size-4" />
          Updated {formatDateTime(data.updatedAt)}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <RefreshCcw className="size-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}

function JobSummaryPanel({ data }: { data: JobResponse }) {
  const summary = data.summary;
  const items = [
    ["Clips", summary ? String(summary.clip_count) : "0"],
    ["Top", summary ? formatSignedScore(summary.top_score) : "0/100"],
    ["Avg", summary ? formatSignedScore(summary.average_score) : "0/100"],
    ["Excellent", summary ? String(summary.excellent_count) : "0"],
  ];

  return (
    <div className="section-frame rounded-[2.25rem] p-6">
      <div className="metric-label text-[var(--accent)]">Job summary</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
            <div className="metric-label text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <div className="flex items-center justify-between gap-3">
          <span>Language</span>
          <span className="font-medium text-[var(--text)]">{data.language ? data.language.toUpperCase() : "Pending"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Video size</span>
          <span className="font-medium text-[var(--text)]">{formatBytes(data.sourceVideo.size_bytes)}</span>
        </div>
      </div>
    </div>
  );
}

function SelectedClipInspector({ clip }: { clip: ClipRecord | null }) {
  return (
    <div className="section-frame rounded-[2.25rem] p-6">
      <div className="metric-label text-[var(--accent)]">Clip inspector</div>
      {clip ? (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className={qualityBadgeClass(clip.quality_label)}>{clip.quality_label}</span>
            <div className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
              {formatSignedScore(clip.score)}
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <MetricBlock icon={Gauge} label="Confidence" value={formatPercent(clip.confidence)} />
            <MetricBlock icon={Waves} label="Signal" value={formatPercent(clip.energy)} />
            <MetricBlock icon={Video} label="Speech rate" value={`${clip.speech_rate.toFixed(1)} w/s`} />
            <MetricBlock icon={CircleDashed} label="Silence ratio" value={formatPercent(clip.silence_ratio)} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          The ranked clip inspector will fill once the backend produces clip output.
        </p>
      )}
    </div>
  );
}

function QuickStatsPanel({ data }: { data: JobResponse }) {
  return (
    <div className="section-frame rounded-[2.25rem] p-6">
      <div className="metric-label text-[var(--accent)]">Workspace notes</div>
      <div className="mt-4 space-y-3">
        {[
          "One shared source player for every clip",
          "Clickable timeline bins across the source video",
          "Structured export for downstream workflows",
        ].map((item) => (
          <div key={item} className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted-strong)]">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(123,255,217,0.08),rgba(255,255,255,0.01))] px-4 py-4">
        <div className="metric-label text-[var(--muted)]">Job id</div>
        <div className="mt-2 break-all text-sm text-[var(--muted-strong)]">{data.jobId}</div>
      </div>
    </div>
  );
}

function BestClipsPanel({
  clips,
  activeClipId,
  onSelect,
}: {
  clips: ClipRecord[];
  activeClipId: string | null;
  onSelect: (start: number, clipId?: string | null) => void;
}) {
  if (clips.length === 0) {
    return (
      <div className="section-frame rounded-[2.25rem] p-6 sm:p-8">
        <p className="text-lg font-medium">No ranked clips yet.</p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          If processing is still running, this table will fill automatically. If the job is already ready with no
          output, the source did not produce a stable 1 to 3 second speech window.
        </p>
      </div>
    );
  }

  return (
    <div className="section-frame overflow-hidden rounded-[2.25rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
        <div>
          <div className="metric-label text-[var(--accent)]">Best clips</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Ranked for real training usefulness</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Click any row to seek the source video and keep one active inspection target.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">{clips.length} clips available</div>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {clips.map((clip, index) => {
          const active = clip.id === activeClipId;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelect(clip.start, clip.id)}
              className={`clip-row w-full px-5 py-5 text-left transition sm:px-6 ${
                active ? "bg-[var(--accent-soft)]" : "hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-start">
                <div className="flex items-center gap-3 xl:flex-col xl:items-start">
                  <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--muted-strong)]">{String(index + 1).padStart(2, "0")}</div>
                  <div className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-[#051118]">
                    {formatSignedScore(clip.score)}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={qualityBadgeClass(clip.quality_label)}>{clip.quality_label}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
                    </span>
                  </div>
                  <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight tracking-[-0.04em]">{clip.text}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{clip.explanation}</p>
                </div>

                <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3 xl:min-w-[17rem] xl:grid-cols-1">
                  <MetricSummary label="Confidence" value={formatPercent(clip.confidence)} />
                  <MetricSummary label="Speech rate" value={`${clip.speech_rate.toFixed(1)} w/s`} />
                  <MetricSummary label="Signal" value={formatPercent(clip.energy)} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelinePanel({
  bins,
  clips,
  activeClipId,
  strongestRegions,
  onSeek,
}: {
  bins: TimelineBin[];
  clips: ClipRecord[];
  activeClipId: string | null;
  strongestRegions: TimelineBin[];
  onSeek: (start: number, clipId?: string | null) => void;
}) {
  const activeBinId = clips.find((clip) => clip.id === activeClipId)?.id ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="section-frame rounded-[2.25rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="metric-label text-[var(--accent)]">Timeline signal</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Read the strongest regions at a glance</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Each column represents one slice of the source. Taller, brighter columns point to regions with stronger
              ranked speech.
            </p>
          </div>
          <div className="text-sm text-[var(--muted)]">48 bins across the source video</div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[56rem]">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>0:00</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>End</span>
            </div>
            <div className="mt-4 flex items-end gap-2">
              {bins.map((bin, index) => {
                const topClip = clips.find((clip) => clip.id === bin.top_clip_id) ?? null;
                const active = topClip?.id === activeBinId;
                const height = `${Math.max(26, bin.score)}%`;
                return (
                  <button
                    key={`${bin.start}-${bin.end}-${index}`}
                    type="button"
                    onClick={() => onSeek(topClip?.start ?? bin.start, topClip?.id ?? null)}
                    className={`timeline-column flex-1 rounded-t-[1rem] rounded-b-[0.7rem] transition ${
                      active ? "border-[var(--text)]" : ""
                    }`}
                    style={{ ["--timeline-height" as string]: height }}
                    aria-label={`Timeline segment ${index + 1}, score ${bin.score}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-[var(--muted)]">
          <span>Weak</span>
          <div className="h-2 w-44 rounded-full bg-gradient-to-r from-white/8 via-[var(--accent-strong)] to-[var(--accent)]" />
          <span>Excellent</span>
        </div>
      </div>

      <div className="section-frame rounded-[2.25rem] p-6">
        <div className="metric-label text-[var(--accent)]">Strongest windows</div>
        <div className="mt-4 space-y-3">
          {strongestRegions.length > 0 ? (
            strongestRegions.map((bin) => {
              const clip = clips.find((item) => item.id === bin.top_clip_id) ?? null;
              return (
                <button
                  key={`${bin.start}-${bin.end}`}
                  type="button"
                  onClick={() => onSeek(clip?.start ?? bin.start, clip?.id ?? null)}
                  className="w-full rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-left transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={qualityBadgeClass(bin.quality_label)}>{bin.quality_label}</span>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
                      {formatSignedScore(bin.score)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-medium text-[var(--text)]">
                    {formatSeconds(bin.start)} - {formatSeconds(bin.end)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {clip?.text || "Jump to this region in the source video."}
                  </p>
                </button>
              );
            })
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Strong timeline regions will appear when clip scoring completes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportPanel({
  data,
  exportUrl,
  disabled,
}: {
  data: JobResponse;
  exportUrl: string;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="section-frame rounded-[2.25rem] p-6">
        <div className="metric-label text-[var(--accent)]">Export</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Structured JSON for downstream tooling</h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Export contains source metadata, ranked clips, timeline bins, transcript context, and summary counts. It is
          shaped for annotation and dataset workflows instead of generic reporting.
        </p>
        <div className="mt-4 rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          The export stays intentionally simple: one source video, one ranked clip list, one timeline summary.
        </div>

        <div className="mt-6 space-y-3">
          {[
            "Source metadata and playback path",
            "Per-clip confidence, pace, energy, and explanation text",
            "Timeline bins for strong and weak regions",
          ].map((item) => (
            <div key={item} className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted-strong)]">
              {item}
            </div>
          ))}
        </div>

        <a
          href={exportUrl}
          className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            disabled ? "cursor-not-allowed border border-[var(--line)] text-[var(--muted)]" : "bg-[var(--accent)] text-[#051118]"
          }`}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
            }
          }}
        >
          <Download className="size-4" />
          Download export.json
        </a>
      </div>

      <div className="section-frame rounded-[2.25rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="metric-label text-[var(--accent)]">Schema preview</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">What leaves the system</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]">
            <FileJson2 className="size-4" />
            JSON
          </div>
        </div>

        <pre className="mt-5 overflow-auto rounded-[1.8rem] border border-[var(--line)] bg-black/95 p-5 text-xs leading-6 text-white/72">
{JSON.stringify(
  {
    jobId: data.jobId,
    status: data.status,
    sourceVideo: {
      file_name: data.sourceVideo.file_name,
      duration_seconds: data.sourceVideo.duration_seconds,
      size_bytes: data.sourceVideo.size_bytes,
    },
    summary: data.summary,
    clips: data.clips.slice(0, 2),
    timeline: data.timeline.slice(0, 4),
  },
  null,
  2
)}
        </pre>
      </div>
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="inline-flex items-center gap-3">
        <div className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.04)]">
          <Icon className="size-4" />
        </div>
        <span className="text-sm text-[var(--muted)]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}

function qualityBadgeClass(label: ClipRecord["quality_label"] | TimelineBin["quality_label"]) {
  if (label === "Excellent") {
    return "rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-[#051118]";
  }
  if (label === "Good") {
    return "rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-sm font-medium text-[var(--muted-strong)]";
  }
  return "rounded-full bg-[var(--danger-soft)] px-3 py-1 text-sm font-medium text-red-300";
}
