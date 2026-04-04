import type { PackageExportAssetOptions, PackageExportPreset } from "./types";

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

export type PackageExportIncludeItem = {
  id: "manifest" | "media" | "spectrograms";
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
};

export const PACKAGE_EXPORT_PRESET_OPTIONS: PackageExportPresetOption[] = [
  {
    value: "full-av",
    title: "Full AV package",
    description: "Trim selected clips into mp4 files, keep the linked manifest, and optionally bundle spectrogram companions.",
    accent: "mp4 clips + manifest",
    buttonLabel: "Download selected package",
    batchButtonLabel: "Export full AV package",
    treeLabel: "Video files and manifest",
    listLabel: "Trimmed media files",
  },
  {
    value: "audio-only",
    title: "Audio-only package",
    description: "Export each selected clip as a mono wav segment with the same manifest linkage and optional spectrogram companions.",
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

export function buildDefaultPackageExportAssetOptions(preset: PackageExportPreset): PackageExportAssetOptions {
  return {
    includeSpectrograms: preset !== "metadata-only",
  };
}

export function resolvePackageExportAssetOptions(
  preset: PackageExportPreset,
  options?: Partial<PackageExportAssetOptions>
): PackageExportAssetOptions {
  const defaults = buildDefaultPackageExportAssetOptions(preset);
  if (preset === "metadata-only") {
    return { includeSpectrograms: false };
  }

  return {
    includeSpectrograms: options?.includeSpectrograms ?? defaults.includeSpectrograms,
  };
}

export function getPackageExportIncludeItems(
  preset: PackageExportPreset,
  options?: Partial<PackageExportAssetOptions>
): PackageExportIncludeItem[] {
  const resolvedOptions = resolvePackageExportAssetOptions(preset, options);
  const mediaLabel = preset === "audio-only" ? "Mono wav clip files" : "Trimmed clip media";
  const mediaDescription =
    preset === "audio-only"
      ? "Exports one mono wav per selected clip with stable file naming."
      : "Exports one mp4 per selected clip with stable file naming.";

  return [
    {
      id: "manifest",
      label: "manifest.json",
      description: "Always included so clip timing, scores, tags, and linkage stay intact.",
      checked: true,
      disabled: true,
    },
    {
      id: "media",
      label: mediaLabel,
      description:
        preset === "metadata-only"
          ? "Metadata-only preset skips trimmed media files."
          : mediaDescription,
      checked: preset !== "metadata-only",
      disabled: true,
    },
    {
      id: "spectrograms",
      label: "Spectrogram PNGs",
      description:
        preset === "metadata-only"
          ? "Available on full AV and audio-only presets."
          : "Adds one spectral reference image per selected clip for faster audio review.",
      checked: resolvedOptions.includeSpectrograms,
      disabled: preset === "metadata-only",
    },
  ];
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

export function getPackageSpectrogramDirectory(
  preset: PackageExportPreset,
  options?: Partial<PackageExportAssetOptions>
) {
  return resolvePackageExportAssetOptions(preset, options).includeSpectrograms ? "spectrograms" : null;
}

export function buildPackageSpectrogramFileName(
  ordinal: number,
  clipId: string
) {
  return `clip_${String(ordinal).padStart(3, "0")}__${clipId}.png`;
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
