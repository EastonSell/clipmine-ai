import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "accent" | "neutral" | "muted" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  accent: "border border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent)]",
  neutral: "border border-[var(--line)] bg-white/[0.04] text-[var(--text)]",
  muted: "border border-[var(--line)] bg-white/[0.03] text-[var(--muted-strong)]",
  danger: "border border-red-500/20 bg-[var(--danger-soft)] text-red-300",
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-[0.01em] backdrop-blur-md",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
