import { Clock3, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { formatDateTime } from "@/lib/format";
import type { JobResponse } from "@/lib/types";

import { phaseCopy, phaseSteps } from "./constants";

type JobStatusPanelProps = {
  job: JobResponse;
  onRefresh: () => void;
};

export function JobStatusPanel({ job, onRefresh }: JobStatusPanelProps) {
  const activeIndex =
    job.progressPhase === "failed"
      ? phaseSteps.length - 1
      : phaseSteps.findIndex((step) => step.id === job.progressPhase);

  const description =
    job.status === "queued" || job.status === "processing"
      ? "The workspace refreshes automatically while the backend extracts audio, transcribes speech, segments clips, and scores results."
      : job.error ?? "Processing completed and export is available.";

  return (
    <Card>
      <SectionHeader
        eyebrow="Processing"
        title={phaseCopy[job.progressPhase]}
        description={description}
        action={
          <Button variant="secondary" onClick={onRefresh}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        {phaseSteps.map((step, index) => {
          const state =
            job.status === "ready"
              ? "complete"
              : activeIndex > index
                ? "complete"
                : job.progressPhase === step.id
                  ? "current"
                  : "pending";

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={[
                  "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "complete" ? "border-[var(--accent)] bg-[var(--accent)] text-[#07131b]" : "",
                  state === "current" ? "border-[var(--accent)] text-[var(--text)]" : "",
                  state === "pending" ? "border-[var(--line)] text-[var(--muted)]" : "",
                ].join(" ")}
              >
                {index + 1}
              </div>
              <span
                className={state === "pending" ? "text-sm text-[var(--muted)]" : "text-sm text-[var(--text)]"}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
        <Clock3 className="size-4" />
        Updated {formatDateTime(job.updatedAt)}
      </div>
    </Card>
  );
}
