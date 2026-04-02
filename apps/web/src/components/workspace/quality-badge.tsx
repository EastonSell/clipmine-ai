import type { ClipRecord, TimelineBin } from "@/lib/types";

import { Badge } from "@/components/ui/badge";

type QualityLabel = ClipRecord["quality_label"] | TimelineBin["quality_label"];

export function QualityBadge({ label }: { label: QualityLabel }) {
  if (label === "Excellent") {
    return <Badge tone="accent">Excellent</Badge>;
  }

  if (label === "Good") {
    return <Badge tone="neutral">Good</Badge>;
  }

  return <Badge tone="danger">Weak</Badge>;
}
