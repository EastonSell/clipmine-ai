import { BatchWorkspace } from "@/components/batch/batch-workspace";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ focus?: string }>;
};

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  const { batchId } = await params;
  const { focus } = await searchParams;

  return <BatchWorkspace batchId={batchId} prioritizeIssues={focus === "issues"} />;
}
