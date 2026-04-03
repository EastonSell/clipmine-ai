import { BatchWorkspace } from "@/components/batch/batch-workspace";
import { parseBatchTriageState } from "@/lib/batch-focus";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string; scope?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus, scope } = await searchParams;
  const triageState = parseBatchTriageState(focus, scope);

  return (
    <BatchWorkspace
      batchId={batchId}
      prioritizeIssues={triageState.prioritizeIssues}
      initialIssuesOnly={triageState.issuesOnly}
    />
  );
}
