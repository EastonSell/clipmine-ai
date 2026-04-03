import { Play, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPercent, formatSeconds, formatSignedScore, formatTokenLabel } from "@/lib/format";
import type { ClipRecord } from "@/lib/types";

import { QualityBadge } from "./quality-badge";

type ClipComparisonPanelProps = {
  leftClip: ClipRecord;
  rightClip: ClipRecord;
  onSeek: (start: number, clipId?: string | null) => void;
  onClear: () => void;
};

export function ClipComparisonPanel({
  leftClip,
  rightClip,
  onSeek,
  onClear,
}: ClipComparisonPanelProps) {
  const sharedTags = getSharedValues(leftClip.tags, rightClip.tags);
  const leftOnlyTags = getExclusiveValues(leftClip.tags, rightClip.tags);
  const rightOnlyTags = getExclusiveValues(rightClip.tags, leftClip.tags);
  const sharedUseCases = getSharedValues(leftClip.recommended_use, rightClip.recommended_use);
  const leftOnlyUseCases = getExclusiveValues(leftClip.recommended_use, rightClip.recommended_use);
  const rightOnlyUseCases = getExclusiveValues(rightClip.recommended_use, leftClip.recommended_use);

  return (
    <Card tone="elevated" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-3xl">
          <p className="metric-label text-[var(--accent)]">Shortlist comparison</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[var(--text)] sm:text-3xl">
            Compare two pinned clips without leaving review
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-[0.98rem]">
            Inspect transcript, recommendation, and scoring differences side by side, then jump back into playback when you are ready.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
          Clear comparison
        </Button>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <ClipSummaryCard clip={leftClip} label="Clip A" onSeek={onSeek} />
            <ClipSummaryCard clip={rightClip} label="Clip B" onSeek={onSeek} />
          </div>
        </section>

        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Difference summary</div>
          <div className="mt-4 grid gap-3">
            <SummaryTile
              label="Recommendation shift"
              value={
                leftClip.selection_recommendation === rightClip.selection_recommendation
                  ? `Both ${formatTokenLabel(leftClip.selection_recommendation)}`
                  : `${formatTokenLabel(leftClip.selection_recommendation)} vs ${formatTokenLabel(rightClip.selection_recommendation)}`
              }
            />
            <SummaryTile
              label="Score gap"
              value={formatDifference(rightClip.score - leftClip.score, " pts")}
            />
            <SummaryTile
              label="Confidence gap"
              value={formatDifference((rightClip.confidence - leftClip.confidence) * 100, " pp")}
            />
            <SummaryTile
              label="Speech-rate gap"
              value={formatDifference(rightClip.speech_rate - leftClip.speech_rate, " w/s")}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Transcript and reasoning</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TranscriptCard clip={leftClip} />
            <TranscriptCard clip={rightClip} />
          </div>
        </section>

        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Metric deltas</div>
          <div className="mt-4 space-y-3">
            <MetricComparisonRow
              label="Score"
              leftValue={formatSignedScore(leftClip.score)}
              delta={formatDifference(rightClip.score - leftClip.score, " pts")}
              rightValue={formatSignedScore(rightClip.score)}
            />
            <MetricComparisonRow
              label="Confidence"
              leftValue={formatPercent(leftClip.confidence)}
              delta={formatDifference((rightClip.confidence - leftClip.confidence) * 100, " pp")}
              rightValue={formatPercent(rightClip.confidence)}
            />
            <MetricComparisonRow
              label="Duration"
              leftValue={`${leftClip.duration.toFixed(1)}s`}
              delta={formatDifference(rightClip.duration - leftClip.duration, " s")}
              rightValue={`${rightClip.duration.toFixed(1)}s`}
            />
            <MetricComparisonRow
              label="Speech rate"
              leftValue={`${leftClip.speech_rate.toFixed(1)} w/s`}
              delta={formatDifference(rightClip.speech_rate - leftClip.speech_rate, " w/s")}
              rightValue={`${rightClip.speech_rate.toFixed(1)} w/s`}
            />
            <MetricComparisonRow
              label="Boundary"
              leftValue={formatPercent(leftClip.quality_breakdown.boundary_cleanliness)}
              delta={formatDifference(
                (rightClip.quality_breakdown.boundary_cleanliness - leftClip.quality_breakdown.boundary_cleanliness) * 100,
                " pp"
              )}
              rightValue={formatPercent(rightClip.quality_breakdown.boundary_cleanliness)}
            />
            <MetricComparisonRow
              label="Speech density"
              leftValue={formatPercent(leftClip.candidate_metrics.speech_density)}
              delta={formatDifference(
                (rightClip.candidate_metrics.speech_density - leftClip.candidate_metrics.speech_density) * 100,
                " pp"
              )}
              rightValue={formatPercent(rightClip.candidate_metrics.speech_density)}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] lg:grid-cols-2">
        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Tag differences</div>
          <div className="mt-4 grid gap-4">
            <TokenGroup title="Shared tags" values={sharedTags} tone="accent" emptyLabel="No shared tags" />
            <TokenGroup title="Only in clip A" values={leftOnlyTags} tone="muted" emptyLabel="No unique tags" />
            <TokenGroup title="Only in clip B" values={rightOnlyTags} tone="muted" emptyLabel="No unique tags" />
          </div>
        </section>

        <section className="bg-[var(--surface)] px-5 py-5 sm:px-6">
          <div className="metric-label text-[var(--muted)]">Recommended use differences</div>
          <div className="mt-4 grid gap-4">
            <TokenGroup title="Shared use cases" values={sharedUseCases} tone="neutral" emptyLabel="No shared use cases" />
            <TokenGroup title="Only in clip A" values={leftOnlyUseCases} tone="neutral" emptyLabel="No unique use cases" />
            <TokenGroup title="Only in clip B" values={rightOnlyUseCases} tone="neutral" emptyLabel="No unique use cases" />
          </div>
        </section>
      </div>
    </Card>
  );
}

function ClipSummaryCard({
  clip,
  label,
  onSeek,
}: {
  clip: ClipRecord;
  label: string;
  onSeek: (start: number, clipId?: string | null) => void;
}) {
  return (
    <div className="rounded-[1.3rem] border border-[var(--line)] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="metric-label text-[var(--muted)]">{label}</div>
        <Button variant="secondary" size="sm" onClick={() => onSeek(clip.start, clip.id)}>
          <Play className="size-4" />
          Play clip
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <QualityBadge label={clip.quality_label} />
        <RecommendationBadge recommendation={clip.selection_recommendation} />
        <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-sm font-medium text-[var(--text)]">
          {formatSignedScore(clip.score)}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text)]">
        {clip.text}
      </h3>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {clip.explanation}
        {clip.quality_reasoning.summary ? ` · ${clip.quality_reasoning.summary}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
          {formatSeconds(clip.start)} - {formatSeconds(clip.end)}
        </span>
        <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
          {clip.duration.toFixed(1)}s
        </span>
        <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
          {formatPercent(clip.confidence)} confidence
        </span>
      </div>
    </div>
  );
}

function TranscriptCard({ clip }: { clip: ClipRecord }) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/[0.03] p-4">
      <div className="metric-label text-[var(--muted)]">Transcript</div>
      <p className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text)]">
        {clip.text}
      </p>

      <div className="mt-5 metric-label text-[var(--muted)]">Reasoning</div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{clip.quality_reasoning.summary || clip.explanation}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ReasonList title="Strengths" items={clip.quality_reasoning.strengths} emptyLabel="No highlighted strengths" />
        <ReasonList title="Cautions" items={clip.quality_reasoning.cautions} emptyLabel="No major cautions" />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-sm font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}

function MetricComparisonRow({
  label,
  leftValue,
  delta,
  rightValue,
}: {
  label: string;
  leftValue: string;
  delta: string;
  rightValue: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
      <div>
        <div className="metric-label text-[var(--muted)]">{label}</div>
        <div className="mt-1 text-sm font-medium text-[var(--text)]">{leftValue}</div>
      </div>
      <div className="rounded-full border border-[var(--line)] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
        {delta}
      </div>
      <div className="text-right">
        <div className="metric-label text-[var(--muted)]">Clip B</div>
        <div className="mt-1 text-sm font-medium text-[var(--text)]">{rightValue}</div>
      </div>
    </div>
  );
}

function TokenGroup({
  title,
  values,
  tone,
  emptyLabel,
}: {
  title: string;
  values: string[];
  tone: "accent" | "muted" | "neutral";
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-[var(--muted-strong)]">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <Badge key={value} tone={tone}>
              {formatTokenLabel(value)}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-[var(--muted)]">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
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

function ReasonList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
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
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function getSharedValues(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((value) => rightSet.has(value))));
}

function getExclusiveValues(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((value) => !rightSet.has(value))));
}

function formatDifference(value: number, suffix: string) {
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

  if (Math.abs(rounded) < 0.05) {
    return `No change${suffix === " pts" || suffix === " pp" ? "" : ""}`;
  }

  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}
