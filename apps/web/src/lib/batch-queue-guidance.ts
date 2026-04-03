import { formatUploadEta, isLowConfidenceUploadEta } from "./batch-upload-eta";
import { formatBytes } from "./format";
import type { BatchUploadEtaBasis } from "./batch-upload-eta";
import type { BatchUploadItemRecord } from "./types";

export type BatchQueueGuidanceTone = "accent" | "neutral" | "danger";

export type BatchQueueGuidanceItem = {
  title: string;
  emphasis: string;
  description: string;
  tone: BatchQueueGuidanceTone;
};

type BuildBatchQueueGuidanceOptions = {
  items: BatchUploadItemRecord[];
  activeItemId: string | null;
  queueEtaSeconds: number | null;
  queueEtaBasis: BatchUploadEtaBasis | null;
  queueEtaHistorySampleCount: number | null;
};

export function buildBatchQueueGuidance({
  items,
  activeItemId,
  queueEtaSeconds,
  queueEtaBasis,
  queueEtaHistorySampleCount,
}: BuildBatchQueueGuidanceOptions): BatchQueueGuidanceItem[] {
  if (items.length === 0) {
    return [];
  }

  const activeIndex = activeItemId ? items.findIndex((item) => item.id === activeItemId) : -1;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const queuedItems =
    activeIndex >= 0
      ? items.slice(activeIndex + 1).filter((item) => item.status === "queued")
      : items.filter((item) => item.status === "queued");
  const queuedBytes = queuedItems.reduce((total, item) => total + item.sizeBytes, 0);
  const handoffCount = items.filter((item) => item.status === "processing" || item.status === "ready").length;
  const issueCount = items.filter((item) => item.status === "failed" || item.status === "cancelled").length;
  const sourcePlural = queuedItems.length === 1 ? "source" : "sources";
  const queueEtaLabel = formatUploadEta(queueEtaSeconds);

  const intakeGuidance: BatchQueueGuidanceItem =
    queuedItems.length === 0
      ? {
          title: "Intake runway",
          emphasis: "Final source in intake",
          description:
            queueEtaSeconds !== null
              ? `${activeItem?.fileName ?? "The current source"} is the last intake step. ${queueEtaLabel} remains before the grouped batch workspace can open.`
              : "The current source is the last intake step. Once transfer finalizes, the grouped batch workspace can open.",
          tone: "accent",
        }
      : {
          title: "Intake runway",
          emphasis: `${queuedItems.length} queued · ${formatBytes(queuedBytes)} waiting`,
          description:
            queueEtaSeconds !== null
              ? `${queuedItems.length} more ${sourcePlural} ${queuedItems.length === 1 ? "stays" : "stay"} queued behind ${activeItem?.fileName ?? "the current transfer"}. About ${queueEtaLabel} of intake remains for the rest of the backlog.`
              : `${queuedItems.length} more ${sourcePlural} ${queuedItems.length === 1 ? "stays" : "stay"} queued behind ${activeItem?.fileName ?? "the current transfer"}. ${formatBytes(queuedBytes)} still needs to clear intake after this file.`,
          tone: "accent",
        };

  const reviewGuidance: BatchQueueGuidanceItem =
    handoffCount > 0
      ? {
          title: "Review handoff",
          emphasis: `${handoffCount} source${handoffCount === 1 ? "" : "s"} already in backend`,
          description:
            "Those uploads keep transcribing and scoring while intake continues, so the batch workspace opens with live progress already attached.",
          tone: "neutral",
        }
      : {
          title: "Review handoff",
          emphasis: "Review opens after the first handoff",
          description:
            "As soon as one upload finalizes, ClipMine keeps processing it in the background while the queue advances to the next file.",
          tone: "neutral",
        };

  const estimatorGuidance = buildEstimatorGuidance({
    issueCount,
    queueEtaBasis,
    queueEtaHistorySampleCount,
  });

  return [intakeGuidance, reviewGuidance, estimatorGuidance];
}

function buildEstimatorGuidance({
  issueCount,
  queueEtaBasis,
  queueEtaHistorySampleCount,
}: {
  issueCount: number;
  queueEtaBasis: BatchUploadEtaBasis | null;
  queueEtaHistorySampleCount: number | null;
}): BatchQueueGuidanceItem {
  if (issueCount > 0) {
    return {
      title: "Recovery",
      emphasis: `${issueCount} source${issueCount === 1 ? " needs" : "s need"} follow-up`,
      description:
        "Failed or cancelled sources stay visible in the queue summary, so you can retry them after intake without losing successful uploads.",
      tone: "danger",
    };
  }

  if (!queueEtaBasis) {
    return {
      title: "Estimator",
      emphasis: "ETA waiting for enough signal",
      description:
        "ClipMine starts estimating after the current transfer reaches about 8% progress, 4 MB uploaded, and roughly two seconds of elapsed upload time.",
      tone: "neutral",
    };
  }

  if (isLowConfidenceUploadEta(queueEtaBasis, queueEtaHistorySampleCount)) {
    return {
      title: "Estimator",
      emphasis: "ETA is still low confidence",
      description:
        "The runway currently leans on one completed upload. It should stabilize after the next source finishes transferring.",
      tone: "neutral",
    };
  }

  if (queueEtaBasis === "live") {
    return {
      title: "Estimator",
      emphasis: "ETA is tracking live bandwidth",
      description:
        "The queue estimate updates from the current transfer rate, so it adapts automatically as network conditions change.",
      tone: "neutral",
    };
  }

  if (queueEtaBasis === "history") {
    return {
      title: "Estimator",
      emphasis: `${queueEtaHistorySampleCount ?? 0} completed uploads informing ETA`,
      description:
        "Later sources are being estimated from completed-upload history, which is usually steadier for larger queues.",
      tone: "neutral",
    };
  }

  return {
    title: "Estimator",
    emphasis: "ETA blends live + historical pace",
    description:
      "The active source uses live bytes while the remaining backlog uses completed-upload history for a steadier runway.",
    tone: "neutral",
  };
}
