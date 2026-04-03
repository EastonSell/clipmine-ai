import type { PackageExportPreset } from "./types";

export type PackageExportPresetOption = {
  value: PackageExportPreset;
  title: string;
  description: string;
  accent: string;
  buttonLabel: string;
  batchButtonLabel: string;
  treeLabel: string;
  listLabel: string;
};

export const PACKAGE_EXPORT_PRESET_OPTIONS: PackageExportPresetOption[] = [
  {
    value: "full-av",
    title: "Full AV package",
    description: "Trim selected clips into mp4 files plus a linked manifest for training and review handoff.",
    accent: "mp4 clips + manifest",
    buttonLabel: "Download selected package",
    batchButtonLabel: "Export full AV package",
    treeLabel: "Video files and manifest",
    listLabel: "Trimmed media files",
  },
  {
    value: "audio-only",
    title: "Audio-only package",
    description: "Export each selected clip as a mono wav segment while keeping the same manifest linkage.",
    accent: "wav clips + manifest",
    buttonLabel: "Download audio-only package",
    batchButtonLabel: "Export audio-only package",
    treeLabel: "Audio clips and manifest",
    listLabel: "Audio files and manifest",
  },
  {
    value: "metadata-only",
    title: "Metadata-only package",
    description: "Keep the selected clip manifest without bundling media files when downstream tooling already has source access.",
    accent: "manifest only",
    buttonLabel: "Download metadata-only package",
    batchButtonLabel: "Export metadata-only package",
    treeLabel: "Manifest only",
    listLabel: "Manifest-only clip entries",
  },
];

export function getPackageExportPresetOption(preset: PackageExportPreset) {
  return PACKAGE_EXPORT_PRESET_OPTIONS.find((option) => option.value === preset) ?? PACKAGE_EXPORT_PRESET_OPTIONS[0];
}

export function buildJobPackageRootName(jobId: string, preset: PackageExportPreset) {
  return `clipmine-export-${jobId}${getPackageArchiveSuffix(preset)}`;
}

export function buildBatchPackageRootName(batchLabel: string, preset: PackageExportPreset) {
  return `clipmine-batch-export-${slugifyBatchLabel(batchLabel)}${getPackageArchiveSuffix(preset)}`;
}

export function getPackageAssetDirectory(preset: PackageExportPreset) {
  if (preset === "audio-only") {
    return "audio";
  }

  if (preset === "metadata-only") {
    return null;
  }

  return "clips";
}

export function buildPackageClipFileName(ordinal: number, clipId: string, preset: PackageExportPreset) {
  if (preset === "metadata-only") {
    return null;
  }

  const extension = preset === "audio-only" ? "wav" : "mp4";
  return `clip_${String(ordinal).padStart(3, "0")}__${clipId}.${extension}`;
}

function getPackageArchiveSuffix(preset: PackageExportPreset) {
  if (preset === "audio-only") {
    return "-audio";
  }

  if (preset === "metadata-only") {
    return "-metadata";
  }

  return "";
}

function slugifyBatchLabel(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "batch";
}
