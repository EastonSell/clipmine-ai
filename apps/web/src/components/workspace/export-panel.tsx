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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <SectionHeader
          eyebrow="Export"
          title="Structured JSON for downstream tooling"
          description="Use the export payload for annotation, dataset curation, or any workflow that needs clip-level metadata."
        />

        <div className="mt-6 space-y-3">
          {[
            "Source metadata and playback path",
            "Per-clip confidence, pace, energy, silence, and explanation text",
            "Timeline bins for stronger and weaker regions",
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
          description="The app keeps the export intentionally simple: one source video, one ranked clip list, and one timeline summary."
        />

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
