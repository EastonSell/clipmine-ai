import type { JobResponse, UploadJobResponse } from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const LOOPBACK_API_BASE_URLS: Record<string, string[]> = {
  localhost: ["http://localhost:8000", "http://127.0.0.1:8000"],
  "127.0.0.1": ["http://127.0.0.1:8000", "http://localhost:8000"],
};

type CreateJobOptions = {
  onUploadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
};

export function getApiBaseUrl() {
  return getApiBaseUrls()[0];
}

export async function createJob(file: File, options: CreateJobOptions = {}) {
  console.info("[ClipMine] Upload starting", {
    fileName: file.name,
    sizeBytes: file.size,
    type: file.type || "unknown",
  });

  let lastError: Error | null = null;
  const baseUrls = getApiBaseUrls();

  for (const [attemptIndex, baseUrl] of baseUrls.entries()) {
    try {
      options.onUploadProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 0,
      });
      return await createJobAtBaseUrl(baseUrl, file, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upload failed.");
      const shouldRetry = attemptIndex < baseUrls.length - 1 && isRetryableUploadError(lastError);
      console.warn("[ClipMine] Upload attempt failed", {
        fileName: file.name,
        baseUrl,
        attempt: attemptIndex + 1,
        willRetry: shouldRetry,
        message: lastError.message,
      });

      if (!shouldRetry) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Upload failed.");
}

export async function getJob(jobId: string) {
  let lastError: Error | null = null;
  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}/api/jobs/${jobId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      return (await response.json()) as JobResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Something went wrong.");
      if (!isRetryableFetchError(lastError)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Something went wrong.");
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

function getApiBaseUrls() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return [configuredBaseUrl.replace(/\/$/, "")];
  }

  if (typeof window !== "undefined") {
    const loopbackBaseUrls = LOOPBACK_API_BASE_URLS[window.location.hostname];
    if (loopbackBaseUrls) {
      return loopbackBaseUrls;
    }
  }

  return [DEFAULT_API_BASE_URL];
}

function createJobAtBaseUrl(baseUrl: string, file: File, options: CreateJobOptions) {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise<UploadJobResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/api/jobs`);
    xhr.responseType = "text";

    xhr.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      if (!total) {
        return;
      }

      const percentage = Math.max(0, Math.min(100, Math.round((event.loaded / total) * 100)));
      console.info("[ClipMine] Upload progress", {
        fileName: file.name,
        baseUrl,
        loaded: event.loaded,
        total,
        percentage,
      });
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
          console.info("[ClipMine] Upload complete", {
            fileName: file.name,
            baseUrl,
            status: xhr.status,
          });
          resolve(JSON.parse(xhr.responseText) as UploadJobResponse);
        } catch {
          console.error("[ClipMine] Upload response parse failed", {
            fileName: file.name,
            baseUrl,
            status: xhr.status,
            responseText: xhr.responseText,
          });
          reject(new Error("Upload completed, but the API response could not be read."));
        }
        return;
      }

      console.error("[ClipMine] Upload request failed", {
        fileName: file.name,
        baseUrl,
        status: xhr.status,
        responseText: xhr.responseText,
      });
      reject(new Error(getErrorMessageFromText(xhr.responseText)));
    });

    xhr.addEventListener("error", () => {
      console.error("[ClipMine] Upload network error", {
        fileName: file.name,
        baseUrl,
      });
      reject(
        new Error(
          "Upload failed. The processing API may be offline or blocked by browser origin settings."
        )
      );
    });

    xhr.addEventListener("abort", () => {
      console.warn("[ClipMine] Upload aborted", {
        fileName: file.name,
        baseUrl,
      });
      reject(new Error("Upload was cancelled."));
    });

    xhr.send(formData);
  });
}

function isRetryableUploadError(error: Error) {
  return /processing API may be offline|networkerror|failed to fetch|load failed/i.test(error.message);
}

function isRetryableFetchError(error: Error) {
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message);
}
