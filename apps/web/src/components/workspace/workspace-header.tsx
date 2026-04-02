import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes, formatSeconds } from "@/lib/format";
import type { SourceVideo } from "@/lib/types";

type WorkspaceHeaderProps = {
  title: string;
  sourceVideo: SourceVideo;
  language: string | null;
  statusLabel: string;
  navigation?: ReactNode;
};

export function WorkspaceHeader({
  title,
  sourceVideo,
  language,
  statusLabel,
  navigation,
}: WorkspaceHeaderProps) {
  const statusTone =
    statusLabel === "Failed" ? "danger" : statusLabel === "Ready" ? "accent" : "neutral";

  const metadata = [
    { label: "Size", value: formatBytes(sourceVideo.size_bytes) },
    { label: "Duration", value: formatSeconds(sourceVideo.duration_seconds ?? 0) },
    { label: "Language", value: language ? language.toUpperCase() : "Pending" },
    { label: "Source", value: "Original video" },
  ];

  return (
    <Card tone="subtle" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
        <div className="max-w-3xl">
          <p className="metric-label text-[var(--accent)]">Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] sm:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-[0.98rem]">
            Review the source video, ranked clips, timeline, and export inside one persistent session.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <Link href="/" className={buttonClassName({ variant: "secondary" })}>
            Upload another video
          </Link>
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">
        {metadata.map((item) => (
          <div key={item.label} className="bg-[var(--surface)] px-5 py-4">
            <div className="metric-label text-[var(--muted)]">{item.label}</div>
            <div className="mt-2 text-sm font-medium text-[var(--text)]">{item.value}</div>
          </div>
        ))}
      </div>

      {navigation ? (
        <div className="border-t border-[var(--line)] bg-white/[0.02] px-5 py-4 sm:px-6">{navigation}</div>
      ) : null}
    </Card>
  );
}
