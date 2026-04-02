import { Play } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type ClipListPanelProps = {
  shortlistedClips: ClipRecord[];
  clips: ClipRecord[];
  activeClipId: string | null;
  totalClipCount: number;
  hasActiveFilters: boolean;
  pinnedOnly: boolean;
  onSelect: (start: number, clipId?: string | null) => void;
};

export function ClipListPanel({
  shortlistedClips,
  clips,
  activeClipId,
  totalClipCount,
  hasActiveFilters,
  pinnedOnly,
  onSelect,
}: ClipListPanelProps) {
  if (totalClipCount === 0) {
    return (
      <EmptyState
        eyebrow="Best clips"
        title="Waiting for ranked clips"
        description="When processing finishes, the best 1 to 3 second speech windows will appear here in score order."
      />
    );
  }

  if (shortlistedClips.length === 0 && clips.length === 0) {
    return (
      <EmptyState
        eyebrow="Best clips"
        title={pinnedOnly ? "No shortlisted clips yet" : "No clips match the current filters"}
        description={
          pinnedOnly
            ? "Pin clips from the detail panel to keep a smaller shortlist for review."
            : hasActiveFilters
              ? "Try broadening the search, quality, or tag filters."
              : "The current filters did not leave any visible clips."
        }
      />
    );
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-[var(--line)] p-5 sm:p-6">
        <SectionHeader
          eyebrow="Best clips"
          title="Ranked by training usefulness"
          description="Select any clip to seek the source video and keep one active review target."
          action={
            <div className="text-sm text-[var(--muted)]">
              {shortlistedClips.length + clips.length} visible
            </div>
          }
        />
      </div>

      <div>
        {shortlistedClips.length > 0 ? (
          <div className="border-b border-[var(--line)] bg-white/[0.02] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="metric-label text-[var(--accent)]">Shortlist</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Keep a smaller set of strong clips above the full ranking while you review.
                </p>
              </div>
              <Badge tone="accent">{shortlistedClips.length} pinned</Badge>
            </div>
            <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-[1.15rem] border border-[var(--line)]">
              {shortlistedClips.map((clip, index) => renderClipRow(clip, index, activeClipId, onSelect))}
            </div>
          </div>
        ) : null}

        {clips.length > 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {clips.map((clip, index) => renderClipRow(clip, index, activeClipId, onSelect))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function renderClipRow(
  clip: ClipRecord,
  index: number,
  activeClipId: string | null,
  onSelect: (start: number, clipId?: string | null) => void
) {
  const active = clip.id === activeClipId;

  return (
    <button
      key={clip.id}
      type="button"
      onClick={() => onSelect(clip.start, clip.id)}
      className={[
        "w-full px-5 py-5 text-left transition duration-200 [content-visibility:auto] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset sm:px-6",
        active ? "bg-[var(--accent-soft)]" : "hover:bg-white/[0.04]",
      ].join(" ")}
      aria-pressed={active}
    >
      <div className="grid gap-4 xl:grid-cols-[5.5rem_minmax(0,1fr)_14rem] xl:items-start">
        <div className="flex items-center gap-3 xl:flex-col xl:items-start">
          <div className="font-mono text-2xl font-medium text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</div>
          <div className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-sm font-medium text-[var(--text)]">
            {formatSignedScore(clip.score)}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <QualityBadge label={clip.quality_label} />
            <span className="text-sm text-[var(--muted)]">
              {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
            </span>
          </div>

          <p className="mt-4 max-w-4xl text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text)] sm:text-xl">
            {clip.text}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{clip.explanation}</p>
          {clip.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {clip.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} tone={tag === "training-ready" ? "accent" : "muted"}>
                  {formatTagLabel(tag)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3 xl:grid-cols-1">
          <MetricSummary label="Confidence" value={formatPercent(clip.confidence)} />
          <MetricSummary label="Speech rate" value={`${clip.speech_rate.toFixed(1)} w/s`} />
          <MetricSummary label="Signal" value={formatPercent(clip.quality_breakdown.acoustic_signal)} />
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-strong)]">
        <Play className="size-4" />
        Jump to clip
      </div>
    </button>
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

function formatTagLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
