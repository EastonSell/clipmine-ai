import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/cn";

import { Button } from "./button";
import { Card } from "./card";
import { SectionHeader } from "./section-header";

type ProcessingStep = {
  label: string;
  state: "complete" | "current" | "pending";
};

type ProcessingStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  steps?: ProcessingStep[];
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function ProcessingState({
  eyebrow = "Processing",
  title,
  description,
  steps,
  actionLabel,
  onAction,
  className,
}: ProcessingStateProps) {
  return (
    <Card className={className}>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      {steps?.length ? (
        <div className="mt-6 space-y-3">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                  step.state === "complete" && "border-[var(--accent)] bg-[var(--accent)] text-[#07131b]",
                  step.state === "current" && "border-[var(--accent)] text-[var(--text)]",
                  step.state === "pending" && "border-[var(--line)] text-[var(--muted)]"
                )}
              >
                {step.state === "current" ? <LoaderCircle className="size-3.5 animate-spin" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-sm",
                  step.state === "pending" ? "text-[var(--muted)]" : "text-[var(--text)]"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <div className="mt-6">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </Card>
  );
}
