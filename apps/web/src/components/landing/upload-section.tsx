"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  LoaderCircle,
  RotateCcw,
  StopCircle,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useRef, useState } from "react";

import { saveBatchSession } from "@/lib/batch-sessions";
import { ApiError, createJob, getUploadMode, isRetryableApiError } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type {
  BatchSessionRecord,
  BatchUploadItemRecord,
  UploadPhase,
  UploadProgress,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeader } from "@/components/ui/section-header";

import { UploadDropzone } from "./upload-dropzone";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];
const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "1024");
const DEFAULT_BATCH_THRESHOLD = 84;

const uploadDetails = [
  ["Queue sources", "Upload one video into a direct workspace or send a whole batch through a sequential intake queue."],
  ["Process jobs", "Each source gets its own persistent job URL while the backend extracts audio, transcribes speech, and ranks clips."],
  ["Review and export", "Inspect each workspace separately or export top clips across the whole batch above a quality threshold."],
];

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function isOversizeFile(file: File) {
  return file.size > MAX_UPLOAD_MB * 1024 * 1024;
}

function createBatchId() {
  return `batch-${Math.random().toString(36).slice(2, 10)}`;
}

function createBatchLabel(fileCount: number) {
  return `${fileCount} source${fileCount === 1 ? "" : "s"} queued`;
}

function createBatchItems(files: File[]): BatchUploadItemRecord[] {
  const now = new Date().toISOString();
  return files.map((file, index) => ({
    id: `upload-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    sizeBytes: file.size,
    jobId: null,
    status: "queued",
    uploadPhase: "queued",
    uploadProgress: 0,
    error: null,
    updatedAt: now,
  }));
}

function upsertBatchSnapshot(
  batchId: string,
  label: string,
  createdAt: string,
  items: BatchUploadItemRecord[]
) {
  const snapshot: BatchSessionRecord = {
    batchId,
    label,
    createdAt,
    updatedAt: new Date().toISOString(),
    qualityThreshold: DEFAULT_BATCH_THRESHOLD,
    items,
  };
  saveBatchSession(snapshot);
}

function formatOverallQueueProgress(items: BatchUploadItemRecord[]) {
  if (items.length === 0) {
    return 0;
  }

  const weighted = items.reduce((total, item) => total + Math.max(0, Math.min(100, item.uploadProgress)), 0);
  return Math.round(weighted / items.length);
}

export function UploadSection() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<UploadProgress | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | "idle">("idle");
  const [batchQueue, setBatchQueue] = useState<BatchUploadItemRecord[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number | null>(null);
  const activeUploadCancelRef = useRef<(() => void) | null>(null);
  const batchCancelledRef = useRef(false);
  const uploadMode = getUploadMode();
  const isBatchMode = selectedFiles.length > 1 || batchQueue.length > 0;
  const primaryFile = selectedFiles[0] ?? null;
  const activeQueueItem = currentBatchIndex !== null ? batchQueue[currentBatchIndex] ?? null : null;
  const overallQueueProgress = useMemo(() => formatOverallQueueProgress(batchQueue), [batchQueue]);
  const completedQueueCount = batchQueue.filter((item) => item.status === "processing" || item.status === "ready").length;
  const failedQueueCount = batchQueue.filter((item) => item.status === "failed").length;

  function replaceQueueItem(index: number, updater: (current: BatchUploadItemRecord) => BatchUploadItemRecord) {
    setBatchQueue((currentItems) => {
      const nextItems = currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? updater(item)
          : item
      );
      return nextItems;
    });
  }

  function resetUploadState() {
    setIsUploading(false);
    setUploadPhase("idle");
    setUploadProgress(0);
    setUploadStats(null);
    setCurrentBatchIndex(null);
    activeUploadCancelRef.current = null;
  }

  function validateFiles(files: File[]) {
    if (files.length === 0) {
      return new ApiError({
        code: "unsupported_file_type",
        message: "Choose one or more .mp4 or .mov files to continue.",
        retryable: false,
      });
    }

    const unsupportedFiles = files.filter((file) => !isAcceptedFile(file));
    if (unsupportedFiles.length > 0) {
      return new ApiError({
        code: "unsupported_file_type",
        message: `Unsupported files: ${unsupportedFiles.map((file) => file.name).join(", ")}. Only .mp4 and .mov files are supported.`,
        retryable: false,
      });
    }

    const oversizeFiles = files.filter((file) => isOversizeFile(file));
    if (oversizeFiles.length > 0) {
      return new ApiError({
        code: "file_too_large",
        message: `These files exceed the ${MAX_UPLOAD_MB} MB limit: ${oversizeFiles.map((file) => file.name).join(", ")}.`,
        retryable: false,
      });
    }

    return null;
  }

  async function runSingleUpload(file: File) {
    setIsUploading(true);
    setUploadPhase("validating");
    setUploadProgress(0);
    setUploadStats({
      loaded: 0,
      total: file.size,
      percentage: 0,
    });
    setError(null);

    try {
      const uploadTask = createJob(file, {
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
      resetUploadState();
    }
  }

  async function runBatchUpload(files: File[]) {
    const batchId = createBatchId();
    const label = createBatchLabel(files.length);
    const createdAt = new Date().toISOString();
    const initialItems = createBatchItems(files);

    batchCancelledRef.current = false;
    setError(null);
    setIsUploading(true);
    setBatchQueue(initialItems);
    setCurrentBatchIndex(0);
    upsertBatchSnapshot(batchId, label, createdAt, initialItems);

    const workingItems = [...initialItems];

    for (const [index, file] of files.entries()) {
      if (batchCancelledRef.current) {
        break;
      }

      setCurrentBatchIndex(index);
      setUploadPhase("validating");
      setUploadProgress(0);
      setUploadStats({
        loaded: 0,
        total: file.size,
        percentage: 0,
      });

      const updateItem = (updater: (current: BatchUploadItemRecord) => BatchUploadItemRecord) => {
        const nextItem = updater(workingItems[index]);
        workingItems[index] = nextItem;
        replaceQueueItem(index, () => nextItem);
        upsertBatchSnapshot(batchId, label, createdAt, [...workingItems]);
      };

      updateItem((current) => ({
        ...current,
        status: "uploading",
        uploadPhase: "validating",
        uploadProgress: 0,
        error: null,
        updatedAt: new Date().toISOString(),
      }));

      try {
        const uploadTask = createJob(file, {
          onPhaseChange(phase) {
            setUploadPhase(phase);
            updateItem((current) => ({
              ...current,
              uploadPhase: phase,
              uploadProgress: phase === "processing" ? 100 : current.uploadProgress,
              updatedAt: new Date().toISOString(),
            }));
          },
          onUploadProgress(progress) {
            setUploadProgress(progress.percentage);
            setUploadStats(progress);
            updateItem((current) => ({
              ...current,
              uploadProgress: progress.percentage,
              updatedAt: new Date().toISOString(),
            }));
          },
        });
        activeUploadCancelRef.current = uploadTask.cancel;
        const job = await uploadTask.promise;
        updateItem((current) => ({
          ...current,
          jobId: job.jobId,
          status: "processing",
          uploadPhase: "complete",
          uploadProgress: 100,
          updatedAt: new Date().toISOString(),
        }));
      } catch (uploadError) {
        const resolvedError =
          uploadError instanceof ApiError
            ? uploadError
            : new ApiError({ code: "request_failed", message: "Upload failed.", retryable: false });

        updateItem((current) => ({
          ...current,
          status: batchCancelledRef.current ? "cancelled" : "failed",
          error: resolvedError.message,
          updatedAt: new Date().toISOString(),
        }));

        if (batchCancelledRef.current) {
          break;
        }
      } finally {
        activeUploadCancelRef.current = null;
      }
    }

    if (batchCancelledRef.current) {
      for (let index = 0; index < workingItems.length; index += 1) {
        if (workingItems[index].status === "queued" || workingItems[index].status === "uploading") {
          const nextItem = {
            ...workingItems[index],
            status: "cancelled" as const,
            error: "Queue was cancelled before this source finished uploading.",
            updatedAt: new Date().toISOString(),
          };
          workingItems[index] = nextItem;
        }
      }
      setBatchQueue([...workingItems]);
      upsertBatchSnapshot(batchId, label, createdAt, [...workingItems]);
    }

    resetUploadState();

    if (workingItems.some((item) => item.jobId)) {
      startTransition(() => {
        router.push(`/batches/${batchId}`);
      });
      return;
    }

    setError(
      new ApiError({
        code: "upload_cancelled",
        message: batchCancelledRef.current
          ? "The batch queue was cancelled before any upload reached the processing stage."
          : "The batch queue finished without creating any jobs.",
        retryable: true,
      })
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (selectedFiles.length > 1) {
      await runBatchUpload(selectedFiles);
      return;
    }

    const file = selectedFiles[0];
    if (file) {
      await runSingleUpload(file);
    }
  }

  function handleCancelUpload() {
    batchCancelledRef.current = true;
    activeUploadCancelRef.current?.();
    activeUploadCancelRef.current = null;
    setError(
      new ApiError({
        code: "upload_cancelled",
        message: isBatchMode
          ? "The upload queue was cancelled before every source reached processing."
          : "Upload was cancelled before processing started.",
        retryable: true,
      })
    );
  }

  function handleRetryUpload() {
    if (selectedFiles.length === 0) {
      return;
    }

    void (selectedFiles.length > 1 ? runBatchUpload(selectedFiles) : runSingleUpload(selectedFiles[0]));
  }

  const queueSummary = isBatchMode
    ? `${selectedFiles.length} sources selected`
    : "Use the dropzone below to start a new review job.";

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
                description="Single sources open one persistent workspace. Multi-file queues build a reusable batch review session with cross-job export."
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
                    <span className="rounded-[0.85rem] border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted-strong)]">
                      Queue supported
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
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Large uploads keep one intake flow and can roll into a single batch review session.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="metric-label text-[var(--accent)]">Upload bay</div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{queueSummary}</p>
                    </div>
                    <div className="rounded-[0.85rem] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-medium text-[var(--muted-strong)]">
                      {uploadMode === "multipart" ? "Multipart transfer" : "Direct transfer"}
                    </div>
                  </div>
                </div>

                <UploadDropzone
                  selectedFiles={selectedFiles}
                  isDragging={isDragging}
                  onDragChange={setIsDragging}
                  onSelectFiles={(files) => {
                    setSelectedFiles(files);
                    setError(null);
                    setBatchQueue([]);
                    setIsDragging(false);
                  }}
                />

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
                  <div className="space-y-1 text-sm text-[var(--muted)]">
                    <p>
                      {isUploading
                        ? isBatchMode
                          ? "The queue sends one source at a time, then each job continues processing in the background."
                          : uploadPhase === "validating"
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
                        ? isBatchMode
                          ? "When the queue completes, ClipMine opens a batch review page where every source stays grouped together."
                          : uploadPhase === "processing"
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
                      {isUploading
                        ? isBatchMode
                          ? "Queueing sources"
                          : "Processing"
                        : selectedFiles.length > 1
                          ? `Queue ${selectedFiles.length} videos`
                          : "Upload video"}
                    </Button>
                  </div>
                </div>

                {isUploading && primaryFile ? (
                  <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="metric-label text-[var(--muted)]">
                          {isBatchMode ? "Queue progress" : "Upload progress"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--muted-strong)]">
                          {isBatchMode && activeQueueItem
                            ? `${activeQueueItem.fileName} is ${uploadPhase === "processing" ? "ready for processing" : uploadPhase}.`
                            : uploadPhase === "validating"
                              ? `Validating ${primaryFile.name} before transfer begins.`
                              : uploadPhase === "transferring"
                                ? uploadMode === "multipart"
                                  ? `Streaming ${primaryFile.name} to object storage in resumable parts.`
                                  : `Sending ${primaryFile.name} to the processing API.`
                                : uploadPhase === "finalizing"
                                  ? "Finishing the upload and creating the processing job."
                                  : "Upload finalized. Opening the processing workspace."}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatBytes(uploadStats?.loaded ?? 0)} of {formatBytes(uploadStats?.total ?? primaryFile.size)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[var(--text)]">
                          {isBatchMode ? `${overallQueueProgress}% overall` : `${uploadProgress}%`}
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {isBatchMode
                            ? `${completedQueueCount}/${batchQueue.length} uploaded · ${failedQueueCount} failed`
                            : formatBytes(primaryFile.size)}
                        </div>
                      </div>
                    </div>
                    <ProgressBar value={isBatchMode ? overallQueueProgress : uploadProgress} className="mt-4" />
                    {isBatchMode ? (
                      <div className="mt-4 space-y-2">
                        {batchQueue.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm"
                          >
                            <div>
                              <div className="font-medium text-[var(--text)]">{item.fileName}</div>
                              <div className="mt-1 text-xs text-[var(--muted)]">
                                {item.status === "uploading"
                                  ? `${item.uploadPhase} · ${item.uploadProgress}%`
                                  : item.status === "processing"
                                    ? "Queued on backend"
                                    : item.status === "failed"
                                      ? item.error ?? "Upload failed"
                                      : item.status}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs text-[var(--muted)]">{`0${index + 1}`}</span>
                              <div className="w-24">
                                <ProgressBar value={item.uploadProgress} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </form>

              {error ? (
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <div className="rounded-[1.25rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-200">
                    <div className="flex items-center gap-2 font-medium text-red-100">
                      <AlertCircle className="size-4" />
                      {isBatchMode ? "Queue issue" : "Upload failed"}
                    </div>
                    <p className="mt-2 leading-6">{error.message}</p>
                    {selectedFiles.length > 0 && isRetryableApiError(error) ? (
                      <div className="mt-4">
                        <Button type="button" variant="secondary" size="sm" onClick={handleRetryUpload}>
                          <RotateCcw className="size-4" />
                          {selectedFiles.length > 1 ? "Retry queue" : "Retry upload"}
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

              {selectedFiles.length > 1 && !isUploading ? (
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-[1rem] border border-[var(--line)] bg-white/[0.03] text-[var(--accent)]">
                        <UploadCloud className="size-4" />
                      </div>
                      <div>
                        <div className="metric-label text-[var(--accent)]">Batch review session</div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Queue the selected sources, then move into one batch workspace with per-job results and a combined export threshold.
                        </p>
                      </div>
                    </div>
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
