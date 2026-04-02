import { CircleDot, FileJson2, Waves } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const previewClips = [
  {
    id: "preview-clip-01",
    quality: "Excellent",
    score: "91/100",
    text: "Shortlist-ready with clean boundary and stable delivery",
  },
  {
    id: "preview-clip-02",
    quality: "Good",
    score: "78/100",
    text: "Review candidate with softer signal but usable pacing",
  },
  {
    id: "preview-clip-03",
    quality: "Weak",
    score: "52/100",
    text: "Discard candidate because the pause structure is messy",
  },
];

const heatmapHeights = [18, 24, 30, 44, 58, 65, 55, 35, 24, 42, 62, 88, 94, 76, 48, 29];

export function PreviewPanel() {
  return (
    <Card tone="elevated" padded={false} className="app-grid overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
        <div>
          <p className="metric-label text-[var(--accent)]">Workspace preview</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Research workspace</h2>
        </div>
        <Badge tone="accent" className="gap-2">
          <CircleDot className="size-3.5" />
          Ready job
        </Badge>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="metric-label text-[var(--muted)]">Current pass</div>
            <span className="rounded-[0.8rem] border border-[var(--line)] px-2.5 py-1 font-mono text-xs text-[var(--muted-strong)]">
              package-ready
            </span>
          </div>
          <div className="mt-5 rounded-[1.15rem] border border-[var(--line)] bg-white/[0.03] p-4">
            <div className="metric-label text-[var(--muted)]">Selected package</div>
            <div className="mt-3 text-6xl font-semibold tracking-[-0.08em]">08</div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Clip files and manifest stay linked by clip ID and export order.
            </p>
          </div>
          <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
              <span>Package type</span>
              <span className="font-medium text-[var(--text)]">ZIP + manifest</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
              <span>Clip naming</span>
              <span className="inline-flex items-center gap-2 font-medium text-[var(--text)]">
                <FileJson2 className="size-4" />
                clip_001__id.mp4
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
              <span>Timeline bins</span>
              <span className="font-medium text-[var(--text)]">48 labeled</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <div className="metric-label text-[var(--muted)]">Ranked clips</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Review shortlist, score, and explanation in one place.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[var(--accent)]" />
              <span className="text-xs text-[var(--muted)]">Live preview</span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {previewClips.map((clip, index) => (
              <div
                key={`preview-${index}-${clip.quality}-${clip.score}`}
                className="rounded-[1.15rem] border border-[var(--line)] bg-white/[0.035] px-4 py-4 backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[var(--muted)]">{`0${index + 1}`}</span>
                    <Badge tone={clip.quality === "Excellent" ? "accent" : clip.quality === "Good" ? "neutral" : "danger"}>
                      {clip.quality}
                    </Badge>
                  </div>
                  <span className="font-mono text-sm text-[var(--muted-strong)]">{clip.score}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{clip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted-strong)]">
          <Waves className="size-4 text-[var(--accent)]" />
          Timeline preview
        </div>
        <div className="mt-4 flex items-end gap-2 rounded-[1.3rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-3">
          {heatmapHeights.map((height, index) => (
            <div key={`heatmap-${index}`} className="flex h-24 flex-1 items-end rounded-full bg-white/[0.04] p-0.5">
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
