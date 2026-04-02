import { CircleDot, FileJson2, Waves } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const previewClips = [
  {
    quality: "Excellent",
    score: "91/100",
    text: "High confidence, strong signal, ideal pace",
  },
  {
    quality: "Good",
    score: "78/100",
    text: "Usable clip with slightly weaker energy",
  },
  {
    quality: "Weak",
    score: "52/100",
    text: "Pause-heavy segment with lower confidence",
  },
];

const heatmapHeights = [18, 24, 30, 44, 58, 65, 55, 35, 24, 42, 62, 88, 94, 76, 48, 29];

export function PreviewPanel() {
  return (
    <Card tone="elevated" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
        <div>
          <p className="metric-label text-[var(--accent)]">Workspace preview</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">From source video to ranked output</h2>
        </div>
        <Badge tone="accent" className="gap-2">
          <CircleDot className="size-3.5" />
          Ready
        </Badge>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-5">
          <div className="metric-label text-[var(--muted)]">Top clip score</div>
          <div className="mt-3 text-6xl font-semibold tracking-[-0.08em]">91</div>
          <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between gap-4">
              <span>Clip length</span>
              <span className="font-medium text-[var(--text)]">1-3s</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Output</span>
              <span className="inline-flex items-center gap-2 font-medium text-[var(--text)]">
                <FileJson2 className="size-4" />
                JSON
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Timeline bins</span>
              <span className="font-medium text-[var(--text)]">48</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {previewClips.map((clip) => (
            <div
              key={clip.score}
              className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.035] px-4 py-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge tone={clip.quality === "Excellent" ? "accent" : clip.quality === "Good" ? "neutral" : "danger"}>
                  {clip.quality}
                </Badge>
                <span className="font-mono text-sm text-[var(--muted-strong)]">{clip.score}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{clip.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted-strong)]">
          <Waves className="size-4 text-[var(--accent)]" />
          Timeline preview
        </div>
        <div className="mt-4 flex items-end gap-2 rounded-[1.3rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-3">
          {heatmapHeights.map((height, index) => (
            <div key={height + index} className="flex h-24 flex-1 items-end rounded-full bg-white/[0.04] p-0.5">
              <div
                className="w-full rounded-full bg-[linear-gradient(180deg,rgba(94,234,212,0.18),rgba(94,234,212,0.95))]"
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
