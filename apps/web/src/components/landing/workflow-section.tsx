import { SectionHeader } from "@/components/ui/section-header";

const implementedFeatures = [
  {
    title: "Persistent job workspace",
    description: "Each upload moves into a stable results URL so processing and review happen in the same place.",
  },
  {
    title: "Ranked clip analysis",
    description: "Short speech windows are segmented, scored, labeled, and explained for fast review.",
  },
  {
    title: "Usefulness timeline",
    description: "A 48-bin overview highlights stronger and weaker regions across the full source video.",
  },
  {
    title: "Structured export",
    description: "JSON export preserves clip metadata for annotation pipelines and training set curation.",
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
          {implementedFeatures.map((feature, index) => (
            <div key={feature.title} className="bg-[var(--surface)] px-5 py-6">
              <div className="metric-label text-[var(--accent)]">{`0${index + 1}`}</div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
