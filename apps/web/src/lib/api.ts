import type { JobResponse, UploadJobResponse, UploadProgress } from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const LOOPBACK_API_BASE_URLS: Record<string, string[]> = {
  localhost: ["http://localhost:8000", "http://127.0.0.1:8000"],
  "127.0.0.1": ["http://127.0.0.1:8000", "http://localhost:8000"],
};

type CreateJobOptions = {
  onUploadProgress?: (progress: UploadProgress) => void;
  onUploadComplete?: () => void;
};

export type CreateJobTask = {
  promise: Promise<UploadJobResponse>;
  cancel: () => void;
};

export function getApiBaseUrl() {
  return getApiBaseUrls()[0];
}

export function createJob(file: File, options: CreateJobOptions = {}): CreateJobTask {
  console.info("[ClipMine] Upload starting", {
    fileName: file.name,
    sizeBytes: file.size,
    type: file.type || "unknown",
  });

  let lastError: Error | null = null;
  const baseUrls = getApiBaseUrls();
  let activeCancel: () => void = () => {};
  let cancelled = false;

  const promise = (async () => {
    for (const [attemptIndex, baseUrl] of baseUrls.entries()) {
      try {
        options.onUploadProgress?.({
          loaded: 0,
          total: file.size,
          percentage: 0,
        });
        const attempt = createJobAtBaseUrl(baseUrl, file, options);
        activeCancel = attempt.cancel;
        const result = await attempt.promise;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Upload failed.");
        if (cancelled || lastError.message === "Upload was cancelled.") {
          throw lastError;
        }

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
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      activeCancel();
    },
  };
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
    const payload = (await response.json()) as { detail?: string | { message?: string } };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    return payload.detail?.message ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function getErrorMessageFromText(responseText: string) {
  try {
    const payload = JSON.parse(responseText) as { detail?: string | { message?: string } };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    return payload.detail?.message ?? "Something went wrong.";
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

function createJobAtBaseUrl(baseUrl: string, file: File, options: CreateJobOptions): CreateJobTask {
  const formData = new FormData();
  formData.append("file", file);
  let xhr: XMLHttpRequest | null = null;

  const promise = new Promise<UploadJobResponse>((resolve, reject) => {
    xhr = new XMLHttpRequest();
    const request = xhr;
    request.open("POST", `${baseUrl}/api/jobs`);
    request.responseType = "text";

    request.upload.addEventListener("progress", (event) => {
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

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          options.onUploadProgress?.({
            loaded: file.size,
            total: file.size,
            percentage: 100,
          });
          options.onUploadComplete?.();
          console.info("[ClipMine] Upload complete", {
            fileName: file.name,
            baseUrl,
            status: request.status,
          });
          resolve(JSON.parse(request.responseText) as UploadJobResponse);
        } catch {
          console.error("[ClipMine] Upload response parse failed", {
            fileName: file.name,
            baseUrl,
            status: request.status,
            responseText: request.responseText,
          });
          reject(new Error("Upload completed, but the API response could not be read."));
        }
        return;
      }

      console.error("[ClipMine] Upload request failed", {
        fileName: file.name,
        baseUrl,
        status: request.status,
        responseText: request.responseText,
      });
      reject(new Error(getErrorMessageFromText(request.responseText)));
    });

    request.addEventListener("error", () => {
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

    request.addEventListener("abort", () => {
      console.warn("[ClipMine] Upload aborted", {
        fileName: file.name,
        baseUrl,
      });
      reject(new Error("Upload was cancelled."));
    });

    request.send(formData);
  });

  return {
    promise,
    cancel() {
      console.warn("[ClipMine] Upload cancel requested", {
        fileName: file.name,
        baseUrl,
      });
      xhr?.abort();
    },
  };
}

function isRetryableUploadError(error: Error) {
  return /processing API may be offline|networkerror|failed to fetch|load failed/i.test(error.message);
}

function isRetryableFetchError(error: Error) {
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message);
}
