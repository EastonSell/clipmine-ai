import type { ReactNode } from "react";

import { Filter, Pin, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewFilters, ReviewSort } from "@/lib/review-state";

type ReviewToolbarProps = {
  filters: ReviewFilters;
  availableTags: string[];
  visibleCount: number;
  totalCount: number;
  shortlistedCount: number;
  hasActiveFilters: boolean;
  onFiltersChange: (partial: Partial<ReviewFilters>) => void;
  onClear: () => void;
};

const sortOptions: Array<{ value: ReviewSort; label: string }> = [
  { value: "score", label: "Score" },
  { value: "confidence", label: "Confidence" },
  { value: "start", label: "Source order" },
  { value: "duration", label: "Duration" },
];

export function ReviewToolbar({
  filters,
  availableTags,
  visibleCount,
  totalCount,
  shortlistedCount,
  hasActiveFilters,
  onFiltersChange,
  onClear,
}: ReviewToolbarProps) {
  return (
    <Card className="lg:sticky lg:top-28 lg:z-20" padded={false}>
      <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="metric-label text-[var(--muted)]">Review controls</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Narrow the ranked list, reopen shortlisted clips quickly, and keep the active review target in sync.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{visibleCount} visible</Badge>
            <Badge tone="muted">{shortlistedCount} shortlisted</Badge>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
          <Search className="size-4 text-[var(--muted)]" />
          <input
            value={filters.query}
            onChange={(event) => onFiltersChange({ query: event.target.value })}
            placeholder="Search transcript, explanation, or tags"
            className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>
      </div>

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <SelectField
          icon={<Filter className="size-4 text-[var(--muted)]" />}
          label="Quality"
          value={filters.quality}
          onChange={(value) => onFiltersChange({ quality: value as ReviewFilters["quality"] })}
          options={[
            { value: "all", label: "All quality" },
            { value: "Excellent", label: "Excellent" },
            { value: "Good", label: "Good" },
            { value: "Weak", label: "Weak" },
          ]}
        />

        <SelectField
          icon={<SlidersHorizontal className="size-4 text-[var(--muted)]" />}
          label="Sort"
          value={filters.sort}
          onChange={(value) => onFiltersChange({ sort: value as ReviewSort })}
          options={sortOptions}
        />

        <SelectField
          icon={<Pin className="size-4 text-[var(--muted)]" />}
          label="Tag"
          value={filters.tag}
          onChange={(value) => onFiltersChange({ tag: value })}
          options={[
            { value: "", label: "All tags" },
            ...availableTags.map((tag) => ({
              value: tag,
              label: formatTagLabel(tag),
            })),
          ]}
        />

        <button
          type="button"
          onClick={() => onFiltersChange({ pinnedOnly: !filters.pinnedOnly })}
          className={[
            "flex min-h-[4.2rem] flex-col justify-between rounded-[1rem] border px-4 py-3 text-left transition duration-200",
            filters.pinnedOnly
              ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
              : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
            <Pin className="size-4" />
            Shortlist only
          </div>
          <div className="text-xs text-[var(--muted)]">
            {filters.pinnedOnly ? "Showing only pinned clips" : "Include all ranked clips"}
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4 text-sm text-[var(--muted)] sm:px-6">
        <span>
          {visibleCount} of {totalCount} clips shown
        </span>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function SelectField({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="rounded-[1rem] border border-[var(--line)] bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
        {icon}
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full appearance-none bg-transparent text-sm text-[var(--muted-strong)] outline-none"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value} className="bg-[#0d1218] text-[var(--text)]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatTagLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
