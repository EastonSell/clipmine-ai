import { BatchWorkspace } from "@/components/batch/batch-workspace";
import {
  parseBatchQualityThreshold,
  parseBatchSelectedJobId,
  parseBatchSelectedPreset,
  parseBatchTriageState,
} from "@/lib/batch-focus";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string; scope?: string; job?: string; preset?: string; threshold?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus, scope, job, preset, threshold } = await searchParams;
  const triageState = parseBatchTriageState(focus, scope);
  const initialActiveJobId = parseBatchSelectedJobId(job);
  const initialSelectedPreset = parseBatchSelectedPreset(preset);
  const initialQualityThreshold = parseBatchQualityThreshold(threshold);

  return (
    <BatchWorkspace
      batchId={batchId}
      prioritizeIssues={triageState.prioritizeIssues}
      initialIssuesOnly={triageState.issuesOnly}
      initialActiveJobId={initialActiveJobId}
      initialSelectedPreset={initialSelectedPreset}
      initialQualityThreshold={initialQualityThreshold}
    />
  );
}
