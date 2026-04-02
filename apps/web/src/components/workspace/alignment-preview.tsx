import { Badge } from "@/components/ui/badge";
import { formatPercent, formatPreciseSeconds } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

type AlignmentPreviewProps = {
  clip: ClipRecord;
};

export function AlignmentPreview({ clip }: AlignmentPreviewProps) {
  const alignments = clip.word_alignments.slice(0, 10);
  const remainingCount = Math.max(0, clip.word_alignments.length - alignments.length);

  return (
    <section className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="metric-label text-[var(--muted)]">Alignment preview</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Word-level timestamps stay aligned to the source clip for annotation and review.
          </p>
        </div>
        <Badge tone="neutral">{clip.word_alignments.length} words</Badge>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {alignments.map((alignment) => (
          <div
            key={`${alignment.token}-${alignment.start}-${alignment.end}`}
            className="min-w-[7rem] rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-3 py-3"
          >
            <div className="text-sm font-medium text-[var(--text)]">{alignment.token}</div>
            <div className="mt-2 font-mono text-[11px] text-[var(--muted)]">
              {formatPreciseSeconds(alignment.start)} - {formatPreciseSeconds(alignment.end)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
              {formatPercent(alignment.confidence)}
            </div>
          </div>
        ))}

        {remainingCount > 0 ? (
          <div className="flex min-w-[7rem] items-center justify-center rounded-[1rem] border border-dashed border-[var(--line)] bg-white/[0.02] px-3 py-3 text-sm text-[var(--muted)]">
            +{remainingCount} more
          </div>
        ) : null}
      </div>
    </section>
  );
}
