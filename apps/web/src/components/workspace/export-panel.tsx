import { FileJson2 } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import type { JobResponse } from "@/lib/types";

type ExportPanelProps = {
  job: JobResponse;
  exportUrl: string;
  disabled: boolean;
};

export function ExportPanel({ job, exportUrl, disabled }: ExportPanelProps) {
  const recommendationCounts = job.clips.reduce(
    (totals, clip) => {
      totals[clip.selection_recommendation] += 1;
      return totals;
    },
    { shortlist: 0, review: 0, discard: 0 }
  );

  if (!job.summary && disabled) {
    return (
      <EmptyState
        eyebrow="Export"
        title="Export becomes available when processing is complete"
        description="The JSON payload includes source metadata, summary metrics, ranked clips, and timeline bins."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <SectionHeader
          eyebrow="Export"
          title="Structured JSON for downstream tooling"
          description="Use the export payload for annotation, dataset curation, or any workflow that needs clip-level metadata."
        />

        <div className="mt-6 space-y-3">
          {[
            "Source metadata and playback path",
            "Per-clip audio, linguistic, visual, and precision breakdown signals",
            "Word-level alignment timestamps, candidate metrics, tags, and recommended use",
            "Penalty flags, selection recommendations, and optional embedding vector",
            "Timeline bins for stronger and weaker regions after dedupe",
          ].map((item) => (
            <div
              key={item}
              className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4 text-sm leading-6 text-[var(--muted)]"
            >
              {item}
            </div>
          ))}
        </div>

        <a
          href={exportUrl}
          className={buttonClassName({
            variant: disabled ? "secondary" : "primary",
            size: "lg",
            className: disabled ? "mt-6 pointer-events-none opacity-60" : "mt-6",
          })}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
            }
          }}
        >
          <FileJson2 className="size-4" />
          {disabled ? "Export when ready" : "Download export.json"}
        </a>
      </Card>

      <Card tone="subtle">
        <SectionHeader
          eyebrow="Schema preview"
          title="Payload shape"
          description="The export stays readable while extending each clip with multimodal analysis and precision-first selection metadata."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <PreviewMetric label="Shortlist-ready" value={String(recommendationCounts.shortlist)} />
          <PreviewMetric label="Review" value={String(recommendationCounts.review)} />
          <PreviewMetric label="Discard" value={String(recommendationCounts.discard)} />
          <PreviewMetric
            label="Deduped / discarded"
            value={`${job.processingStats.deduped_candidate_count} / ${job.processingStats.discarded_candidate_count}`}
          />
        </div>

        <pre className="mt-6 overflow-auto rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-dark)] p-5 text-xs leading-6 text-white/75 shadow-[var(--shadow-soft)]">
{JSON.stringify(
  {
    jobId: job.jobId,
    status: job.status,
    sourceVideo: {
      file_name: job.sourceVideo.file_name,
      duration_seconds: job.sourceVideo.duration_seconds,
      size_bytes: job.sourceVideo.size_bytes,
    },
    summary: job.summary,
    processingStats: job.processingStats,
    warnings: job.warnings,
    clips: job.clips.slice(0, 2),
    timeline: job.timeline.slice(0, 4),
  },
  null,
  2
)}
        </pre>
      </Card>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}
