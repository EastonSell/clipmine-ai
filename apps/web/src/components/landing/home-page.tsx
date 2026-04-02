"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, FileJson2, Sparkles, Waves } from "lucide-react";

import { AppShell } from "@/components/ui/app-shell";
import { buttonClassName } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";

import { PreviewPanel } from "./preview-panel";
import { UploadSection } from "./upload-section";
import { WorkflowSection } from "./workflow-section";

const productPoints = [
  {
    icon: Waves,
    title: "Best clips",
    body: "Rank short speech windows by confidence, pace, signal strength, and continuity.",
  },
  {
    icon: Sparkles,
    title: "Timeline",
    body: "Scan the full source video and jump straight to the strongest regions.",
  },
  {
    icon: FileJson2,
    title: "JSON export",
    body: "Export structured clip data for annotation and dataset workflows.",
  },
];

export function HomePageView() {
  return (
    <AppShell>
      <section className="border-b border-[var(--line)] pt-4 sm:pt-5">
        <PageContainer className="pb-16">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[var(--line)] bg-[var(--surface-strong)]/85 px-4 py-3 backdrop-blur-xl">
            <div>
              <p className="metric-label text-[var(--muted)]">ClipMine AI</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Find the best speech clips in one source video.</p>
            </div>
            <a href="#upload" className={buttonClassName({ variant: "secondary", size: "md" })}>
              Upload video
              <ArrowDownRight className="size-4" />
            </a>
          </header>

          <div className="grid gap-12 pt-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <p className="metric-label text-[var(--accent)]">Training-ready speech curation</p>
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.9] tracking-[-0.08em] sm:text-6xl lg:text-[5.8rem]">
                  Upload a video and review the best speech clips.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[var(--muted-strong)] sm:text-xl">
                  ClipMine AI processes a talking-head video, scores short speech clips for training usefulness, shows
                  the strongest regions on a timeline, and exports structured JSON.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <a href="#upload" className={buttonClassName({ variant: "primary", size: "lg" })}>
                  Upload video
                  <ArrowDownRight className="size-4" />
                </a>
                <a href="#workflow" className={buttonClassName({ variant: "ghost", size: "lg" })}>
                  View workflow
                </a>
              </div>

              <div className="grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
                {productPoints.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.12 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-3"
                    >
                      <div className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)]">
                        <Icon className="size-5 text-[var(--accent)]" />
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
              initial={{ opacity: 0, scale: 0.98, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <PreviewPanel />
            </motion.div>
          </div>
        </PageContainer>
      </section>

      <PageContainer>
        <UploadSection />
        <WorkflowSection />
      </PageContainer>
    </AppShell>
  );
}
