import { SectionHeader } from "@/components/ui/section-header";

const goals = [
  {
    title: "Reduce manual review",
    description:
      "Move from a long source video to a ranked shortlist instead of scrubbing raw footage end to end.",
  },
  {
    title: "Prioritize training-ready speech",
    description:
      "Favor clips with stronger confidence, pace, signal quality, and continuity rather than dumping every transcript segment.",
  },
  {
    title: "Export useful structure",
    description:
      "Keep clip timing, scores, explanations, and timeline context aligned for downstream annotation and dataset work.",
  },
];

export function GoalsSection() {
  return (
    <section id="goals" className="border-t border-[var(--line)] py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <SectionHeader
          eyebrow="Project goals"
          title="Built to shorten the path from raw video to usable speech data"
          description="ClipMine AI is designed for dataset builders who need to find strong speech segments quickly, explain why they are useful, and hand off clean structure to downstream tooling."
        />

        <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
          {goals.map((goal, index) => (
            <div key={goal.title} className="bg-[var(--surface)] px-5 py-6">
              <p className="metric-label text-[var(--accent)]">{`0${index + 1}`}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{goal.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{goal.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
