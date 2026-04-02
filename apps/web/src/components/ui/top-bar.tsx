import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type TopBarItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
};

type TopBarProps = {
  eyebrow: string;
  subtitle: string;
  items: TopBarItem[];
  action?: ReactNode;
  className?: string;
};

export function TopBar({
  eyebrow,
  subtitle,
  items,
  action,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-4 z-30 rounded-[var(--radius-shell)] border border-[var(--line)] bg-[rgba(11,16,23,0.76)] px-4 py-3 backdrop-blur-2xl ring-1 ring-inset ring-white/[0.05] shadow-[var(--shadow-soft)] sm:px-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-[0.9rem] border border-[var(--line)] bg-white/[0.04] font-mono text-xs text-[var(--accent)]">
            CM
          </div>
          <div className="min-w-0">
            <p className="metric-label text-[var(--muted-strong)]">{eyebrow}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          <nav className="flex flex-wrap gap-2 rounded-[1.15rem] border border-[var(--line)] bg-white/[0.03] p-1.5">
            {items.map((item) => {
              const itemClassName = cn(
                "inline-flex items-center rounded-[0.9rem] border px-3 py-2 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                item.active
                  ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-transparent bg-transparent text-[var(--muted-strong)] hover:border-[var(--line)] hover:bg-white/[0.06] hover:text-[var(--text)]"
              );

              if (item.href) {
                return (
                  <Link key={item.label} href={item.href} className={itemClassName}>
                    {item.label}
                  </Link>
                );
              }

              return (
                <button key={item.label} type="button" onClick={item.onClick} className={itemClassName}>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
