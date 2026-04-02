import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardTone = "default" | "elevated" | "subtle";

const toneClasses: Record<CardTone, string> = {
  default: "bg-[var(--surface)]",
  elevated: "bg-[var(--surface-elevated)]",
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
        "rounded-[1.75rem] border border-[var(--line)] shadow-[var(--shadow-soft)]",
        toneClasses[tone],
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
