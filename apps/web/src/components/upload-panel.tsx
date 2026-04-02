"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LoaderCircle, Upload, Waves } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { createJob } from "@/lib/api";
import { formatBytes } from "@/lib/format";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];

const intakeNotes = [
  ["Input", ".mp4 or .mov source video"],
  ["Storage", "Original source stays available for direct playback"],
  ["Output", "Ranked clips, timeline signal, and structured JSON"],
];

export function UploadPanel() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isAcceptedFile(file: File) {
    const lowerName = file.name.toLowerCase();
    return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  }

  function assignSelectedFile(file: File | null) {
    setSelectedFile(file);
    setError(null);
    setIsDragging(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose an .mp4 or .mov file to start.");
      return;
    }

    if (!isAcceptedFile(selectedFile)) {
      setError("ClipMine AI accepts .mp4 and .mov uploads only.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const job = await createJob(selectedFile);
      startTransition(() => {
        router.push(`/jobs/${job.jobId}`);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      setIsUploading(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="section-frame overflow-hidden rounded-[2.5rem]"
    >
      <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
        <div className="border-b border-[var(--line)] px-6 py-7 sm:px-8 lg:border-b-0 lg:border-r">
          <div className="metric-label text-[var(--accent)]">Upload console</div>
          <h2 className="mt-4 max-w-md text-4xl font-semibold tracking-[-0.05em]">
            Start with one source video and keep the next step obvious.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--muted)]">
            This intake surface does one job: create a stable backend job and move you into a workspace URL that stays
            useful while transcription and scoring run.
          </p>

          <div className="mt-8 space-y-5">
            {intakeNotes.map(([label, body], index) => (
              <div key={label} className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[auto_1fr]">
                <div className="metric-label text-[var(--muted)]">{`0${index + 1}`}</div>
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em]">{label}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label
              htmlFor="video-upload"
              className="upload-dropzone group block cursor-pointer rounded-[2.2rem] border border-dashed border-[var(--line-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6 transition hover:border-[var(--accent)]"
              data-dragging={isDragging}
              data-has-file={Boolean(selectedFile)}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const nextFile = event.dataTransfer.files?.[0] ?? null;
                assignSelectedFile(nextFile);
              }}
            >
              <div className="relative z-10 flex min-h-[20rem] flex-col justify-between gap-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="metric-label text-[var(--muted)]">Source file</div>
                    <div className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
                      {isDragging ? "Drop the video into the intake lane" : "Choose a talking-head video"}
                    </div>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                      Prefer a single speaker or interview-style source. The system keeps the original video and ranks
                      short speech windows for reuse.
                    </p>
                  </div>
                  <div className="inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent)] text-[#051118] transition group-hover:translate-x-1 group-hover:-translate-y-1">
                    <Upload className="size-6" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--surface-elevated)] px-5 py-4">
                      <div className="metric-label text-[var(--muted)]">Current selection</div>
                      <div className="mt-2 text-lg font-medium tracking-[-0.03em]">
                        {selectedFile ? selectedFile.name : "No file selected yet"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
                          {selectedFile ? formatBytes(selectedFile.size) : "Waiting for file"}
                        </span>
                        <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
                          {selectedFile ? (selectedFile.type || "Video file") : "Direct browser upload"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(123,255,217,0.06),rgba(255,255,255,0.02))] px-5 py-4">
                      <div className="metric-label text-[var(--muted)]">Accepted types</div>
                      <div className="mt-3 flex items-center gap-3 text-sm text-[var(--muted-strong)]">
                        <Waves className="size-4" />
                        .mp4 and .mov
                      </div>
                      <div className="mt-5 text-xs leading-6 text-[var(--muted)]">
                        Drag and drop works here. The backend job is created immediately after upload succeeds.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                      {isDragging
                        ? "Release to set the file. Validation still runs before the upload starts."
                        : "Upload goes straight to the processing API and then redirects into a persistent workspace URL."}
                    </div>
                    <div className="rounded-full border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
                      250 MB default limit
                    </div>
                  </div>
                </div>
              </div>
            </label>

            <input
              id="video-upload"
              type="file"
              accept=".mp4,.mov,video/mp4,video/quicktime"
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                assignSelectedFile(nextFile);
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-4">
              <div className="space-y-1 text-sm text-[var(--muted)]">
                <p>Uploads go directly to the processing API.</p>
                <p>The workspace URL is persistent as soon as the job is created.</p>
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#051118] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                {isUploading ? "Starting analysis" : "Upload and analyze"}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key={error}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[1.4rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-6 py-4 text-sm text-[var(--muted)] sm:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>Confidence-aware ranking</span>
          <span>Clickable timeline signal</span>
          <span>JSON export for downstream tooling</span>
        </div>
        <Link href="#workflow" className="inline-flex items-center gap-2 font-medium text-[var(--muted-strong)]">
          Review the workflow
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </motion.section>
  );
}
