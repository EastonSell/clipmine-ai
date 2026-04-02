"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LoaderCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { createJob } from "@/lib/api";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];

export function UploadPanel() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose an .mp4 or .mov file to start.");
      return;
    }

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
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
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="section-frame rounded-[2rem] p-6 sm:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="metric-label text-[var(--muted)]">Upload</div>
          <h2 className="max-w-lg text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            Drop in a video. Keep the source. Surface only the best speech moments.
          </h2>
          <p className="max-w-lg text-[var(--muted)]">
            ClipMine AI sends the original video straight to the FastAPI backend, queues processing, and drops you into
            a job workspace with ranked clips, timeline signal, and export-ready JSON.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span className="rounded-full border border-[var(--line)] px-3 py-2">.mp4 / .mov</span>
            <span className="rounded-full border border-[var(--line)] px-3 py-2">250 MB default limit</span>
            <span className="rounded-full border border-[var(--line)] px-3 py-2">CPU-safe processing</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label
            htmlFor="video-upload"
            className="group flex min-h-64 cursor-pointer flex-col justify-between rounded-[1.75rem] border border-dashed border-[var(--line)] bg-white/65 p-6 transition hover:border-[var(--text)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label text-[var(--muted)]">Input</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Choose a source video</div>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-[var(--accent)] p-3 transition group-hover:translate-x-1 group-hover:-translate-y-1">
                <Upload className="size-5" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Drag and drop isn&apos;t required here. A clean picker is more reliable for larger local video files.
              </p>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm">
                {selectedFile ? selectedFile.name : "No file selected yet"}
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
              setSelectedFile(nextFile);
              setError(null);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-sm text-[var(--muted)]">
              <p>Uploads go directly to the processing API.</p>
              <p>The workspace URL is persistent once the job is created.</p>
            </div>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
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
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        <div className="flex flex-wrap gap-6">
          <span>Ranked clips with explanations</span>
          <span>Timeline signal view</span>
          <span>Structured JSON export</span>
        </div>
        <Link href="#workflow" className="inline-flex items-center gap-2 font-medium text-[var(--text)]">
          See the workflow
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </motion.div>
  );
}

