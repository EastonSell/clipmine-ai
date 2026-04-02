import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12", className)}>
      {children}
    </div>
  );
}
