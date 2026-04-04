"use client";

import { motion } from "framer-motion";
import { ArrowDownRight } from "lucide-react";

import { AppShell } from "@/components/ui/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { FooterNotes } from "@/components/ui/footer-notes";
import { PageContainer } from "@/components/ui/page-container";
import { TopBar } from "@/components/ui/top-bar";

import { GoalsSection } from "./goals-section";
import { PreviewPanel } from "./preview-panel";
import { RecentJobsSection } from "./recent-jobs-section";
import { RoadmapSection } from "./roadmap-section";
import { UploadSection } from "./upload-section";
import { WorkflowSection } from "./workflow-section";

const proofPoints = [
  {
    id: "best-clips",
    title: "Best clips",
    body: "Pull the strongest speech windows forward with score, reasoning, and transcript context.",
  },
  {
    id: "batch-queue",
    title: "Batch queue",
    body: "Keep multiple uploads inside one review run so retries, ready jobs, and exports stay grouped.",
  },
  {
    id: "export",
    title: "Training package",
    body: "Ship mp4 or wav clips, spectrograms, and linked manifest metadata from one export surface.",
  },
];

const footerNotes = [
  {
    label: "Uploads",
    body: "Local development defaults to direct uploads, while production deployments can switch to multipart object-storage transfers for larger sources.",
  },
  {
    label: "Processing",
    body: "Large files take longer to transfer and transcribe, but the workspace URL remains stable while the backend keeps state current.",
  },
    {
      label: "Output",
      body: "Best clips, timeline bins, spectrogram companions, package export, and raw JSON all stay aligned to the same source video and scoring pass.",
    },
  ];

export function HomePageView() {
  return (
    <AppShell>
      <section id="top" className="relative border-b border-[var(--line)] pt-4 sm:pt-6">
        <PageContainer>
          <TopBar
            eyebrow="ClipMine AI"
            subtitle="Speech clip curation for training workflows."
            items={[
              { label: "Recent", href: "#recent-jobs" },
              { label: "Goals", href: "#goals" },
              { label: "Features", href: "#features" },
              { label: "Roadmap", href: "#roadmap" },
              { label: "Upload", href: "#upload" },
              { label: "Notes", href: "#notes" },
            ]}
            action={
              <a href="#upload" className={buttonClassName({ variant: "secondary", size: "md" })}>
                Upload video
                <ArrowDownRight className="size-4" />
              </a>
            }
          />

          <div className="grid gap-14 pb-18 pt-10 lg:min-h-[calc(100svh-7.25rem)] lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent" className="px-3 py-1.5 text-[0.7rem]">
                  Training-ready speech curation
                </Badge>
                <Badge tone="neutral" className="px-3 py-1.5 text-[0.7rem]">
                  Modern workspace
                </Badge>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--muted)] shadow-[var(--shadow-soft)] sm:max-w-xl">
                  Upload one source or queue a full batch, review ranked clips against the original media, and export cleaner training packages from one workspace.
                </div>
                <h1 className="max-w-4xl text-[2.85rem] font-semibold leading-[0.96] tracking-[-0.075em] sm:text-[3.75rem] lg:text-[4.45rem]">
                  One workspace for upload review and package handoff.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-[1.05rem]">
                  ClipMine AI turns one source or a full batch into ranked review surfaces with clip scoring, timeline
                  coverage, queue status, spectrogram references, and package-ready metadata for training and annotation workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <a href="#upload" className={buttonClassName({ variant: "primary", size: "lg" })}>
                  Upload video
                  <ArrowDownRight className="size-4" />
                </a>
                <a href="#features" className={buttonClassName({ variant: "ghost", size: "lg" })}>
                  Explore workspace
                </a>
              </div>

              <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
                {proofPoints.map((item, index) => {
                  return (
                    <motion.div
                      key={item.title}
                      id={item.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.12 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-[var(--surface)] px-5 py-5"
                    >
                      <div className="inline-flex size-8 items-center justify-center rounded-[0.8rem] border border-[var(--line)] bg-white/[0.04] font-mono text-xs text-[var(--accent)]">
                        {`0${index + 1}`}
                      </div>
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
        <RecentJobsSection />
        <GoalsSection />
        <WorkflowSection />
        <RoadmapSection />
        <FooterNotes id="notes" title="Operational notes" notes={footerNotes} />
      </PageContainer>
    </AppShell>
  );
}
