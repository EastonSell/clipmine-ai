import { useState } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord, TimelineBin } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type TimelineChartProps = {
  bins: TimelineBin[];
  clips: ClipRecord[];
  activeClipId: string | null;
  selectedClipIds: string[];
  onSeek: (start: number, clipId?: string | null) => void;
};

export function TimelineChart({ bins, clips, activeClipId, selectedClipIds, onSeek }: TimelineChartProps) {
  const [hoveredBinIndex, setHoveredBinIndex] = useState<number | null>(null);

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
  const activeClip = activeClipId ? clipsById.get(activeClipId) ?? null : null;
  const activeTimelineBin =
    hoveredBinIndex !== null
      ? bins[hoveredBinIndex] ?? null
      : activeClip
        ? bins.find((bin) => activeClip.end > bin.start && activeClip.start < bin.end) ?? null
        : strongestRegions[0] ?? bins[0] ?? null;
  const activeTimelineClip =
    activeTimelineBin?.top_clip_id ? clipsById.get(activeTimelineBin.top_clip_id) ?? null : null;

  const selectedClipSet = new Set(selectedClipIds);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_19rem] xl:grid-cols-[minmax(0,1.3fr)_22rem]">
      <Card>
        <SectionHeader
          eyebrow="Timeline"
          title="Training usefulness across the full video"
          description="Each column represents one slice of the source. Use it to inspect stronger regions, weaker regions, and any selected export targets."
        />

        {activeTimelineBin ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
            <div>
              <div className="metric-label text-[var(--muted)]">Active region</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <QualityBadge label={activeTimelineBin.quality_label} />
                {activeTimelineClip ? (
                  <RecommendationBadge recommendation={activeTimelineClip.selection_recommendation} />
                ) : null}
                <span className="text-sm font-medium text-[var(--text)]">
                  {formatRegionLabel(activeTimelineBin.quality_label, activeTimelineClip?.selection_recommendation)}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  {formatSeconds(activeTimelineBin.start)} - {formatSeconds(activeTimelineBin.end)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-[var(--muted-strong)]">
                {formatSignedScore(activeTimelineBin.score)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {activeTimelineClip?.text || "Jump to this region in the source video."}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[44rem] rounded-[1.35rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>0:00</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>End</span>
            </div>

            <div className="mt-4 grid h-56 grid-rows-4 gap-0 rounded-[1.1rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="border-b border-dashed border-[var(--line)] last:border-b-0" />
              ))}
            </div>

            <div className="pointer-events-none -mt-56 grid h-56 [grid-template-columns:repeat(48,minmax(0,1fr))] items-end gap-1">
              {bins.map((bin, index) => {
                const clip = bin.top_clip_id ? clipsById.get(bin.top_clip_id) ?? null : null;
                const active = activeClip ? activeClip.end > bin.start && activeClip.start < bin.end : clip?.id === activeClipId;
                const selected = clip ? selectedClipSet.has(clip.id) : false;

                return (
                  <button
                    key={`${bin.start}-${bin.end}-${index}`}
                    type="button"
                    onClick={() => onSeek(clip?.start ?? bin.start, clip?.id ?? null)}
                    onMouseEnter={() => setHoveredBinIndex(index)}
                    onFocus={() => setHoveredBinIndex(index)}
                    onMouseLeave={() => setHoveredBinIndex(null)}
                    onBlur={() => setHoveredBinIndex(null)}
                    className={[
                      "pointer-events-auto flex h-full items-end rounded-[0.55rem] border border-transparent bg-transparent pt-3 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : selected
                          ? "border-[var(--accent-strong)] bg-white/[0.03]"
                          : "hover:border-[var(--line-strong)] hover:bg-white/[0.03]",
                    ].join(" ")}
                    aria-label={`Timeline segment ${index + 1}, ${bin.quality_label}, score ${Math.round(bin.score)}`}
                    aria-pressed={active}
                    title={`${bin.quality_label} region · ${formatSignedScore(bin.score)}`}
                  >
                    <span
                      className={[
                        getTimelineBarClassName(bin.quality_label),
                        selected ? "ring-1 ring-inset ring-[var(--accent)]" : "",
                      ].join(" ")}
                      style={{ height: `${Math.max(12, Math.round(bin.score))}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          {[
            {
              label: "Excellent",
              swatch: "linear-gradient(180deg,rgba(94,234,212,0.28),rgba(94,234,212,0.98))",
            },
            {
              label: "Good",
              swatch: "linear-gradient(180deg,rgba(148,163,184,0.2),rgba(148,163,184,0.82))",
            },
            {
              label: "Weak",
              swatch: "linear-gradient(180deg,rgba(71,85,105,0.16),rgba(71,85,105,0.72))",
            },
            {
              label: "Selected",
              swatch: "rgba(99,216,247,0.95)",
            },
          ].map((item) => (
            <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.03] px-3 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.swatch }} />
              <span>{item.label}</span>
            </div>
          ))}
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
                    {clip ? <RecommendationBadge recommendation={clip.selection_recommendation} /> : null}
                    {clip && selectedClipSet.has(clip.id) ? <Badge tone="accent">Selected</Badge> : null}
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

function getTimelineBarClassName(label: TimelineBin["quality_label"]) {
  if (label === "Excellent") {
    return "block w-full rounded-[0.35rem] bg-[linear-gradient(180deg,rgba(94,234,212,0.2),rgba(94,234,212,0.98))]";
  }

  if (label === "Good") {
    return "block w-full rounded-[0.35rem] bg-[linear-gradient(180deg,rgba(148,163,184,0.24),rgba(148,163,184,0.86))]";
  }

  return "block w-full rounded-[0.35rem] bg-[linear-gradient(180deg,rgba(71,85,105,0.2),rgba(71,85,105,0.72))]";
}

function formatRegionLabel(
  label: TimelineBin["quality_label"],
  recommendation?: ClipRecord["selection_recommendation"]
) {
  if (recommendation === "shortlist") {
    return "Shortlist-ready region";
  }

  if (recommendation === "discard") {
    return "Discard-risk region";
  }

  if (label === "Excellent") {
    return "Strong region";
  }

  if (label === "Good") {
    return "Mixed region";
  }

  return "Weak region";
}

function RecommendationBadge({
  recommendation,
}: {
  recommendation: ClipRecord["selection_recommendation"];
}) {
  if (recommendation === "shortlist") {
    return <Badge tone="accent">Shortlist</Badge>;
  }

  if (recommendation === "discard") {
    return <Badge tone="danger">Discard</Badge>;
  }

  return <Badge tone="neutral">Review</Badge>;
}
