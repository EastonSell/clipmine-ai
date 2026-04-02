"use client";

import { motion } from "framer-motion";

import { UploadPanel } from "./upload-panel";

const proofPoints = [
  {
    eyebrow: "Ranked clips",
    title: "Sort training-ready speech by confidence, pace, and signal quality.",
  },
  {
    eyebrow: "Timeline",
    title: "See which regions of the source video are strongest before you export.",
  },
  {
    eyebrow: "JSON export",
    title: "Hand downstream tools a clean, structured clip manifest instead of raw transcripts.",
  },
];

export function HomeShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <p className="metric-label text-[var(--muted)]">ClipMine AI</p>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Upload any video and instantly find, visualize, and export the best training-ready speech clips.
          </p>
        </div>
        <a href="#upload" className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium">
          Start with a video
        </a>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="metric-label text-[var(--muted)]">Training-signal curation for multimodal speech data</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Find the speech moments worth training on.
          </h1>
          <p className="max-w-2xl text-lg text-[var(--muted)] sm:text-xl">
            ClipMine AI is a focused curation tool for ML engineers, researchers, developers, and students who need
            clean speech clips from messy real-world video, fast.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="section-frame rounded-[2rem] p-6"
        >
          <div className="metric-label text-[var(--muted)]">Why it matters</div>
          <div className="mt-5 grid gap-3">
            {proofPoints.map((item) => (
              <div key={item.eyebrow} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <div className="metric-label text-[var(--muted)]">{item.eyebrow}</div>
                <p className="mt-3 text-base font-medium leading-relaxed">{item.title}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="upload">
        <UploadPanel />
      </section>

      <section id="workflow" className="grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
        {[
          ["1. Upload", "Send one source video and preserve the original media for review."],
          ["2. Curate", "Rank clips by confidence, energy, pace, continuity, and explanation text."],
          ["3. Export", "Download a structured JSON payload for annotation or dataset prep."],
        ].map(([title, description]) => (
          <div key={title} className="py-3">
            <div className="metric-label text-[var(--muted)]">{title}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

