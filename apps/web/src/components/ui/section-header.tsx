import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 sm:gap-5", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="metric-label text-[var(--accent)]">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.05em] sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-[0.98rem]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
