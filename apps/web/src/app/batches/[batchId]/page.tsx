import { BatchWorkspace } from "@/components/batch/batch-workspace";
import { parseBatchSelectedJobId, parseBatchSelectedPreset, parseBatchTriageState } from "@/lib/batch-focus";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string; scope?: string; job?: string; preset?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus, scope, job, preset } = await searchParams;
  const triageState = parseBatchTriageState(focus, scope);
  const initialActiveJobId = parseBatchSelectedJobId(job);
  const initialSelectedPreset = parseBatchSelectedPreset(preset);

  return (
    <BatchWorkspace
      batchId={batchId}
      prioritizeIssues={triageState.prioritizeIssues}
      initialIssuesOnly={triageState.issuesOnly}
      initialActiveJobId={initialActiveJobId}
      initialSelectedPreset={initialSelectedPreset}
    />
  );
}
