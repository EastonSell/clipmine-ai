"use client";

import { useState } from "react";

import { AlertCircle, FileArchive, FileJson2, LoaderCircle, PackageOpen } from "lucide-react";

import { downloadClipPackage, isRetryableApiError, ApiError } from "@/lib/api";
import { buttonClassName, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { formatSeconds, formatTokenLabel } from "@/lib/format";
import type { ClipRecord, JobResponse } from "@/lib/types";

type ExportPanelProps = {
  job: JobResponse;
  exportUrl: string;
  disabled: boolean;
  selectedClips: ClipRecord[];
};

export function ExportPanel({ job, exportUrl, disabled, selectedClips }: ExportPanelProps) {
  const [isDownloadingPackage, setIsDownloadingPackage] = useState(false);
  const [packageError, setPackageError] = useState<ApiError | null>(null);

  const recommendationCounts = selectedClips.reduce(
    (totals, clip) => {
      totals[clip.selection_recommendation] += 1;
      return totals;
    },
    { shortlist: 0, review: 0, discard: 0 }
  );
  const selectedDuration = selectedClips.reduce((total, clip) => total + clip.duration, 0);
  const packageTree = buildPackageTree(job.jobId, selectedClips);

  async function handleDownloadPackage() {
    if (selectedClips.length === 0) {
      return;
    }

    setIsDownloadingPackage(true);
    setPackageError(null);
    try {
      const response = await downloadClipPackage(
        job.jobId,
        selectedClips.map((clip) => clip.id)
      );
      const objectUrl = URL.createObjectURL(response.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = response.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (error) {
      setPackageError(
        error instanceof ApiError
          ? error
          : new ApiError({ code: "package_export_failed", message: "The selected package could not be built right now.", retryable: true })
      );
    } finally {
      setIsDownloadingPackage(false);
    }
  }

  if (!job.summary && disabled) {
    return (
      <EmptyState
        eyebrow="Export"
        title="Export becomes available when processing is complete"
        description="The training package and raw JSON export unlock after scoring and timeline generation finish."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card tone="elevated">
        <SectionHeader
          eyebrow="Selected package"
          title="Build a training-ready clip archive"
          description="Export selected clips as trimmed media files plus a linked manifest that preserves clip IDs, timings, scores, and alignment metadata."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMetric label="Selected clips" value={String(selectedClips.length)} />
          <PreviewMetric label="Total duration" value={formatSeconds(selectedDuration)} />
          <PreviewMetric label="Shortlist-ready" value={String(recommendationCounts.shortlist)} />
          <PreviewMetric label="Review / discard" value={`${recommendationCounts.review} / ${recommendationCounts.discard}`} />
        </div>

        {selectedClips.length > 0 ? (
          <>
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">Package structure</div>
                <pre className="mt-4 overflow-auto rounded-[1rem] border border-[var(--line)] bg-[var(--surface-dark)] p-4 text-xs leading-6 text-white/75">
{packageTree}
                </pre>
              </div>

              <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">Manifest linkage</div>
                <div className="mt-4 space-y-3">
                  {selectedClips.slice(0, 4).map((clip, index) => (
                    <div key={clip.id} className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono text-xs text-[var(--accent)]">{buildClipFileName(index + 1, clip.id)}</div>
                        <div className="text-xs text-[var(--muted)]">{clip.id}</div>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[var(--text)]">{clip.text}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {clip.tags.slice(0, 2).map((tag) => (
                          <span
                            key={`${clip.id}-${tag}`}
                            className="rounded-full border border-[var(--line)] bg-white/[0.04] px-2.5 py-1 text-xs text-[var(--muted-strong)]"
                          >
                            {formatTokenLabel(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void handleDownloadPackage()}
                disabled={disabled || isDownloadingPackage}
              >
                {isDownloadingPackage ? <LoaderCircle className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
                {isDownloadingPackage ? "Building package" : "Download selected package"}
              </Button>
              <a
                href={exportUrl}
                className={buttonClassName({
                  variant: disabled ? "secondary" : "secondary",
                  size: "lg",
                  className: disabled ? "pointer-events-none opacity-60" : "",
                })}
                aria-disabled={disabled}
                onClick={(event) => {
                  if (disabled) {
                    event.preventDefault();
                  }
                }}
              >
                <FileJson2 className="size-4" />
                {disabled ? "Export when ready" : "Download export.json"}
              </a>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[1.25rem] border border-dashed border-[var(--line-strong)] bg-white/[0.02] px-5 py-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-[1rem] border border-[var(--line)] bg-white/[0.03] text-[var(--accent)]">
                <PackageOpen className="size-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">No clips selected yet</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Select clips from the ranked list or selected clip panel, then come back here to download a zip package with linked media files and manifest metadata.
                </p>
              </div>
            </div>

            <a
              href={exportUrl}
              className={buttonClassName({
                variant: disabled ? "secondary" : "secondary",
                size: "lg",
                className: disabled ? "mt-5 pointer-events-none opacity-60" : "mt-5",
              })}
              aria-disabled={disabled}
              onClick={(event) => {
                if (disabled) {
                  event.preventDefault();
                }
              }}
            >
              <FileJson2 className="size-4" />
              {disabled ? "Export when ready" : "Download export.json"}
            </a>
          </div>
        )}

        {packageError ? (
          <div className="mt-5 rounded-[1.15rem] border border-red-500/30 bg-[var(--danger-soft)] px-4 py-4 text-sm text-red-200">
            <div className="flex items-center gap-2 font-medium text-red-100">
              <AlertCircle className="size-4" />
              Package export failed
            </div>
            <p className="mt-2 leading-6">{packageError.message}</p>
            <p className="mt-2 text-xs leading-5 text-red-200/80">
              {isRetryableApiError(packageError)
                ? "The package can be retried without changing your current selection."
                : "Adjust the selected clips or refresh the workspace before retrying."}
            </p>
          </div>
        ) : null}
      </Card>

      <Card tone="subtle">
        <SectionHeader
          eyebrow="Raw export"
          title="Full job JSON"
          description="Use the original `export.json` when you need the full ranked job payload rather than a selected training package."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMetric label="Shortlist-ready" value={String(job.processingStats.shortlist_recommended_count)} />
          <PreviewMetric
            label="Deduped / discarded"
            value={`${job.processingStats.deduped_candidate_count} / ${job.processingStats.discarded_candidate_count}`}
          />
          <PreviewMetric label="Timeline bins" value={String(job.processingStats.timeline_bin_count)} />
          <PreviewMetric label="Candidates" value={String(job.processingStats.candidate_clip_count)} />
        </div>

        <details className="mt-6 rounded-[1.2rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-[var(--text)]">
            Schema preview
          </summary>
          <pre className="mt-4 overflow-auto rounded-[1rem] border border-[var(--line)] bg-[var(--surface-dark)] p-5 text-xs leading-6 text-white/75 shadow-[var(--shadow-soft)]">
{JSON.stringify(
  {
    jobId: job.jobId,
    status: job.status,
    sourceVideo: {
      file_name: job.sourceVideo.file_name,
      duration_seconds: job.sourceVideo.duration_seconds,
      size_bytes: job.sourceVideo.size_bytes,
    },
    summary: job.summary,
    processingStats: job.processingStats,
    warnings: job.warnings,
    clips: job.clips.slice(0, 2),
    timeline: job.timeline.slice(0, 4),
  },
  null,
  2
)}
          </pre>
        </details>
      </Card>
    </div>
  );
}

function buildPackageTree(jobId: string, clips: ClipRecord[]) {
  const previewEntries = clips.slice(0, 4).map((clip, index) => `    ${buildClipFileName(index + 1, clip.id)}`);
  const extraCount = clips.length - previewEntries.length;
  const lines = [
    `clipmine-export-${jobId}/`,
    "  manifest.json",
    "  clips/",
    ...previewEntries,
  ];

  if (extraCount > 0) {
    lines.push(`    ... ${extraCount} more clip files`);
  }

  return lines.join("\n");
}

function buildClipFileName(ordinal: number, clipId: string) {
  return `clip_${String(ordinal).padStart(3, "0")}__${clipId}.mp4`;
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}
