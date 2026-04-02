import { Boxes, CheckCheck, Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatSeconds } from "@/lib/format";

type BulkSelectionBarProps = {
  selectedCount: number;
  selectedDuration: number;
  onOpenExport: () => void;
  onClear: () => void;
};

export function BulkSelectionBar({
  selectedCount,
  selectedDuration,
  onOpenExport,
  onClear,
}: BulkSelectionBarProps) {
  return (
    <Card
      tone="elevated"
      className="sticky top-24 z-20 border-[var(--accent-strong)] bg-[linear-gradient(180deg,rgba(17,24,34,0.96),rgba(12,18,26,0.9))]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 items-center justify-center rounded-[1rem] border border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <CheckCheck className="size-4" />
          </div>
          <div>
            <div className="metric-label text-[var(--accent)]">Selected package</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              {selectedCount} {selectedCount === 1 ? "clip" : "clips"} ready for export
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Build a training package with stable identifiers, linked metadata, and trimmed clip files.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-[1rem] border border-[var(--line)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--muted)]">
            <div className="metric-label text-[var(--muted)]">Duration</div>
            <div className="mt-2 font-medium text-[var(--text)]">{formatSeconds(selectedDuration)}</div>
          </div>
          <Button variant="secondary" onClick={onClear}>
            <X className="size-4" />
            Clear
          </Button>
          <Button variant="primary" onClick={onOpenExport}>
            <Download className="size-4" />
            Open export
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Boxes className="size-4" />
        The package will keep file names and manifest records aligned by clip ID and export order.
      </div>
    </Card>
  );
}
