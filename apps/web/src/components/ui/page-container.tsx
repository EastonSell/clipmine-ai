import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[96rem] px-5 sm:px-7 md:px-8 lg:px-10 xl:px-14 2xl:px-16",
        className
      )}
    >
      {children}
    </div>
  );
}
