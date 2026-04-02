import type { JobResponse } from "@/lib/types";

export type WorkspaceTab = "clips" | "timeline" | "export";

export const phaseCopy: Record<JobResponse["progressPhase"], string> = {
  queued: "Queued",
  extracting_audio: "Extracting audio",
  transcribing: "Transcribing",
  segmenting: "Segmenting",
  scoring: "Scoring",
  ready: "Ready",
  failed: "Failed",
};

export const phaseSteps: Array<{ id: JobResponse["progressPhase"]; label: string }> = [
  { id: "queued", label: "Queued" },
  { id: "extracting_audio", label: "Audio" },
  { id: "transcribing", label: "Transcript" },
  { id: "segmenting", label: "Clips" },
  { id: "scoring", label: "Scores" },
  { id: "ready", label: "Ready" },
];

export const workspaceTabs: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "clips", label: "Best clips" },
  { value: "timeline", label: "Timeline" },
  { value: "export", label: "Export" },
];
