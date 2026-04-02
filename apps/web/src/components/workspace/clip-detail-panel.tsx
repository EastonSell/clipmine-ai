import { ChevronLeft, ChevronRight, Pin, PinOff, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

import { AlignmentPreview } from "./alignment-preview";
import { ClipInsightsPanel } from "./clip-insights-panel";
import { QualityBadge } from "./quality-badge";

type ClipDetailPanelProps = {
  clip: ClipRecord | null;
  onSeek: (start: number, clipId?: string | null) => void;
  isPinned: boolean;
  onTogglePinned: (clipId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function ClipDetailPanel({
  clip,
  onSeek,
  isPinned,
  onTogglePinned,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: ClipDetailPanelProps) {
  if (!clip) {
    return (
      <EmptyState
        eyebrow="Selected clip"
        title="Waiting for ranked clips"
        description="Clip details will appear here when processing produces usable speech segments."
      />
    );
  }

  const details = [
    `${formatSeconds(clip.start)} - ${formatSeconds(clip.end)}`,
    `${clip.duration.toFixed(1)}s`,
    `${clip.speech_rate.toFixed(1)} words/s`,
  ];

  return (
    <Card tone="elevated" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
        <div className="max-w-3xl">
          <p className="metric-label text-[var(--accent)]">Selected clip</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QualityBadge label={clip.quality_label} />
            <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-sm font-medium text-[var(--text)]">
              Clip score {formatSignedScore(clip.score)}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.05em] sm:text-3xl">
            {clip.text}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-[0.98rem]">
            {clip.explanation}
            {clip.quality_reasoning.summary ? ` · ${clip.quality_reasoning.summary}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {details.map((detail) => (
              <span
                key={detail}
                className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]"
              >
                {detail}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onPrevious} disabled={!hasPrevious}>
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button variant="ghost" size="sm" onClick={onNext} disabled={!hasNext}>
            Next
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onTogglePinned(clip.id)}>
            {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {isPinned ? "Remove from shortlist" : "Add to shortlist"}
          </Button>
          <Button variant="secondary" onClick={() => onSeek(clip.start, clip.id)}>
            <Play className="size-4" />
            Play clip
          </Button>
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
        <MetricCell label="Score" value={formatSignedScore(clip.score)} />
        <MetricCell label="Confidence" value={formatPercent(clip.confidence)} />
        <MetricCell label="Speech rate" value={`${clip.speech_rate.toFixed(1)} w/s`} />
        <MetricCell label="Audio signal" value={formatPercent(clip.quality_breakdown.acoustic_signal)} />
      </div>

      <ClipInsightsPanel clip={clip} />
      <AlignmentPreview clip={clip} />
    </Card>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}
