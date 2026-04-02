"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, FileJson2, Sparkles, Waves } from "lucide-react";

import { UploadPanel } from "./upload-panel";

const scoringLanes = [
  {
    label: "Confidence",
    transcript: "Aligned timestamps and stable word certainty pull strong candidates upward.",
    fill: "88%",
  },
  {
    label: "Pace",
    transcript: "Moderate delivery wins over rushed or pause-heavy speech.",
    fill: "74%",
  },
  {
    label: "Signal",
    transcript: "Cleaner energy and steadier continuity survive the ranking pass.",
    fill: "92%",
  },
];

const productPoints = [
  {
    icon: Waves,
    title: "Rank training-ready clips",
    body: "Sort short speech windows by confidence, pace, energy, and continuity.",
  },
  {
    icon: Sparkles,
    title: "Read the source video quickly",
    body: "Use the timeline to spot strong and weak regions before exporting anything.",
  },
  {
    icon: FileJson2,
    title: "Hand off structured data",
    body: "Export a JSON manifest that downstream annotation tools can actually use.",
  },
];

const workflowSteps = [
  [
    "Upload one source file",
    "Keep the original video intact and move straight into an analysis workspace rather than a generic transcript dump.",
  ],
  [
    "Promote the strongest speech",
    "Surface short segments that balance confidence, signal quality, moderate pace, and continuity.",
  ],
  [
    "Export only useful structure",
    "Deliver clip metadata, ranked outputs, and timeline context for downstream curation or labeling.",
  ],
];

const heroFacts = [
  ["Clip window", "1 to 3 second speech moments"],
  ["Signal lens", "Confidence, pace, energy, continuity"],
  ["Export shape", "JSON ready for annotation workflows"],
];

export function HomeShell() {
  return (
    <main className="pb-20">
      <section className="relative overflow-hidden border-b border-[var(--line)] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between rounded-full border border-[var(--line)] bg-[var(--surface-strong)]/90 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="metric-label text-[var(--muted)]">ClipMine AI</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Training-signal curation for multimodal speech data</p>
          </div>
          <a
            href="#upload"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
          >
            Start with a video
            <ArrowDownRight className="size-4" />
          </a>
        </header>

        <div className="absolute inset-x-0 top-0 h-[46rem] bg-[radial-gradient(circle_at_20%_18%,rgba(214,255,57,0.2),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(255,197,87,0.15),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.34),transparent)]" />

        <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl gap-10 pt-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col justify-center"
          >
            <div className="metric-label text-[var(--muted)]">Upload any video and surface only the parts worth training on</div>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.9] tracking-[-0.07em] sm:text-6xl lg:text-8xl">
              Find the speech moments worth keeping.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
              ClipMine AI turns messy real-world video into ranked, training-ready speech clips with one clear workflow:
              upload, inspect signal quality, jump to the best regions, and export structured results.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#upload"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:translate-y-[-1px]"
              >
                Upload a source video
                <ArrowDownRight className="size-4" />
              </a>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-medium text-[var(--muted-strong)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
              >
                See the workflow
              </a>
            </div>

            <div className="telemetry-strip mt-9 grid gap-4 rounded-[1.8rem] p-5 sm:grid-cols-3">
              {heroFacts.map(([label, value]) => (
                <div key={label}>
                  <div className="metric-label text-[var(--muted)]">{label}</div>
                  <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
              {productPoints.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.12 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 0.75, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 lg:pl-6"
          >
            <div className="hero-visual rounded-[2.4rem] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 text-white/72">
                <div>
                  <p className="metric-label text-white/52">Signal preview</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Curate, don&apos;t scrub.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium text-white/70">
                  Ranked clips • timeline • export
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {scoringLanes.map((lane, index) => (
                  <motion.div
                    key={lane.label}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.18 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="signal-row rounded-[1.6rem] px-4 py-4 text-white"
                    style={{ ["--signal-fill" as string]: lane.fill }}
                  >
                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div>
                        <div className="metric-label text-white/45">{lane.label}</div>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-white/76">{lane.transcript}</p>
                      </div>
                      <div className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-medium text-white/72">
                        {lane.fill}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
                <div>
                  <div className="metric-label text-white/45">Signal score</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">89 / 100</div>
                </div>
                <div>
                  <div className="metric-label text-white/45">Target duration</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">1-3s</div>
                </div>
                <div>
                  <div className="metric-label text-white/45">Export format</div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">JSON</div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                  <div className="metric-label text-white/45">What changes</div>
                  <p className="mt-3 text-sm leading-6 text-white/74">
                    Instead of scrubbing raw transcript lines, you move through ranked speech moments with an explicit
                    quality explanation.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                  <div className="metric-label text-white/45">Why it ships</div>
                  <p className="mt-3 text-sm leading-6 text-white/74">
                    The product stays focused on one developer workflow: find strong training examples and export them
                    quickly.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 border-y border-[var(--line)] px-4 py-7 sm:grid-cols-3 sm:px-6 lg:px-8">
        {[
          ["Primary user", "ML engineers, researchers, developers, and students working with speech-heavy video."],
          ["Clip lens", "Confidence, pace, energy, silence ratio, continuity, and explanation text."],
          ["Why it feels distinct", "It curates the best training moments instead of dumping a transcript."],
        ].map(([label, body]) => (
          <div key={label} className="py-2">
            <div className="metric-label text-[var(--muted)]">{label}</div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">{body}</p>
          </div>
        ))}
      </section>

      <section id="upload" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <UploadPanel />
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 border-t border-[var(--line)] pt-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="metric-label text-[var(--muted)]">Workflow</div>
            <h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-[-0.05em]">
              Built for fast curation, not endless transcript cleanup.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted)]">
              The interface keeps one dominant action per section: upload in the landing view, inspect ranked clips in
              the workspace, then export only when the source is worth keeping.
            </p>
          </div>

          <div className="grid gap-6">
            {workflowSteps.map(([title, body], index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
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
