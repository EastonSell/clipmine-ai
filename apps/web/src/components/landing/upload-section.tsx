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
const MAX_UPLOAD_MB = 250;

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
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card tone="subtle" className="p-6">
          <SectionHeader
            eyebrow="Upload"
            title="Start with a single source video"
            description="ClipMine is designed for one clear workflow: upload a video, review the best speech clips, and export structured data."
          />

          <div className="mt-8 space-y-5">
            {uploadDetails.map(([title, description], index) => (
              <div key={title} className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[auto_1fr]">
                <div className="metric-label text-[var(--muted)]">{`0${index + 1}`}</div>
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card padded={false} className="overflow-hidden">
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
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
                  <p>Accepted types: `.mp4` and `.mov`</p>
                  <p>Default upload limit: {MAX_UPLOAD_MB} MB</p>
                </div>
                <Button type="submit" variant="primary" size="lg" disabled={isUploading}>
                  {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                  {isUploading ? "Processing" : "Upload video"}
                </Button>
              </div>
            </form>

            {error ? (
              <div className="border-t border-[var(--line)] p-6">
                <div className="rounded-[1.25rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-200">
                  <div className="flex items-center gap-2 font-medium text-red-100">
                    <AlertCircle className="size-4" />
                    Upload failed
                  </div>
                  <p className="mt-2 leading-6">{error}</p>
                </div>
              </div>
            ) : null}
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
