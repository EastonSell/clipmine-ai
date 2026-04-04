import { Play } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent, formatSeconds, formatSignedScore, formatTokenLabel } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type ClipListPanelProps = {
  shortlistedClips: ClipRecord[];
  clips: ClipRecord[];
  activeClipId: string | null;
  comparedClipIds: string[];
  selectedClipIds: string[];
  totalClipCount: number;
  hasActiveFilters: boolean;
  pinnedOnly: boolean;
  onSelect: (start: number, end?: number | null, clipId?: string | null) => void;
  onToggleCompared: (clipId: string) => void;
  onClearCompared: () => void;
  onToggleSelected: (clipId: string) => void;
};

export function ClipListPanel({
  shortlistedClips,
  clips,
  activeClipId,
  comparedClipIds,
  selectedClipIds,
  totalClipCount,
  hasActiveFilters,
  pinnedOnly,
  onSelect,
  onToggleCompared,
  onClearCompared,
  onToggleSelected,
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
                  {getShortlistComparisonCopy(comparedClipIds.length)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{shortlistedClips.length} pinned</Badge>
                {comparedClipIds.length > 0 ? <Badge tone="neutral">Compare {comparedClipIds.length}/2</Badge> : null}
                {comparedClipIds.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={onClearCompared}>
                    Reset compare
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-[1.15rem] border border-[var(--line)]">
              {shortlistedClips.map((clip, index) =>
                renderClipRow(clip, index, {
                  activeClipId,
                  compared: comparedClipIds.includes(clip.id),
                  selectedClipIds,
                  onSelect,
                  onToggleCompared,
                  onToggleSelected,
                })
              )}
            </div>
          </div>
        ) : null}

        {clips.length > 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {clips.map((clip, index) =>
              renderClipRow(clip, index, {
                activeClipId,
                compared: false,
                selectedClipIds,
                onSelect,
                onToggleCompared: null,
                onToggleSelected,
              })
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function renderClipRow(
  clip: ClipRecord,
  index: number,
  {
    activeClipId,
    compared,
    selectedClipIds,
    onSelect,
    onToggleCompared,
    onToggleSelected,
  }: {
    activeClipId: string | null;
    compared: boolean;
    selectedClipIds: string[];
    onSelect: (start: number, end?: number | null, clipId?: string | null) => void;
    onToggleCompared: ((clipId: string) => void) | null;
    onToggleSelected: (clipId: string) => void;
  }
) {
  const active = clip.id === activeClipId;
  const selected = selectedClipIds.includes(clip.id);

  return (
    <div
      key={clip.id}
      className={[
        "grid gap-4 px-5 py-5 [content-visibility:auto] sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)]",
        active && selected
          ? "bg-[linear-gradient(180deg,rgba(99,216,247,0.16),rgba(99,216,247,0.06))]"
          : active
            ? "bg-[var(--accent-soft)]"
            : selected
              ? "bg-white/[0.055]"
              : "hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <label className="mt-1 inline-flex shrink-0 items-center gap-3 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(clip.id)}
            className="size-4 rounded border-[var(--line-strong)] bg-transparent accent-[var(--accent)]"
            style={{ accentColor: "var(--accent)" }}
            aria-label={`${selected ? "Remove" : "Add"} ${clip.text} ${selected ? "from" : "to"} export package`}
          />
        </label>
        <div className="flex items-center gap-3 lg:flex-col lg:items-start">
          <div className="font-mono text-2xl font-medium text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</div>
          <div className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-sm font-medium text-[var(--text)]">
            {formatSignedScore(clip.score)}
          </div>
          {onToggleCompared ? (
            <Button
              variant={compared ? "primary" : "ghost"}
              size="sm"
              onClick={() => onToggleCompared(clip.id)}
              aria-pressed={compared}
              aria-label={`${compared ? "Remove" : "Compare"} ${clip.text}`}
            >
              {compared ? "Comparing" : "Compare"}
            </Button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(clip.start, clip.end, clip.id)}
        className="grid w-full gap-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-start"
        aria-pressed={active}
      >
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <QualityBadge label={clip.quality_label} />
            <RecommendationBadge recommendation={clip.selection_recommendation} />
            {selected ? <Badge tone="accent">Selected</Badge> : null}
            <span className="text-sm text-[var(--muted)]">
              {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
            </span>
          </div>

          <p className="mt-4 max-w-4xl text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text)] sm:text-xl">
            {clip.text}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{clip.explanation}</p>
          {clip.tags.length > 0 || clip.quality_penalties.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {clip.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} tone={tag === "training-ready" || tag === "av-ready" ? "accent" : "muted"}>
                  {formatTokenLabel(tag)}
                </Badge>
              ))}
              {clip.quality_penalties.slice(0, 2).map((penalty) => (
                <Badge key={penalty} tone="danger">
                  {formatTokenLabel(penalty)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3 xl:grid-cols-1">
          <MetricSummary label="Confidence" value={formatPercent(clip.confidence)} />
          <MetricSummary label="Speech rate" value={`${clip.speech_rate.toFixed(1)} w/s`} />
          <MetricSummary label="Boundary" value={formatPercent(clip.quality_breakdown.boundary_cleanliness)} />
        </div>

        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-strong)]">
          <Play className="size-4" />
          Jump to clip
        </div>
      </button>
    </div>
  );
}

function getShortlistComparisonCopy(comparedCount: number) {
  if (comparedCount >= 2) {
    return "Comparison mode is open below. Pick another pinned clip to swap the older compare pick.";
  }

  if (comparedCount === 1) {
    return "Pick one more pinned clip to open the side-by-side comparison view without leaving review.";
  }

  return "Keep a smaller set of strong clips above the full ranking while you review, then pick any two pinned clips to compare them side by side.";
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

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}
