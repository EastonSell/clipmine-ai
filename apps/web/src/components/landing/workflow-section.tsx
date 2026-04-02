import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

const workflowSteps = [
  {
    title: "Upload video",
    description: "Start with one talking-head source and move directly into a workspace URL.",
  },
  {
    title: "Review best clips",
    description: "Use clip scores, explanations, and the source player to judge training usefulness quickly.",
  },
  {
    title: "Export JSON",
    description: "Download ranked clips and timeline metadata for downstream annotation or curation work.",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="border-t border-[var(--line)] py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <SectionHeader
          eyebrow="Workflow"
          title="Understand the product in one pass"
          description="The app is designed to answer three questions clearly: what should I upload, which clips are useful, and what can I export?"
        />

        <Card padded={false} className="overflow-hidden">
          <div className="grid gap-px bg-[var(--line)] md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="bg-[var(--surface)] px-5 py-6">
                <div className="metric-label text-[var(--accent)]">{`0${index + 1}`}</div>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{step.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
