"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { createJob } from "@/lib/api";

import { UploadDropzone } from "./upload-dropzone";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];
const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "1024");

const uploadDetails = [
  ["Upload video", "Add one source file and move directly into a persistent workspace URL."],
  ["Processing", "The backend extracts audio, transcribes speech, segments clips, and scores each window."],
  ["Output", "Review ranked clips, inspect the timeline, and export JSON when the job is ready."],
];

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function isOversizeFile(file: File) {
  return file.size > MAX_UPLOAD_MB * 1024 * 1024;
}

export function UploadSection() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose an .mp4 or .mov file to continue.");
      return;
    }

    if (!isAcceptedFile(selectedFile)) {
      setError("Only .mp4 and .mov files are supported.");
      return;
    }

    if (isOversizeFile(selectedFile)) {
      setError(`The selected file is larger than the ${MAX_UPLOAD_MB} MB upload limit.`);
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
    <section id="upload" className="border-t border-[var(--line)] py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card padded={false} className="overflow-hidden">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-[var(--line)] p-6 sm:p-8 xl:border-b-0 xl:border-r">
              <SectionHeader
                eyebrow="Upload"
                title="Start with one source video"
                description="The intake flow is intentionally simple: upload a file, move into a persistent workspace, and let the backend keep the processing state current."
              />

              <div className="mt-8 grid gap-px overflow-hidden rounded-[1.3rem] border border-[var(--line)] bg-[var(--line)]">
                {uploadDetails.map(([title, description], index) => (
                  <div key={title} className="grid gap-3 bg-[var(--surface)] px-5 py-5 sm:grid-cols-[auto_1fr]">
                    <div className="metric-label text-[var(--accent)]">{`0${index + 1}`}</div>
                    <div>
                      <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.3rem] border border-[var(--line)] bg-white/[0.03] px-5 py-5">
                <div className="metric-label text-[var(--muted)]">Upload policy</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted-strong)]">
                    .mp4
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted-strong)]">
                    .mov
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted-strong)]">
                    {MAX_UPLOAD_MB >= 1024
                      ? `${Math.round(MAX_UPLOAD_MB / 1024)} GB default limit`
                      : `${MAX_UPLOAD_MB} MB default limit`}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <UploadDropzone
                  selectedFile={selectedFile}
                  isDragging={isDragging}
                  onDragChange={setIsDragging}
                  onSelectFile={(file) => {
                    setSelectedFile(file);
                    setError(null);
                    setIsDragging(false);
                  }}
                />

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
                  <div className="space-y-1 text-sm text-[var(--muted)]">
                    <p>Uploads go directly to the processing API.</p>
                    <p>The workspace URL remains stable while large uploads, transcription, and scoring run.</p>
                  </div>
                  <Button type="submit" variant="primary" size="lg" disabled={isUploading}>
                    {isUploading ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                    {isUploading ? "Processing" : "Upload video"}
                  </Button>
                </div>
              </form>

              {error ? (
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <div className="rounded-[1.25rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-200">
                    <div className="flex items-center gap-2 font-medium text-red-100">
                      <AlertCircle className="size-4" />
                      Upload failed
                    </div>
                    <p className="mt-2 leading-6">{error}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </motion.div>
    </section>
  );
}
