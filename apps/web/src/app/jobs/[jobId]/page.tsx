import Link from "next/link";

type JobPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobPage({ params }: JobPageProps) {
  const { jobId } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="metric-label text-[var(--muted)]">Job Workspace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">Clip analysis pending</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Workspace scaffold for job <span className="font-medium text-[var(--text)]">{jobId}</span>. Ranked clips,
            timeline, and export panels will render here when the backend pipeline is connected.
          </p>
        </div>
        <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">
          Upload another video
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-frame rounded-[2rem] p-6">
          <div className="metric-label text-[var(--muted)]">Best Clips</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5">
              Ranked clip cards will appear here after processing.
            </div>
          </div>
        </div>
        <div className="section-frame rounded-[2rem] p-6">
          <div className="metric-label text-[var(--muted)]">Timeline</div>
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5">
            Timeline heatmap scaffold.
          </div>
        </div>
      </section>
    </main>
  );
}
