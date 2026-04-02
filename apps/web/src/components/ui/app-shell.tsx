import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return <main className={cn("relative min-h-screen pb-16", className)}>{children}</main>;
}
