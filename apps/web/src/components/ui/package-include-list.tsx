"use client";

import { CheckSquare2, ImageIcon, LockKeyhole, Square } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getPackageExportIncludeItems } from "@/lib/package-export";
import type { PackageExportAssetOptions, PackageExportPreset } from "@/lib/types";

type PackageIncludeListProps = {
  preset: PackageExportPreset;
  options?: Partial<PackageExportAssetOptions>;
  onIncludeSpectrogramsChange?: (nextValue: boolean) => void;
};

export function PackageIncludeList({
  preset,
  options,
  onIncludeSpectrogramsChange,
}: PackageIncludeListProps) {
  const items = getPackageExportIncludeItems(preset, options);

  return (
    <Card tone="subtle" className="p-4 sm:p-5">
      <div>
        <div className="metric-label text-[var(--accent)]">Package contents</div>
        <h3 className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[var(--text)]">Choose what ships in the archive</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          The preset decides the media format. Use the checklist below to confirm what the archive will include before download.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const checked = item.checked;
          const Icon =
            item.id === "spectrograms" ? ImageIcon : item.disabled ? LockKeyhole : checked ? CheckSquare2 : Square;

          return (
            <label
              key={item.id}
              className={[
                "flex items-start gap-3 rounded-[1rem] border px-4 py-4 transition",
                item.disabled
                  ? "border-[var(--line)] bg-white/[0.03]"
                  : "cursor-pointer border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)] hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[0.9rem] border border-[var(--line)] bg-white/[0.04] text-[var(--accent)]">
                <Icon className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text)]">{item.label}</span>
                  {item.disabled ? (
                    <span className="rounded-full border border-[var(--line)] bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      Fixed
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{item.description}</span>
              </span>

              <input
                type="checkbox"
                checked={checked}
                disabled={item.disabled}
                onChange={(event) => {
                  if (item.id === "spectrograms") {
                    onIncludeSpectrogramsChange?.(event.currentTarget.checked);
                  }
                }}
                className="mt-1 size-4 rounded border-[var(--line-strong)] bg-transparent accent-[var(--accent)]"
                style={{ accentColor: "var(--accent)" }}
                aria-label={item.label}
              />
            </label>
          );
        })}
      </div>
    </Card>
  );
}
