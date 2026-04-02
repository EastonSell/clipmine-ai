import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { formatPercent, formatSeconds, formatSignedScore } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type ClipDetailPanelProps = {
  clip: ClipRecord | null;
  onSeek: (start: number, clipId?: string | null) => void;
};

export function ClipDetailPanel({ clip, onSeek }: ClipDetailPanelProps) {
  if (!clip) {
    return (
      <EmptyState
        eyebrow="Selected clip"
        title="Waiting for ranked clips"
        description="Clip details will appear here when processing produces usable speech segments."
      />
    );
  }

  const metrics = [
    `${formatSeconds(clip.start)} - ${formatSeconds(clip.end)}`,
    `${clip.duration.toFixed(1)}s`,
    `${clip.speech_rate.toFixed(1)} words/s`,
    formatPercent(clip.confidence),
  ];

  return (
    <Card tone="elevated">
      <SectionHeader
        eyebrow="Selected clip"
        title={clip.text}
        description={clip.explanation}
        action={
          <Button variant="secondary" onClick={() => onSeek(clip.start, clip.id)}>
            <Play className="size-4" />
            Play clip
          </Button>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <QualityBadge label={clip.quality_label} />
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
          Clip score {formatSignedScore(clip.score)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <span
            key={metric}
            className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 text-xs font-medium text-[var(--muted-strong)]"
          >
            {metric}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCell label="Confidence" value={formatPercent(clip.confidence)} />
        <MetricCell label="Signal" value={formatPercent(clip.energy)} />
        <MetricCell label="Silence" value={formatPercent(clip.silence_ratio)} />
      </div>
    </Card>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}
