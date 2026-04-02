import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardTone = "default" | "elevated" | "subtle";

const toneClasses: Record<CardTone, string> = {
  default: "bg-[var(--surface)]",
  elevated: "bg-[var(--surface-elevated)] border-[var(--line-strong)]",
  subtle: "bg-[var(--surface-strong)]",
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: CardTone;
  padded?: boolean;
};

export function Card({
  children,
  tone = "default",
  padded = true,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-shell)] border border-[var(--line)] backdrop-blur-xl shadow-[var(--shadow-soft)] ring-1 ring-inset ring-white/[0.04]",
        toneClasses[tone],
        padded && "p-5 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
