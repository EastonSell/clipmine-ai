import type { JobResponse, UploadJobResponse } from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

type CreateJobOptions = {
  onUploadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
};

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function createJob(file: File, options: CreateJobOptions = {}) {
  const formData = new FormData();
  formData.append("file", file);

  return await new Promise<UploadJobResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBaseUrl()}/api/jobs`);
    xhr.responseType = "text";

    xhr.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      if (!total) {
        return;
      }

      const percentage = Math.max(0, Math.min(100, Math.round((event.loaded / total) * 100)));
      options.onUploadProgress?.({
        loaded: event.loaded,
        total,
        percentage,
      });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          options.onUploadProgress?.({
            loaded: file.size,
            total: file.size,
            percentage: 100,
          });
          resolve(JSON.parse(xhr.responseText) as UploadJobResponse);
        } catch {
          reject(new Error("Upload completed, but the API response could not be read."));
        }
        return;
      }

      reject(new Error(getErrorMessageFromText(xhr.responseText)));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled."));
    });

    xhr.send(formData);
  });
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

function getErrorMessageFromText(responseText: string) {
  try {
    const payload = JSON.parse(responseText) as { detail?: string };
    return payload.detail ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}
