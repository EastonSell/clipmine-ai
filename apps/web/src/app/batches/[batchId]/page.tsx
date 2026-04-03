import { BatchWorkspace } from "@/components/batch/batch-workspace";
import {
  parseBatchReadyOnlyScope,
  parseBatchQualityThreshold,
  parseBatchSelectedJobId,
  parseBatchSelectedPreset,
  parseBatchTriageState,
} from "@/lib/batch-focus";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string; scope?: string; queue?: string; job?: string; preset?: string; threshold?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus, scope, queue, job, preset, threshold } = await searchParams;
  const triageState = parseBatchTriageState(focus, scope);
  const initialReadyOnly = parseBatchReadyOnlyScope(queue);
  const initialActiveJobId = parseBatchSelectedJobId(job);
  const initialSelectedPreset = parseBatchSelectedPreset(preset);
  const initialQualityThreshold = parseBatchQualityThreshold(threshold);

  return (
    <BatchWorkspace
      batchId={batchId}
      prioritizeIssues={triageState.prioritizeIssues}
      initialIssuesOnly={triageState.issuesOnly}
      initialReadyOnly={initialReadyOnly}
      initialActiveJobId={initialActiveJobId}
      initialSelectedPreset={initialSelectedPreset}
      initialQualityThreshold={initialQualityThreshold}
    />
  );
}
