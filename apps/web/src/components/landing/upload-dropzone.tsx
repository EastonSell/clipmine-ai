import { Upload, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

type UploadDropzoneProps = {
  selectedFiles: File[];
  isDragging: boolean;
  onDragChange: (dragging: boolean) => void;
  onSelectFiles: (files: File[]) => void;
};

export function UploadDropzone({
  selectedFiles,
  isDragging,
  onDragChange,
  onSelectFiles,
}: UploadDropzoneProps) {
  const primaryFile = selectedFiles[0] ?? null;
  const hasMultipleFiles = selectedFiles.length > 1;

  return (
    <label
      htmlFor="video-upload"
      className={cn(
        "group relative block cursor-pointer overflow-hidden rounded-[1.45rem] border p-4 transition duration-200",
        isDragging
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--accent)] hover:bg-white/[0.045]"
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragChange(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragChange(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        onDragChange(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onSelectFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,216,247,0.12),transparent_28%)] opacity-70" />
      <div className="app-grid flex min-h-72 flex-col justify-between gap-6 rounded-[1.2rem] border border-dashed border-[var(--line-strong)] bg-[var(--surface-overlay)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-lg">
            <p className="metric-label text-[var(--muted)]">Source video</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              {isDragging ? "Drop the source queue to start" : "Upload one video or queue a batch"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Choose `.mp4` or `.mov` files. ClipMine can open one direct workspace or move a batch into a queued review session with cross-job export.
            </p>
          </div>
          <div className="inline-flex size-14 items-center justify-center rounded-[1rem] border border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <Upload className="size-6" />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card tone="elevated" className="p-4">
            <p className="metric-label text-[var(--muted)]">{hasMultipleFiles ? "Selected sources" : "Selected file"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-[0.9rem] border border-[var(--line)] bg-white/[0.04]">
                <Video className="size-4 text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text)]">
                  {primaryFile
                    ? hasMultipleFiles
                      ? `${selectedFiles.length} queued sources`
                      : primaryFile.name
                    : "No file selected"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {primaryFile
                    ? hasMultipleFiles
                      ? `${selectedFiles
                          .slice(0, 3)
                          .map((file) => file.name)
                          .join(", ")}${selectedFiles.length > 3 ? "…" : ""}`
                      : formatBytes(primaryFile.size)
                    : "Drag and drop or choose files"}
                </p>
              </div>
            </div>
          </Card>

          <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-overlay)] p-4 backdrop-blur-xl">
            <p className="metric-label text-[var(--muted)]">Accepted input</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">.mp4</Badge>
              <Badge tone="neutral">.mov</Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              {hasMultipleFiles ? "Batch uploads run sequentially and collect into one review session." : "One source in, one stable workspace out."}
            </p>
          </div>
        </div>
      </div>

      <input
        id="video-upload"
        type="file"
        multiple
        accept=".mp4,.mov,video/mp4,video/quicktime"
        className="sr-only"
        onChange={(event) => onSelectFiles(Array.from(event.target.files ?? []))}
      />
    </label>
  );
}
