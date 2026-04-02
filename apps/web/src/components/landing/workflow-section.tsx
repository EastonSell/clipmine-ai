import { CheckCircle2, Film, FileJson2, Sparkles } from "lucide-react";

import { SectionHeader } from "@/components/ui/section-header";

const implementedFeatures = [
  {
    title: "Persistent job workspace",
    description: "Each upload moves into a stable results URL so processing and review happen in the same place.",
    icon: Film,
  },
  {
    title: "Batch queue",
    description: "Multiple uploads can be queued into one batch session with per-job status and cross-job export.",
    icon: CheckCircle2,
  },
  {
    title: "Ranked clip analysis",
    description: "Short speech windows are segmented, scored, labeled, and explained for fast review.",
    icon: Sparkles,
  },
  {
    title: "Usefulness timeline",
    description: "A 48-bin overview highlights stronger and weaker regions across the full source video.",
    icon: Film,
  },
  {
    title: "Structured export",
    description: "JSON export preserves clip metadata for annotation pipelines and training set curation.",
    icon: FileJson2,
  },
];

export function WorkflowSection() {
  return (
    <section id="features" className="border-t border-[var(--line)] py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <SectionHeader
          eyebrow="Implemented now"
          title="The current release already covers the core curation workflow"
          description="ClipMine AI is already useful as a training-signal curation tool. These capabilities are shipped in the app today and are available in the current codebase."
        />

        <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
          {implementedFeatures.map((feature, index) => {
            const Icon = feature.icon;

            return (
            <div key={feature.title} className="bg-[var(--surface)] px-5 py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-[0.9rem] border border-[var(--line)] bg-white/[0.04] text-[var(--accent)]">
                <Icon className="size-4" />
              </div>
              <div className="mt-4 metric-label text-[var(--accent)]">{`0${index + 1}`}</div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{feature.description}</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
