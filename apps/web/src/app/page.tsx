export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex items-center justify-between py-4">
        <div>
          <p className="metric-label text-[var(--muted)]">ClipMine AI</p>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Upload any video and instantly find, visualize, and export the best training-ready speech clips.
          </p>
        </div>
        <a
          href="#upload"
          className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium"
        >
          Start with a video
        </a>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
        <div className="space-y-6">
          <div className="metric-label text-[var(--muted)]">Training-signal curation for multimodal speech data</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Extract the strongest speech moments from messy real-world video.
          </h1>
          <p className="max-w-2xl text-lg text-[var(--muted)] sm:text-xl">
            ClipMine AI ranks short clips by transcription confidence, signal strength, pace, and continuity so you can
            move from upload to clean training candidates without hand-scrubbing a transcript.
          </p>
        </div>

        <div className="section-frame rounded-[2rem] p-6">
          <div className="space-y-3">
            <div className="metric-label text-[var(--muted)]">Output</div>
            <div className="grid gap-3">
              {[
                "Ranked clips with score explanations",
                "Interactive timeline of training usefulness",
                "Structured JSON export for downstream workflows",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="upload"
        className="section-frame grid gap-8 rounded-[2rem] p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="space-y-3">
          <div className="metric-label text-[var(--muted)]">Upload</div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em]">A focused workspace is next.</h2>
          <p className="max-w-xl text-[var(--muted)]">
            The full upload pipeline, ranked clips, timeline, and export workspace are implemented in the next build
            step. This scaffold keeps the app deployable while the backend processing pipeline lands.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] bg-white/60 p-8">
          <div className="space-y-4">
            <div className="metric-label text-[var(--muted)]">Accepted inputs</div>
            <div className="text-2xl font-semibold tracking-[-0.04em]">.mp4 and .mov</div>
            <p className="text-sm text-[var(--muted)]">
              Direct multipart upload to the FastAPI backend will be wired in the next milestone.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

