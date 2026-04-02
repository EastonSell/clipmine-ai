"use client";

import { motion } from "framer-motion";
import { ArrowDownRight } from "lucide-react";

import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";

import { PreviewPanel } from "./preview-panel";
import { UploadSection } from "./upload-section";
import { WorkflowSection } from "./workflow-section";

const proofPoints = [
  {
    title: "Best clips",
    body: "Rank short speech windows by confidence, pace, signal strength, and continuity.",
  },
  {
    title: "Timeline",
    body: "Scan the full source video and jump straight to the strongest regions.",
  },
  {
    title: "JSON export",
    body: "Export structured clip data for annotation and dataset workflows.",
  },
];

export function HomePageView() {
  return (
    <AppShell>
      <section className="relative border-b border-[var(--line)] pt-4 sm:pt-6">
        <PageContainer>
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[var(--line)] bg-white/[0.04] px-4 py-3 backdrop-blur-xl ring-1 ring-inset ring-white/[0.04]">
            <div>
              <p className="metric-label text-[var(--muted-strong)]">ClipMine AI</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Speech clip curation for training workflows.</p>
            </div>
            <a href="#upload" className={buttonClassName({ variant: "secondary", size: "md" })}>
              Upload video
              <ArrowDownRight className="size-4" />
            </a>
          </header>

          <div className="grid gap-14 pb-18 pt-14 lg:min-h-[calc(100svh-6.5rem)] lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <Badge tone="accent" className="px-3 py-1.5 text-[0.7rem]">
                  Training-ready speech curation
                </Badge>
                <h1 className="max-w-5xl text-[3.35rem] font-semibold leading-[0.92] tracking-[-0.08em] sm:text-[4.3rem] lg:text-[5.6rem]">
                  Find the best speech clips in a single video.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[var(--muted-strong)] sm:text-[1.15rem]">
                  Upload a talking-head source, review ranked 1 to 3 second speech segments, inspect the usefulness
                  timeline, and export structured JSON for downstream annotation or dataset work.
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

              <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
                {proofPoints.map((item, index) => {
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.12 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-[var(--surface)] px-5 py-5"
                    >
                      <p className="metric-label text-[var(--accent)]">{`0${index + 1}`}</p>
                      <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em]">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
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

      <PageContainer className="space-y-0">
        <UploadSection />
        <WorkflowSection />
      </PageContainer>
    </AppShell>
  );
}
