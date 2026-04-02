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
import { RoadmapSection } from "./roadmap-section";
import { UploadSection } from "./upload-section";
import { WorkflowSection } from "./workflow-section";

const proofPoints = [
  {
    id: "best-clips",
    title: "Best clips",
    body: "Review ranked short speech windows by confidence, pace, signal strength, and continuity.",
  },
  {
    id: "timeline",
    title: "Timeline",
    body: "Scan the full source video and jump straight to the strongest regions.",
  },
  {
    id: "export",
    title: "JSON export",
    body: "Export structured clip data for annotation and dataset workflows.",
  },
];

const footerNotes = [
  {
    label: "Uploads",
    body: "ClipMine defaults to direct browser-to-backend uploads and supports source files up to 1 GB by default.",
  },
  {
    label: "Processing",
    body: "Large files take longer to transfer and transcribe, but the workspace URL remains stable while the backend keeps state current.",
  },
  {
    label: "Output",
    body: "Best clips, timeline bins, and JSON export all stay aligned to the same source video and scoring pass.",
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

          <div className="grid gap-14 pb-18 pt-12 lg:min-h-[calc(100svh-7.25rem)] lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
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
                  ClipMine AI helps dataset builders reduce manual review time by ranking 1 to 3 second speech
                  segments, showing usefulness across the full source, and exporting structured clip data for
                  annotation or training workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <a href="#upload" className={buttonClassName({ variant: "primary", size: "lg" })}>
                  Upload video
                  <ArrowDownRight className="size-4" />
                </a>
                <a href="#features" className={buttonClassName({ variant: "ghost", size: "lg" })}>
                  See shipped features
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
        <GoalsSection />
        <WorkflowSection />
        <RoadmapSection />
        <FooterNotes id="notes" title="Operational notes" notes={footerNotes} />
      </PageContainer>
    </AppShell>
  );
}
