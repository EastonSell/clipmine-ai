"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowUpRight, LoaderCircle, RotateCcw, StopCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ApiError, createJob, getUploadMode, isRetryableApiError } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { UploadPhase, UploadProgress } from "@/lib/types";

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
  const [error, setError] = useState<ApiError | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<UploadProgress | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | "idle">("idle");
  const activeUploadCancelRef = useRef<(() => void) | null>(null);
  const uploadMode = getUploadMode();

  async function runUpload() {
    if (!selectedFile) {
      setError(new ApiError({ code: "unsupported_file_type", message: "Choose an .mp4 or .mov file to continue.", retryable: false }));
      return;
    }

    if (!isAcceptedFile(selectedFile)) {
      setError(new ApiError({ code: "unsupported_file_type", message: "Only .mp4 and .mov files are supported.", retryable: false }));
      return;
    }

    if (isOversizeFile(selectedFile)) {
      setError(
        new ApiError({
          code: "file_too_large",
          message: `The selected file is larger than the ${MAX_UPLOAD_MB} MB upload limit.`,
          retryable: false,
        })
      );
      return;
    }

    setIsUploading(true);
    setUploadPhase("validating");
    setUploadProgress(0);
    setUploadStats({
      loaded: 0,
      total: selectedFile.size,
      percentage: 0,
    });
    setError(null);

    try {
      const uploadTask = createJob(selectedFile, {
        onPhaseChange(phase) {
          setUploadPhase(phase);
        },
        onUploadProgress(progress) {
          setUploadProgress(progress.percentage);
          setUploadStats(progress);
        },
      });
      activeUploadCancelRef.current = uploadTask.cancel;
      const job = await uploadTask.promise;
      startTransition(() => {
        router.push(`/jobs/${job.jobId}`);
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError
          : new ApiError({ code: "request_failed", message: "Upload failed.", retryable: false })
      );
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStats(null);
      setUploadPhase("idle");
      activeUploadCancelRef.current = null;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runUpload();
  }

  function handleCancelUpload() {
    activeUploadCancelRef.current?.();
    activeUploadCancelRef.current = null;
    setIsUploading(false);
    setUploadPhase("idle");
    setUploadProgress(0);
    setUploadStats(null);
    setError(new ApiError({ code: "upload_cancelled", message: "Upload was cancelled before processing started.", retryable: true }));
  }

  function handleRetryUpload() {
    if (!selectedFile) {
      return;
    }

    void runUpload();
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
          <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-overlay)] p-6 sm:p-8 xl:border-b-0 xl:border-r">
              <SectionHeader
                eyebrow="Intake"
                title="Start inside the upload bay"
                description="The landing flow now behaves like an app surface: choose a file, watch transfer state, then move directly into a persistent review workspace."
              />

              <div className="mt-8 grid gap-px overflow-hidden rounded-[1.3rem] border border-[var(--line)] bg-[var(--line)]">
                {uploadDetails.map(([title, description], index) => (
                  <div key={title} className="grid gap-3 bg-[var(--surface)] px-5 py-5 sm:grid-cols-[auto_1fr]">
                    <div className="inline-flex size-8 items-center justify-center rounded-[0.8rem] border border-[var(--line)] bg-white/[0.04] font-mono text-xs text-[var(--accent)]">
                      {`0${index + 1}`}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/[0.03] px-5 py-5">
                  <div className="metric-label text-[var(--muted)]">Upload policy</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-[0.85rem] border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted-strong)]">
                      .mp4
                    </span>
                    <span className="rounded-[0.85rem] border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted-strong)]">
                      .mov
                    </span>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/[0.03] px-5 py-5">
                  <div className="metric-label text-[var(--muted)]">Default limit</div>
                  <div className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[var(--text)]">
                    {MAX_UPLOAD_MB >= 1024
                      ? `${Math.round(MAX_UPLOAD_MB / 1024)} GB default limit`
                      : `${MAX_UPLOAD_MB} MB`}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Large uploads stay in one flow and keep the workspace URL stable.</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="metric-label text-[var(--accent)]">Upload bay</div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Use the dropzone below to start a new review job.
                      </p>
                    </div>
                    <div className="rounded-[0.85rem] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-medium text-[var(--muted-strong)]">
                      {uploadMode === "multipart" ? "Multipart transfer" : "Direct transfer"}
                    </div>
                  </div>
                </div>

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
                    <p>
                      {isUploading
                        ? uploadPhase === "validating"
                          ? "Validating the file before transfer begins."
                          : uploadPhase === "transferring"
                            ? uploadMode === "multipart"
                              ? "Uploading directly to object storage with multipart transfer."
                              : "Uploading directly to the processing API."
                            : uploadPhase === "finalizing"
                              ? "Finalizing the upload before processing starts."
                              : "Transfer complete. Opening the processing workspace."
                        : uploadMode === "multipart"
                          ? "Production uploads can transfer directly to object storage."
                          : "Uploads go directly to the processing API."}
                    </p>
                    <p>
                      {isUploading
                        ? uploadPhase === "processing"
                          ? "The workspace will open automatically while backend processing continues."
                          : "The workspace will open automatically as soon as transfer finalization completes."
                        : "The workspace URL remains stable while large uploads, transcription, and scoring run."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isUploading ? (
                      <Button type="button" variant="ghost" size="lg" onClick={handleCancelUpload}>
                        <StopCircle className="size-4" />
                        Cancel
                      </Button>
                    ) : null}
                    <Button type="submit" variant="primary" size="lg" disabled={isUploading}>
                      {isUploading ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                      {isUploading ? "Processing" : "Upload video"}
                    </Button>
                  </div>
                </div>

                {isUploading && selectedFile ? (
                  <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="metric-label text-[var(--muted)]">Upload progress</p>
                        <p className="mt-2 text-sm text-[var(--muted-strong)]">
                          {uploadPhase === "validating"
                            ? `Validating ${selectedFile.name} before transfer begins.`
                            : uploadPhase === "transferring"
                              ? uploadMode === "multipart"
                                ? `Streaming ${selectedFile.name} to object storage in resumable parts.`
                                : `Sending ${selectedFile.name} to the processing API.`
                              : uploadPhase === "finalizing"
                                ? "Finishing the upload and creating the processing job."
                                : "Upload finalized. Opening the processing workspace."}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatBytes(uploadStats?.loaded ?? 0)} of {formatBytes(uploadStats?.total ?? selectedFile.size)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[var(--text)]">{uploadProgress}%</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{formatBytes(selectedFile.size)}</div>
                      </div>
                    </div>
                    <ProgressBar value={uploadProgress} className="mt-4" />
                  </div>
                ) : null}
              </form>

              {error ? (
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <div className="rounded-[1.25rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-200">
                    <div className="flex items-center gap-2 font-medium text-red-100">
                      <AlertCircle className="size-4" />
                      Upload failed
                    </div>
                    <p className="mt-2 leading-6">{error.message}</p>
                    {selectedFile && isRetryableApiError(error) ? (
                      <div className="mt-4">
                        <Button type="button" variant="secondary" size="sm" onClick={handleRetryUpload}>
                          <RotateCcw className="size-4" />
                          Retry upload
                        </Button>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs leading-5 text-red-200/80">
                      If you are running locally, make sure both the frontend and backend are running and that the API
                      allows the current browser origin.
                    </p>
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
