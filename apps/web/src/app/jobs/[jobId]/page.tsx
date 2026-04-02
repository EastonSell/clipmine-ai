import { ResultsWorkspace } from "@/components/workspace/results-workspace";

type JobPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobPage({ params }: JobPageProps) {
  const { jobId } = await params;

  return <ResultsWorkspace jobId={jobId} />;
}
