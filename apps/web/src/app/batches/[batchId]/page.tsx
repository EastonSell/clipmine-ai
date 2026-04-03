import { BatchWorkspace } from "@/components/batch/batch-workspace";
import { parseBatchSelectedJobId, parseBatchTriageState } from "@/lib/batch-focus";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string; scope?: string; job?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus, scope, job } = await searchParams;
  const triageState = parseBatchTriageState(focus, scope);
  const initialActiveJobId = parseBatchSelectedJobId(job);

  return (
    <BatchWorkspace
      batchId={batchId}
      prioritizeIssues={triageState.prioritizeIssues}
      initialIssuesOnly={triageState.issuesOnly}
      initialActiveJobId={initialActiveJobId}
    />
  );
}
