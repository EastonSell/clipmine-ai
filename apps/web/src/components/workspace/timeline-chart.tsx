import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord, TimelineBin } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type TimelineChartProps = {
  bins: TimelineBin[];
  clips: ClipRecord[];
  activeClipId: string | null;
  onSeek: (start: number, clipId?: string | null) => void;
};

export function TimelineChart({ bins, clips, activeClipId, onSeek }: TimelineChartProps) {
  if (bins.length === 0) {
    return (
      <EmptyState
        eyebrow="Timeline"
        title="Waiting for timeline data"
        description="The training usefulness timeline appears after clip scoring is complete."
      />
    );
  }

  const clipsById = new Map(clips.map((clip) => [clip.id, clip]));
  const strongestRegions = bins
    .filter((bin) => bin.top_clip_id)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_22rem]">
      <Card>
        <SectionHeader
          eyebrow="Timeline"
          title="Training usefulness across the full video"
          description="Every bar represents one slice of the source. Use it to move directly toward stronger or weaker regions."
        />

        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[44rem] rounded-[1.35rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>0:00</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>End</span>
            </div>

            <div className="mt-5 flex h-56 items-end gap-2">
              {bins.map((bin, index) => {
                const clip = bin.top_clip_id ? clipsById.get(bin.top_clip_id) ?? null : null;
                const active = clip?.id === activeClipId;

                return (
                  <button
                    key={`${bin.start}-${bin.end}-${index}`}
                    type="button"
                    onClick={() => onSeek(clip?.start ?? bin.start, clip?.id ?? null)}
                    className={[
                      "flex flex-1 items-end rounded-[1rem] border bg-white/[0.03] p-1 transition duration-200",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
                    ].join(" ")}
                    aria-label={`Timeline segment ${index + 1}, score ${Math.round(bin.score)}`}
                    aria-pressed={active}
                  >
                    <span
                      className="block w-full rounded-[0.75rem] bg-[linear-gradient(180deg,rgba(94,234,212,0.2),rgba(94,234,212,0.92))]"
                      style={{ height: `${Math.max(12, Math.round(bin.score))}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <span>Weak</span>
          <div className="h-2 w-40 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(94,234,212,0.92))]" />
          <span>Excellent</span>
        </div>
      </Card>

      <Card tone="subtle">
        <SectionHeader
          eyebrow="Strongest windows"
          title="Best regions"
          description="These bins map to the highest-scoring clips in the current job."
        />

        <div className="mt-6 space-y-3">
          {strongestRegions.length > 0 ? (
            strongestRegions.map((bin) => {
              const clip = bin.top_clip_id ? clipsById.get(bin.top_clip_id) ?? null : null;

              return (
                <button
                  key={`${bin.start}-${bin.end}`}
                  type="button"
                  onClick={() => onSeek(clip?.start ?? bin.start, clip?.id ?? null)}
                  className="w-full rounded-[1.25rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <QualityBadge label={bin.quality_label} />
                    <span className="font-mono text-sm text-[var(--muted-strong)]">
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
              Strong timeline regions will appear once the job produces ranked clips.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
