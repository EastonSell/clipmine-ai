"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, LoaderCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import useSWR from "swr";

import { getApiBaseUrl, getJob } from "@/lib/api";
import { formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord, JobResponse, TimelineBin } from "@/lib/types";

type WorkspaceTab = "clips" | "timeline" | "export";

const statusCopy: Record<JobResponse["progressPhase"], string> = {
  queued: "Queued for processing",
  extracting_audio: "Extracting mono audio",
  transcribing: "Running Whisper transcription",
  segmenting: "Building candidate clips",
  scoring: "Scoring signal quality",
  ready: "Ready",
  failed: "Processing failed",
};

const tabLabels: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "clips", label: "Best Clips" },
  { id: "timeline", label: "Timeline" },
  { id: "export", label: "Export" },
];

export function ResultsWorkspace({ jobId }: { jobId: string }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("clips");
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
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
    data?.clips.find((clip) => clip.id === activeClipId) ??
    data?.clips[0] ??
    null;

  function handleSeek(start: number, clipId?: string | null) {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      void videoRef.current.play().catch(() => undefined);
    }
    if (clipId) {
      setActiveClipId(clipId);
    }
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
        <div className="section-frame rounded-[2rem] p-6">
          <p className="text-lg font-medium">The job workspace could not be loaded.</p>
          <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
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

  return (
    <WorkspaceFrame title={data.sourceVideo.file_name}>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="section-frame rounded-[2rem] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="metric-label text-[var(--muted)]">Source video</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{data.sourceVideo.file_name}</h2>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm">
              {formatSeconds(data.sourceVideo.duration_seconds ?? 0)}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-black">
            <video ref={videoRef} controls className="aspect-video w-full" src={videoUrl} />
          </div>
          {selectedClip ? (
            <div className="mt-4 rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4">
              <div className="metric-label text-[var(--muted)]">Selected clip</div>
              <p className="mt-2 text-lg font-medium leading-relaxed">{selectedClip.text}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                <span>{formatSignedScore(selectedClip.score)}</span>
                <span>
                  {formatSeconds(selectedClip.start)} - {formatSeconds(selectedClip.end)}
                </span>
                <span>{selectedClip.quality_label}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <StatusPanel data={data} onRefresh={() => void mutate()} />
          <SummaryPanel summary={data.summary} />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] p-1">
          {tabLabels.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id ? "bg-[var(--text)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
                : "bg-[var(--accent)] text-[var(--text)]"
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
            <BestClipsPanel clips={data.clips} activeClipId={selectedClip?.id ?? null} onSelect={handleSeek} />
          ) : null}
          {activeTab === "timeline" ? (
            <TimelinePanel
              bins={data.timeline}
              clips={data.clips}
              activeClipId={selectedClip?.id ?? null}
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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="metric-label text-[var(--muted)]">ClipMine AI Workspace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{title}</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Ranked clips, timeline signal, and export controls for one upload job.
          </p>
        </div>
        <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">
          Upload another video
        </Link>
      </header>
      {children}
    </main>
  );
}

function LoadingState({ copy }: { copy: string }) {
  return (
    <div className="section-frame rounded-[2rem] p-6">
      <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" />
        {copy}
      </div>
    </div>
  );
}

function StatusPanel({ data, onRefresh }: { data: JobResponse; onRefresh: () => void }) {
  const processing = data.status === "queued" || data.status === "processing";
  return (
    <div className="section-frame rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="metric-label text-[var(--muted)]">Status</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{statusCopy[data.progressPhase]}</div>
        </div>
        <div
          className={`rounded-full px-3 py-2 text-xs font-medium ${
            data.status === "ready"
              ? "bg-[var(--accent)] text-[var(--text)]"
              : data.status === "failed"
                ? "bg-red-100 text-red-700"
                : "border border-[var(--line)] bg-[var(--surface-strong)]"
          }`}
        >
          {data.status}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        {processing
          ? "The backend polls and updates this workspace automatically while extraction, transcription, segmentation, and scoring complete."
          : data.error ?? "Processing completed and export is available."}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
      >
        <RefreshCcw className="size-4" />
        Refresh now
      </button>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: JobResponse["summary"] }) {
  const items = summary
    ? [
        ["Clips", String(summary.clip_count)],
        ["Top score", formatSignedScore(summary.top_score)],
        ["Average", formatSignedScore(summary.average_score)],
        ["Excellent", String(summary.excellent_count)],
      ]
    : [
        ["Clips", "0"],
        ["Top score", "0/100"],
        ["Average", "0/100"],
        ["Excellent", "0"],
      ];

  return (
    <div className="section-frame rounded-[2rem] p-6">
      <div className="metric-label text-[var(--muted)]">Summary</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4">
            <div className="metric-label text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        {summary?.transcript_preview || "Transcript preview will appear once transcription completes."}
      </p>
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
      <div className="section-frame rounded-[2rem] p-6">
        <p className="text-lg font-medium">No ranked clips yet.</p>
        <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
          If processing is still running, this panel will fill automatically. If the job is ready with no clips, the
          source did not contain a confident 1 to 3 second speech segment.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clips.map((clip) => (
        <button
          key={clip.id}
          type="button"
          onClick={() => onSelect(clip.start, clip.id)}
          className={`section-frame rounded-[2rem] p-5 text-left transition ${
            activeClipId === clip.id ? "border-[var(--text)]" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="metric-label text-[var(--muted)]">{clip.quality_label}</div>
            <div className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-semibold">{formatSignedScore(clip.score)}</div>
          </div>
          <p className="mt-4 text-xl font-medium leading-relaxed tracking-[-0.02em]">{clip.text}</p>
          <p className="mt-3 text-sm text-[var(--muted)]">{clip.explanation}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-[var(--muted)]">
            <div>
              <div className="metric-label">Timestamps</div>
              <div className="mt-1">
                {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
              </div>
            </div>
            <div>
              <div className="metric-label">Confidence</div>
              <div className="mt-1">{formatPercent(clip.confidence)}</div>
            </div>
            <div>
              <div className="metric-label">Speech rate</div>
              <div className="mt-1">{clip.speech_rate.toFixed(1)} words/sec</div>
            </div>
            <div>
              <div className="metric-label">Signal</div>
              <div className="mt-1">{formatPercent(clip.energy)}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function TimelinePanel({
  bins,
  clips,
  activeClipId,
  onSeek,
}: {
  bins: TimelineBin[];
  clips: ClipRecord[];
  activeClipId: string | null;
  onSeek: (start: number, clipId?: string | null) => void;
}) {
  return (
    <div className="section-frame rounded-[2rem] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="metric-label text-[var(--muted)]">Timeline signal</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Clickable training usefulness map</h2>
        </div>
        <div className="text-sm text-[var(--muted)]">48 bins across the source video</div>
      </div>
      <div className="mt-6 grid grid-cols-12 gap-2 sm:grid-cols-16 xl:grid-cols-24">
        {bins.map((bin, index) => {
          const topClip = clips.find((clip) => clip.id === bin.top_clip_id) ?? null;
          const active = topClip?.id === activeClipId;
          return (
            <button
              key={`${bin.start}-${bin.end}-${index}`}
              type="button"
              onClick={() => onSeek(topClip?.start ?? bin.start, topClip?.id ?? null)}
              className={`h-20 rounded-2xl border transition ${
                active ? "border-[var(--text)]" : "border-transparent"
              }`}
              style={{
                background: `linear-gradient(180deg, rgba(203, 255, 73, ${Math.max(bin.score / 100, 0.08)}) 0%, rgba(22, 20, 16, 0.06) 100%)`,
              }}
              aria-label={`Timeline segment ${index + 1}, score ${bin.score}`}
            />
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-[var(--muted)]">
        <span>Weak</span>
        <div className="h-2 w-40 rounded-full bg-gradient-to-r from-black/10 via-[#d7ff77] to-[#cbff49]" />
        <span>Excellent</span>
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
    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
      <div className="section-frame rounded-[2rem] p-6">
        <div className="metric-label text-[var(--muted)]">Export</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Structured JSON for downstream tooling</h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Export includes source metadata, summary stats, ranked clips, timeline bins, and transcript context. The file
          is designed for annotation pipelines and dataset preparation rather than generic reporting.
        </p>
        <a
          href={exportUrl}
          className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            disabled ? "cursor-not-allowed border border-[var(--line)] text-[var(--muted)]" : "bg-[var(--accent)]"
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

      <div className="section-frame rounded-[2rem] p-6">
        <div className="metric-label text-[var(--muted)]">Schema preview</div>
        <pre className="mt-4 overflow-auto rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-xs leading-6 text-[var(--muted)]">
{JSON.stringify(
  {
    jobId: data.jobId,
    status: data.status,
    sourceVideo: {
      file_name: data.sourceVideo.file_name,
      duration_seconds: data.sourceVideo.duration_seconds,
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

