import { BatchWorkspace } from "@/components/batch/batch-workspace";

type BatchPageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function BatchPage({ params }: BatchPageProps) {
  const { batchId } = await params;

  return <BatchWorkspace batchId={batchId} />;
}
