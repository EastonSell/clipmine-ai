import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "accent" | "neutral" | "muted" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  accent: "bg-[var(--accent)] text-[#07131b]",
  neutral: "border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--text)]",
  muted: "border border-[var(--line)] bg-white/5 text-[var(--muted-strong)]",
  danger: "bg-[var(--danger-soft)] text-red-300",
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function Badge({ children, tone = "muted", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
