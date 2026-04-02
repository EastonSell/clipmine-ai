"use client";

import { LayoutGroup, motion } from "framer-motion";

import { cn } from "@/lib/cn";

type TabOption<T extends string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <LayoutGroup id="tabs">
      <div
        className={cn(
          "inline-flex flex-wrap gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] p-1",
          className
        )}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                active ? "text-[#07131b]" : "text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
