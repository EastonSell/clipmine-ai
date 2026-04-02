import type { RefObject } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

type SourceVideoPanelProps = {
  videoUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function SourceVideoPanel({ videoUrl, videoRef }: SourceVideoPanelProps) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-[var(--line)] p-5 sm:p-6">
        <SectionHeader
          eyebrow="Source video"
          title="Review the original media"
          description="Use the shared source player for every clip and timeline jump."
        />
      </div>
      <div className="p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-dark)]">
          <video ref={videoRef} controls className="aspect-video w-full" src={videoUrl} />
        </div>
      </div>
    </Card>
  );
}
