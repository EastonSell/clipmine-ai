import { SectionHeader } from "@/components/ui/section-header";

const roadmapItems = [
  {
    title: "Resumable transfers",
    description:
      "Persist multipart upload checkpoints so large source transfers can survive a full browser refresh or restart.",
  },
  {
    title: "Worker separation",
    description:
      "Move processing onto a dedicated worker service once production throughput outgrows the current single-service model.",
  },
  {
    title: "Recovery and observability",
    description:
      "Add stronger job tracing, object-storage metrics, and deployment-level alerts so failures are easier to diagnose.",
  },
  {
    title: "Richer export presets",
    description:
      "Expand export options with additional metadata, optional CSV, and clearer handoff formats for downstream tooling.",
  },
];

export function RoadmapSection() {
  return (
    <section id="roadmap" className="border-t border-[var(--line)] py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <SectionHeader
          eyebrow="Roadmap"
          title="The next product and platform upgrades are already scoped"
          description="The current release is functional today. These are the most valuable improvements planned next to make ClipMine AI more robust, faster to review, and easier to deploy at larger file sizes."
        />

        <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
          {roadmapItems.map((item, index) => (
            <div key={item.title} className="bg-[var(--surface)] px-5 py-6">
              <p className="metric-label text-[var(--accent)]">{`0${index + 1}`}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
