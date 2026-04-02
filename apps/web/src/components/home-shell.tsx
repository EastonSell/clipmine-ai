"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, FileJson2, Sparkles, Waves } from "lucide-react";

import { UploadPanel } from "./upload-panel";

const previewClips = [
  {
    id: "C-14",
    quality: "Excellent",
    score: "91",
    text: "Stable timing, clean signal, and moderate pace make this a strong training segment.",
    meta: "1.8s · 96% confidence · 3.1 words/s",
  },
  {
    id: "C-09",
    quality: "Good",
    score: "78",
    text: "Useful speech survives, but the energy drops enough to push it below the strongest samples.",
    meta: "2.4s · 89% confidence · 2.9 words/s",
  },
  {
    id: "C-04",
    quality: "Weak",
    score: "52",
    text: "Pause-heavy delivery and lower confidence make this window risky for downstream annotation work.",
    meta: "2.9s · 71% confidence · 1.7 words/s",
  },
];

const heatmapHeights = [18, 24, 31, 47, 62, 58, 41, 27, 22, 39, 64, 84, 92, 81, 56, 33];

const productPoints = [
  {
    icon: Waves,
    title: "Rank the strongest speech",
    body: "ClipMine scores short windows by confidence, pace, energy, and continuity instead of dumping raw transcript lines.",
  },
  {
    icon: Sparkles,
    title: "Read the source quickly",
    body: "A usefulness timeline points straight at the regions worth keeping and the ones worth skipping.",
  },
  {
    icon: FileJson2,
    title: "Export for real workflows",
    body: "JSON output is structured for annotation, dataset curation, and downstream multimodal experiments.",
  },
];

const workflowSteps = [
  [
    "Upload one source video",
    "Preserve the original media, create a stable backend job, and move directly into a revisit-able workspace URL.",
  ],
  [
    "Inspect one active source",
    "Use the shared player, ranked clips, and timeline to judge signal quality without bouncing across disconnected views.",
  ],
  [
    "Export only the useful structure",
    "Download ranked clips, summary metrics, and timeline bins when the source is actually worth carrying forward.",
  ],
];

export function HomeShell() {
  return (
    <main className="pb-24">
      <section className="relative overflow-hidden border-b border-[var(--line)] px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(123,255,217,0.1),transparent_20%),radial-gradient(circle_at_80%_18%,rgba(124,212,255,0.12),transparent_24%)]" />

        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between rounded-full border border-[var(--line)] bg-[var(--surface-strong)]/85 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="metric-label text-[var(--muted)]">ClipMine AI</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Frontier speech curation for multimodal training data</p>
          </div>
          <a
            href="#upload"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Start with a video
            <ArrowDownRight className="size-4" />
          </a>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl gap-12 pt-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center"
          >
            <div className="metric-label text-[var(--accent)]">Upload any talking-head video and keep only the clean speech</div>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.88] tracking-[-0.08em] sm:text-6xl lg:text-[6.6rem]">
              Mine usable speech out of noisy video.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted-strong)] sm:text-xl">
              ClipMine AI is a curation surface for ML engineers and researchers who need ranked, training-ready speech
              clips instead of raw transcript clutter.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#upload"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#041017] transition hover:translate-y-[-1px]"
              >
                Upload a source video
                <ArrowDownRight className="size-4" />
              </a>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium text-[var(--muted-strong)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                Review the workflow
              </a>
            </div>

            <div className="mt-10 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
              {productPoints.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.1 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-3"
                  >
                    <div className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)]">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em]">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="hero-visual rounded-[2.6rem] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="metric-label text-[var(--accent)]">Live ranking surface</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">One source. One ranking pass.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/62">
                  Frontier console
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                <div className="rounded-[1.8rem] border border-white/10 bg-white/5 px-5 py-5 text-white">
                  <div className="metric-label text-white/42">Top clip score</div>
                  <div className="mt-3 text-7xl font-semibold tracking-[-0.08em]">91</div>
                  <div className="mt-4 space-y-3 text-sm text-white/68">
                    <div className="flex items-center justify-between gap-4">
                      <span>Target duration</span>
                      <span className="font-medium text-white">1-3s</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Active export</span>
                      <span className="font-medium text-white">JSON</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Timeline bins</span>
                      <span className="font-medium text-white">48</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {previewClips.map((clip, index) => (
                    <motion.div
                      key={clip.id}
                      initial={{ opacity: 0, x: 22 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.45, delay: 0.16 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
                      className="signal-row rounded-[1.6rem] px-4 py-4 text-white"
                      style={{ ["--signal-fill" as string]: `${78 - index * 22}%` }}
                    >
                      <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/72">
                              {clip.id}
                            </div>
                            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/62">
                              {clip.quality}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-white">{clip.score}/100</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/78">{clip.text}</p>
                        <div className="mt-3 text-xs text-white/52">{clip.meta}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="metric-label text-white/42">Usefulness timeline</div>
                <div className="mt-4 flex items-end gap-2">
                  {heatmapHeights.map((height, index) => (
                    <div
                      key={height + index}
                      className="flex-1 rounded-full bg-white/6"
                      style={{ height: "6rem" }}
                    >
                      <div
                        className="w-full rounded-full bg-[linear-gradient(180deg,rgba(124,212,255,0.18),rgba(123,255,217,0.92))]"
                        style={{ height: `${height}%`, marginTop: `${100 - height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="upload" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <UploadPanel />
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 border-t border-[var(--line)] pt-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="metric-label text-[var(--accent)]">Workflow</div>
            <h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-[-0.05em]">
              Built to feel like one working surface, not a startup landing page glued onto a dashboard.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted)]">
              The product should read in seconds: upload, inspect the strongest speech, and export only the regions
              that will survive downstream use.
            </p>
          </div>

          <div className="grid gap-6">
            {workflowSteps.map(([title, body], index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.48, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-[auto_1fr]"
              >
                <div className="metric-label text-[var(--muted)]">{`0${index + 1}`}</div>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
