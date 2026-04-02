import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { formatBytes, formatSeconds } from "@/lib/format";
import type { SourceVideo } from "@/lib/types";

type WorkspaceHeaderProps = {
  title: string;
  sourceVideo: SourceVideo;
  language: string | null;
  statusLabel: string;
};

export function WorkspaceHeader({
  title,
  sourceVideo,
  language,
  statusLabel,
}: WorkspaceHeaderProps) {
  return (
    <Card tone="subtle" className="p-5 sm:p-6">
      <SectionHeader
        eyebrow="Workspace"
        title={title}
        description="Review the source video, ranked clips, and export when processing is complete."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="neutral">{statusLabel}</Badge>
            <Link href="/" className={buttonClassName({ variant: "secondary" })}>
              Upload another video
            </Link>
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
        <span>{formatBytes(sourceVideo.size_bytes)}</span>
        <span>{formatSeconds(sourceVideo.duration_seconds ?? 0)}</span>
        <span>{language ? language.toUpperCase() : "Language pending"}</span>
      </div>
    </Card>
  );
}
