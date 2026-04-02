import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatPercent, formatTokenLabel } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

type ClipInsightsPanelProps = {
  clip: ClipRecord;
};

const qualityRows: Array<{
  key: keyof ClipRecord["quality_breakdown"];
  label: string;
}> = [
  { key: "transcription_confidence", label: "Confidence" },
  { key: "pacing", label: "Pace" },
  { key: "acoustic_signal", label: "Audio signal" },
  { key: "continuity", label: "Continuity" },
  { key: "linguistic_clarity", label: "Language" },
  { key: "visual_readiness", label: "Visual" },
  { key: "boundary_cleanliness", label: "Boundary" },
  { key: "speech_density", label: "Speech density" },
  { key: "dedupe_confidence", label: "Deduped" },
];

export function ClipInsightsPanel({ clip }: ClipInsightsPanelProps) {
  return (
    <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="metric-label text-[var(--muted)]">Quality breakdown</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{clip.quality_reasoning.summary}</p>
          </div>
          <div className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 font-mono text-sm text-[var(--muted-strong)]">
            Overall {formatPercent(clip.quality_breakdown.overall)}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {qualityRows.map((row) => {
            const value = clip.quality_breakdown[row.key];

            return (
              <div key={row.key} className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--muted-strong)]">{row.label}</span>
                  <span className="font-mono text-xs text-[var(--muted)]">{formatPercent(value)}</span>
                </div>
                <ProgressBar
                  value={value * 100}
                  className="mt-3 h-2"
                  trackClassName="bg-white/[0.03]"
                  barClassName="bg-[linear-gradient(90deg,rgba(94,234,212,0.5),rgba(94,234,212,1))]"
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-px bg-[var(--line)]">
        <div className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Tags</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {clip.tags.length > 0 ? (
              clip.tags.map((tag) => (
                <Badge key={tag} tone={tag === "training-ready" || tag === "av-ready" ? "accent" : "muted"}>
                  {formatTokenLabel(tag)}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)]">Tags appear after multimodal analysis completes.</span>
            )}
          </div>

          <div className="mt-5 metric-label text-[var(--muted)]">Recommended use</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {clip.recommended_use.map((item) => (
              <Badge key={item} tone="neutral">
                {formatTokenLabel(item)}
              </Badge>
            ))}
          </div>

          <div className="mt-5 metric-label text-[var(--muted)]">Quality penalties</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {clip.quality_penalties.length > 0 ? (
              clip.quality_penalties.map((penalty) => (
                <Badge key={penalty} tone="danger">
                  {formatTokenLabel(penalty)}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)]">No major precision penalties.</span>
            )}
          </div>
        </div>

        <div className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Quality reasoning</div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReasonList title="Strengths" items={clip.quality_reasoning.strengths} />
            <ReasonList title="Cautions" items={clip.quality_reasoning.cautions} emptyLabel="No major cautions" />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReasonList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-[var(--muted-strong)]">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
          {items.map((item) => (
            <li key={item} className="rounded-[0.95rem] border border-[var(--line)] bg-white/[0.03] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{emptyLabel ?? "No items"}</p>
      )}
    </div>
  );
}
