import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { formatBytes, formatDateTime, formatSeconds, formatSignedScore } from "@/lib/format";
import type { JobResponse } from "@/lib/types";

type JobSummaryPanelProps = {
  job: JobResponse;
};

export function JobSummaryPanel({ job }: JobSummaryPanelProps) {
  const summary = job.summary;
  const summaryItems = [
    { label: "Clips", value: summary ? String(summary.clip_count) : "Pending" },
    { label: "Top score", value: summary ? formatSignedScore(summary.top_score) : "Pending" },
    { label: "Average", value: summary ? formatSignedScore(summary.average_score) : "Pending" },
    { label: "Excellent", value: summary ? String(summary.excellent_count) : "Pending" },
  ];

  return (
    <Card tone="subtle">
      <SectionHeader
        eyebrow="Job summary"
        title="Key output"
        description="Keep an eye on the clip count, overall quality, and source metadata while the job runs."
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-[1.15rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4"
          >
            <div className="metric-label text-[var(--muted)]">{item.label}</div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text)]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[1.15rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4">
        <div className="metric-label text-[var(--muted)]">Transcript preview</div>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {summary?.transcript_preview || "Transcript preview will appear after transcription completes."}
        </p>
      </div>

      <div className="mt-6 space-y-3 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
        <SummaryRow label="Transcript words" value={String(job.processingStats.transcript_word_count || 0)} />
        <SummaryRow label="Candidates" value={String(job.processingStats.candidate_clip_count || 0)} />
        <SummaryRow label="Language" value={job.language ? job.language.toUpperCase() : "Pending"} />
        <SummaryRow label="Duration" value={formatSeconds(job.sourceVideo.duration_seconds ?? 0)} />
        <SummaryRow label="Video size" value={formatBytes(job.sourceVideo.size_bytes)} />
        <SummaryRow label="Created" value={formatDateTime(job.createdAt)} />
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}
