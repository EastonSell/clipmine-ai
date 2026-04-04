"use client";

import { useMemo, useState } from "react";

import { AlertCircle, FileArchive, FileJson2, Film, LoaderCircle, PackageOpen, Waves } from "lucide-react";

import { downloadClipPackage, isRetryableApiError, ApiError } from "@/lib/api";
import { PackageIncludeList } from "@/components/ui/package-include-list";
import {
  buildDefaultPackageExportAssetOptions,
  buildJobPackageRootName,
  buildPackageClipFileName,
  buildPackageSpectrogramFileName,
  getPackageAssetDirectory,
  getPackageExportPresetOption,
  getPackageSpectrogramDirectory,
  PACKAGE_EXPORT_PRESET_OPTIONS,
  resolvePackageExportAssetOptions,
} from "@/lib/package-export";
import { buttonClassName, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { formatSeconds, formatTokenLabel } from "@/lib/format";
import type { ClipRecord, JobResponse, PackageExportAssetOptions, PackageExportPreset } from "@/lib/types";

type ExportPanelProps = {
  job: JobResponse;
  exportUrl: string;
  disabled: boolean;
  selectedClips: ClipRecord[];
};

export function ExportPanel({ job, exportUrl, disabled, selectedClips }: ExportPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<PackageExportPreset>("full-av");
  const [assetOptions, setAssetOptions] = useState<PackageExportAssetOptions>(
    buildDefaultPackageExportAssetOptions("full-av")
  );
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
  const activePreset = getPackageExportPresetOption(selectedPreset);
  const resolvedAssetOptions = useMemo(
    () => resolvePackageExportAssetOptions(selectedPreset, assetOptions),
    [assetOptions, selectedPreset]
  );
  const packageTree = buildPackageTree(job.jobId, selectedClips, selectedPreset, resolvedAssetOptions);

  async function handleDownloadPackage() {
    if (selectedClips.length === 0) {
      return;
    }

    setIsDownloadingPackage(true);
    setPackageError(null);
    try {
      const response = await downloadClipPackage(
        job.jobId,
        selectedClips.map((clip) => clip.id),
        selectedPreset,
        resolvedAssetOptions
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
          description="Choose how the selected clips leave the workspace, from the default video package to audio-only or manifest-only handoff."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMetric label="Selected clips" value={String(selectedClips.length)} />
          <PreviewMetric label="Total duration" value={formatSeconds(selectedDuration)} />
          <PreviewMetric label="Shortlist-ready" value={String(recommendationCounts.shortlist)} />
          <PreviewMetric label="Review / discard" value={`${recommendationCounts.review} / ${recommendationCounts.discard}`} />
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-3">
          {PACKAGE_EXPORT_PRESET_OPTIONS.map((option) => {
            const isActive = option.value === selectedPreset;
            const Icon = option.value === "full-av" ? Film : option.value === "audio-only" ? Waves : FileJson2;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setSelectedPreset(option.value);
                  setAssetOptions(
                    selectedPreset === "metadata-only"
                      ? buildDefaultPackageExportAssetOptions(option.value)
                      : resolvePackageExportAssetOptions(option.value, assetOptions)
                  );
                  setPackageError(null);
                }}
                className={[
                  "rounded-[1.2rem] border px-4 py-4 text-left transition",
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]"
                    : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[1rem] border border-[var(--line)] bg-white/[0.04] text-[var(--accent)]">
                    <Icon className="size-4" />
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                    {option.accent}
                  </span>
                </div>
                <div className="mt-4 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{option.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{option.description}</p>
              </button>
            );
          })}
        </div>

        {selectedClips.length > 0 ? (
          <>
            <div className="mt-6">
              <PackageIncludeList
                preset={selectedPreset}
                options={resolvedAssetOptions}
                onIncludeSpectrogramsChange={(nextValue) => {
                  setAssetOptions((currentValue) => ({
                    ...currentValue,
                    includeSpectrograms: nextValue,
                  }));
                  setPackageError(null);
                }}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">{activePreset.treeLabel}</div>
                <pre className="mt-4 overflow-auto rounded-[1rem] border border-[var(--line)] bg-[var(--surface-dark)] p-4 text-xs leading-6 text-white/75">
{packageTree}
                </pre>
              </div>

              <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                <div className="metric-label text-[var(--muted)]">{activePreset.listLabel}</div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {selectedPreset === "metadata-only"
                    ? "The manifest keeps clip IDs, timings, scores, tags, and alignment metadata without re-encoding any media."
                    : resolvedAssetOptions.includeSpectrograms
                      ? "Each selected clip keeps a deterministic file name for media and a matching spectrogram companion so downstream review can join every asset back to one clip ID."
                      : "Each selected clip keeps a deterministic file name so downstream tools can join media files back to manifest metadata by clip ID."}
                </p>
                <div className="mt-4 space-y-3">
                  {selectedClips.slice(0, 4).map((clip, index) => {
                    const fileName = buildPackageClipFileName(index + 1, clip.id, selectedPreset);
                    const spectrogramFileName = resolvedAssetOptions.includeSpectrograms
                      ? buildPackageSpectrogramFileName(index + 1, clip.id)
                      : null;
                    return (
                      <div key={clip.id} className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="font-mono text-xs text-[var(--accent)]">{fileName ?? "manifest-only entry"}</div>
                          <div className="text-xs text-[var(--muted)]">{clip.id}</div>
                        </div>
                        {spectrogramFileName ? (
                          <div className="mt-2 font-mono text-xs text-[var(--muted)]">{spectrogramFileName}</div>
                        ) : null}
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
                    );
                  })}
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
                {isDownloadingPackage ? "Building package" : activePreset.buttonLabel}
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
                  Select clips from the ranked list or selected clip panel, then come back here to choose a package preset and download the linked output bundle.
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

function buildPackageTree(
  jobId: string,
  clips: ClipRecord[],
  preset: PackageExportPreset,
  options: PackageExportAssetOptions
) {
  const rootName = buildJobPackageRootName(jobId, preset);
  const folderName = getPackageAssetDirectory(preset);
  const spectrogramFolderName = getPackageSpectrogramDirectory(preset, options);
  const previewEntries = clips
    .slice(0, 4)
    .map((clip, index) => buildPackageClipFileName(index + 1, clip.id, preset))
    .filter((value): value is string => Boolean(value))
    .map((fileName) => `    ${fileName}`);
  const spectrogramEntries = clips
    .slice(0, 4)
    .map((clip, index) => (spectrogramFolderName ? buildPackageSpectrogramFileName(index + 1, clip.id) : null))
    .filter((value): value is string => Boolean(value))
    .map((fileName) => `    ${fileName}`);
  const extraCount = Math.max(0, clips.length - previewEntries.length);
  const extraSpectrogramCount = Math.max(0, clips.length - spectrogramEntries.length);
  const lines = [`${rootName}/`, "  manifest.json"];

  if (folderName && previewEntries.length > 0) {
    lines.push(`  ${folderName}/`, ...previewEntries);
  }

  if (folderName && extraCount > 0) {
    lines.push(`    ... ${extraCount} more ${preset === "audio-only" ? "audio" : "clip"} files`);
  }

  if (spectrogramFolderName && spectrogramEntries.length > 0) {
    lines.push(`  ${spectrogramFolderName}/`, ...spectrogramEntries);
  }

  if (spectrogramFolderName && extraSpectrogramCount > 0) {
    lines.push(`    ... ${extraSpectrogramCount} more spectrogram files`);
  }

  return lines.join("\n");
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--line)] bg-white/[0.04] px-4 py-4">
      <div className="metric-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}
