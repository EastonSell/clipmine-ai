import { cn } from "@/lib/cn";

type ProgressBarProps = {
  value: number;
  tone?: "accent" | "danger";
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
};

export function ProgressBar({
  value,
  tone = "accent",
  ariaLabel = "Progress",
  className,
  trackClassName,
  barClassName,
}: ProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "h-2.5 overflow-hidden rounded-full border border-[var(--line)] bg-white/[0.05]",
        className,
        trackClassName
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue)}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "accent" ? "bg-[var(--accent)]" : "bg-red-400",
          barClassName
        )}
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}
