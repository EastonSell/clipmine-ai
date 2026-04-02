import { Card } from "./card";

type FooterNote = {
  label: string;
  body: string;
};

type FooterNotesProps = {
  eyebrow?: string;
  title: string;
  notes: FooterNote[];
  id?: string;
};

export function FooterNotes({
  eyebrow = "Notes",
  title,
  notes,
  id,
}: FooterNotesProps) {
  return (
    <section id={id} className="border-t border-[var(--line)] py-16 sm:py-20">
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
          <p className="metric-label text-[var(--accent)]">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">{title}</h2>
        </div>
        <div className="grid gap-px bg-[var(--line)] md:grid-cols-3">
          {notes.map((note) => (
            <div key={note.label} className="bg-[var(--surface)] px-5 py-5">
              <p className="metric-label text-[var(--muted)]">{note.label}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{note.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
