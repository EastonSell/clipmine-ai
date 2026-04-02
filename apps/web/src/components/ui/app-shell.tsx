import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <main className={cn("relative isolate min-h-screen overflow-hidden pb-20", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
        <div className="absolute left-[-10rem] top-24 size-[24rem] rounded-full bg-[var(--accent-soft)] blur-[120px]" />
        <div className="absolute right-[-12rem] top-36 size-[26rem] rounded-full bg-white/[0.05] blur-[140px]" />
        <div className="absolute bottom-[-14rem] left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[150px]" />
        <div className="absolute inset-y-0 left-7 hidden w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_18%,transparent_82%,rgba(255,255,255,0.06))] xl:block" />
        <div className="absolute inset-y-0 right-7 hidden w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_18%,transparent_82%,rgba(255,255,255,0.06))] xl:block" />
      </div>
      <div className="relative z-10">{children}</div>
    </main>
  );
}
