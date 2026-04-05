import { describe, expect, it } from "vitest";

import {
  buildDefaultPackageExportAssetOptions,
  buildPackageClipFileName,
  getPackageAssetDirectory,
  getPackageMetadataFileName,
} from "./package-export";

describe("package-export", () => {
  it("uses dataset-specific metadata and media naming", () => {
    expect(getPackageMetadataFileName("training-dataset")).toBe("metadata.jsonl");
    expect(getPackageAssetDirectory("training-dataset")).toBe("video");
    expect(buildPackageClipFileName(1, "clip-123", "training-dataset")).toBe("clip_000001.mp4");
  });

  it("disables spectrograms by default for fixed-output presets", () => {
    expect(buildDefaultPackageExportAssetOptions("full-av")).toEqual({ includeSpectrograms: true });
    expect(buildDefaultPackageExportAssetOptions("audio-only")).toEqual({ includeSpectrograms: true });
    expect(buildDefaultPackageExportAssetOptions("metadata-only")).toEqual({ includeSpectrograms: false });
    expect(buildDefaultPackageExportAssetOptions("training-dataset")).toEqual({ includeSpectrograms: false });
  });
});
