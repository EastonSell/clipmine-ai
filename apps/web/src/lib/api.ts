import type { JobResponse, UploadJobResponse } from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function createJob(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/api/jobs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as UploadJobResponse;
}

export async function getJob(jobId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as JobResponse;
}

async function getErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

