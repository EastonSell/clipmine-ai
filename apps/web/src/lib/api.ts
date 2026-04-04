import type {
  ApiErrorDetail,
  BatchPackageExportWarningSummary,
  BatchPackageJobSelection,
  JobResponse,
  PackageExportPreset,
  UploadInitResponse,
  UploadJobResponse,
  UploadMode,
  UploadPhase,
  UploadProgress,
} from "./types";
import {
  doesMultipartUploadCheckpointMatchFile,
  getMultipartUploadCheckpointId,
  loadMultipartUploadCheckpoint,
  removeMultipartUploadCheckpoint,
  saveMultipartUploadCheckpoint,
  type MultipartUploadCheckpointPart,
  type MultipartUploadCheckpointScope,
} from "./multipart-upload-checkpoints";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const SAME_ORIGIN_API_BASE_URL = "";
const LOOPBACK_API_BASE_URLS: Record<string, string[]> = {
  localhost: ["http://localhost:8000", "http://127.0.0.1:8000"],
  "127.0.0.1": ["http://127.0.0.1:8000", "http://localhost:8000"],
};
const DEFAULT_UPLOAD_MODE: UploadMode = "direct";
const MULTIPART_CONCURRENCY = 3;
const MULTIPART_RETRY_LIMIT = 3;
const BATCH_EXPORT_WARNING_SUMMARY_HEADER = "x-clipmine-batch-export-summary";
let lastSuccessfulApiBaseUrl: string | null = null;
const API_ERROR_MESSAGES: Record<string, string> = {
  unsupported_file_type: "Only .mp4 and .mov files are supported.",
  file_too_large: "The selected file exceeds the configured upload limit.",
  object_store_unavailable: "Upload storage is unavailable right now. Try again in a moment.",
  upload_session_expired: "The upload session expired before the file finished transferring.",
  upload_complete_failed: "The upload finished transferring, but the backend could not finalize the source file.",
  export_not_ready: "Export becomes available when processing is complete.",
  export_selection_required: "Select at least one clip before downloading a package.",
  invalid_clip_selection: "One or more selected clips could not be found in this job.",
  package_export_failed: "The selected package could not be built right now.",
  batch_package_export_failed: "The combined package could not be built right now.",
  job_not_found: "This workspace could not be found.",
  job_retry_not_allowed: "This source can only be retried after it reaches a failed state.",
  video_not_found: "The source video is no longer available.",
  invalid_request: "The request payload was invalid.",
  network_unreachable:
    "Upload failed. The processing API may be offline, unreachable, or blocked by browser origin settings.",
  upload_cancelled: "Upload was cancelled before processing started.",
  upload_part_failed: "One upload chunk failed. The transfer can be retried.",
  upload_part_missing_etag: "An uploaded chunk could not be verified by storage. Try the upload again.",
  request_failed: "Something went wrong.",
  internal_server_error: "Unexpected server error.",
};

type CreateJobOptions = {
  onPhaseChange?: (phase: UploadPhase) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
  multipartCheckpoint?: MultipartUploadCheckpointScope;
};

type MultipartCompletedPart = {
  partNumber: number;
  etag: string;
};

type ErrorPayload = {
  detail?: string | Partial<ApiErrorDetail> | null;
};

type BlobDownloadResponse = {
  blob: Blob;
  fileName: string;
  batchWarningSummary: BatchPackageExportWarningSummary | null;
};

export type CreateJobTask = {
  promise: Promise<UploadJobResponse>;
  cancel: () => void;
};

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number | null;

  constructor(detail: ApiErrorDetail, status: number | null = null) {
    super(detail.message);
    this.name = "ApiError";
    this.code = detail.code;
    this.retryable = detail.retryable;
    this.status = status;
  }
}

export function getApiBaseUrl() {
  return lastSuccessfulApiBaseUrl ?? getApiBaseUrls()[0];
}

export function resetApiBaseUrlMemory() {
  lastSuccessfulApiBaseUrl = null;
}

export function getUploadMode(): UploadMode {
  return resolveUploadMode(process.env.NEXT_PUBLIC_UPLOAD_MODE);
}

export function resolveUploadMode(value: string | undefined | null): UploadMode {
  return value?.trim().toLowerCase() === "multipart" ? "multipart" : DEFAULT_UPLOAD_MODE;
}

export function isRetryableApiError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.retryable;
}

export function aggregateUploadProgress(loadedValues: Iterable<number>, totalBytes: number): UploadProgress {
  const safeTotal = Math.max(0, totalBytes);
  const loaded = Math.max(
    0,
    Math.min(
      safeTotal,
      Array.from(loadedValues).reduce((sum, value) => sum + Math.max(0, value), 0)
    )
  );
  const percentage = safeTotal === 0 ? 0 : Math.max(0, Math.min(100, Math.round((loaded / safeTotal) * 100)));
  return {
    loaded,
    total: safeTotal,
    percentage,
  };
}

export function createJob(file: File, options: CreateJobOptions = {}): CreateJobTask {
  const baseUrls = getApiBaseUrls();
  const uploadMode = getUploadMode();
  console.info("[ClipMine] Upload starting", {
    fileName: file.name,
    sizeBytes: file.size,
    type: file.type || "unknown",
    uploadMode,
  });

  let lastError: ApiError | null = null;
  let activeCancel: () => void = () => {};
  let cancelled = false;

  const promise = (async () => {
    options.onPhaseChange?.("validating");

    for (const [attemptIndex, baseUrl] of baseUrls.entries()) {
      try {
        options.onUploadProgress?.({ loaded: 0, total: file.size, percentage: 0 });
        const attempt =
          uploadMode === "multipart"
            ? createMultipartJobAtBaseUrl(baseUrl, file, options)
            : createDirectJobAtBaseUrl(baseUrl, file, options);
        activeCancel = attempt.cancel;
        const result = await attempt.promise;
        return result;
      } catch (error) {
        const apiError = toApiError(error);
        lastError = apiError;

        if (cancelled || apiError.code === "upload_cancelled") {
          throw apiError;
        }

        const shouldRetryBaseUrl = attemptIndex < baseUrls.length - 1 && apiError.retryable;
        console.warn("[ClipMine] Upload attempt failed", {
          fileName: file.name,
          baseUrl,
          attempt: attemptIndex + 1,
          willRetry: shouldRetryBaseUrl,
          code: apiError.code,
          message: apiError.message,
        });

        if (!shouldRetryBaseUrl) {
          throw apiError;
        }
      }
    }

    throw lastError ?? new ApiError(buildErrorDetail("request_failed", "Upload failed.", true));
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
  let lastError: ApiError | null = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      return await requestJson<JobResponse>(`${baseUrl}/api/jobs/${jobId}`, {
        cache: "no-store",
      });
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;
      if (!apiError.retryable) {
        throw apiError;
      }
    }
  }

  throw lastError ?? new ApiError(buildErrorDetail("request_failed", "Something went wrong.", true));
}

export async function retryJob(jobId: string) {
  let lastError: ApiError | null = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      return await requestJson<UploadJobResponse>(`${baseUrl}/api/jobs/${jobId}/retry`, {
        method: "POST",
      });
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;
      if (!apiError.retryable) {
        throw apiError;
      }
    }
  }

  throw lastError ?? new ApiError(buildErrorDetail("request_failed", "Something went wrong.", true));
}

export async function downloadClipPackage(
  jobId: string,
  clipIds: string[],
  preset: PackageExportPreset = "full-av"
) {
  let lastError: ApiError | null = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await requestBlob(`${baseUrl}/api/jobs/${jobId}/exports/package`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clipIds,
          preset,
        }),
      });
      return response;
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;
      if (!apiError.retryable) {
        throw apiError;
      }
    }
  }

  throw lastError ?? new ApiError(buildErrorDetail("request_failed", "Something went wrong.", true));
}

export async function downloadBatchClipPackage(
  selections: BatchPackageJobSelection[],
  options: {
    batchLabel?: string;
    preset?: PackageExportPreset;
    qualityThreshold?: number;
  } = {}
) {
  let lastError: ApiError | null = null;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      return await requestBlob(`${baseUrl}/api/exports/batch-package`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selections,
          batchLabel: options.batchLabel,
          preset: options.preset ?? "full-av",
          qualityThreshold: options.qualityThreshold,
        }),
      });
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;
      if (!apiError.retryable) {
        throw apiError;
      }
    }
  }

  throw lastError ?? new ApiError(buildErrorDetail("request_failed", "Something went wrong.", true));
}

function createDirectJobAtBaseUrl(baseUrl: string, file: File, options: CreateJobOptions): CreateJobTask {
  const formData = new FormData();
  formData.append("file", file);
  let xhr: XMLHttpRequest | null = null;

  const promise = new Promise<UploadJobResponse>((resolve, reject) => {
    xhr = new XMLHttpRequest();
    const request = xhr;
    request.open("POST", `${baseUrl}/api/jobs`);
    request.responseType = "text";
    options.onPhaseChange?.("transferring");

    request.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable ? event.total : file.size;
      if (!total) {
        return;
      }

      const progress = aggregateUploadProgress([event.loaded], total);
      console.info("[ClipMine] Upload progress", {
        fileName: file.name,
        baseUrl,
        ...progress,
      });
      options.onUploadProgress?.(progress);
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          options.onPhaseChange?.("finalizing");
          options.onUploadProgress?.({ loaded: file.size, total: file.size, percentage: 100 });
          const payload = JSON.parse(request.responseText) as UploadJobResponse;
          options.onPhaseChange?.("processing");
          recordSuccessfulApiBaseUrl(baseUrl);
          console.info("[ClipMine] Direct upload complete", {
            fileName: file.name,
            baseUrl,
            status: request.status,
            jobId: payload.jobId,
          });
          resolve(payload);
        } catch {
          reject(
            new ApiError(
              buildErrorDetail(
                "request_failed",
                "Upload completed, but the API response could not be read.",
                false
              ),
              request.status
            )
          );
        }
        return;
      }

      reject(parseApiErrorFromText(request.responseText, request.status));
    });

    request.addEventListener("error", () => {
      reject(
        new ApiError(
          buildErrorDetail("network_unreachable", API_ERROR_MESSAGES.network_unreachable, true)
        )
      );
    });

    request.addEventListener("abort", () => {
      reject(new ApiError(buildErrorDetail("upload_cancelled", API_ERROR_MESSAGES.upload_cancelled, true)));
    });

    request.send(formData);
  });

  return {
    promise,
    cancel() {
      console.warn("[ClipMine] Direct upload cancel requested", {
        fileName: file.name,
        baseUrl,
      });
      xhr?.abort();
    },
  };
}

function createMultipartJobAtBaseUrl(baseUrl: string, file: File, options: CreateJobOptions): CreateJobTask {
  const activeXhrs = new Set<XMLHttpRequest>();
  const activeControllers = new Set<AbortController>();
  let cancelled = false;
  let uploadSessionId: string | null = null;
  let sessionClosed = false;
  const checkpointScope = options.multipartCheckpoint ?? null;
  const checkpointId = checkpointScope ? getMultipartUploadCheckpointId(checkpointScope) : null;

  async function abortUploadSession() {
    if (!uploadSessionId || sessionClosed) {
      return;
    }

    sessionClosed = true;
    try {
      await requestJson<void>(`${baseUrl}/api/uploads/${uploadSessionId}`, {
        method: "DELETE",
      });
    } catch (error) {
      const apiError = toApiError(error);
      console.warn("[ClipMine] Upload session abort failed", {
        uploadSessionId,
        code: apiError.code,
        message: apiError.message,
      });
    }
  }

  async function clearCheckpoint() {
    if (!checkpointId) {
      return;
    }

    await removeMultipartUploadCheckpoint(checkpointId);
  }

  async function saveCheckpoint(
    initResponse: UploadInitResponse,
    completedParts: MultipartUploadCheckpointPart[],
    createdAt: string
  ) {
    if (!checkpointId) {
      return;
    }

    await saveMultipartUploadCheckpoint({
      id: checkpointId,
      scope: checkpointScope?.kind ?? "single",
      batchId: checkpointScope?.kind === "batch" ? checkpointScope.batchId : null,
      itemId: checkpointScope?.kind === "batch" ? checkpointScope.itemId : null,
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      lastModified: file.lastModified,
      baseUrl,
      uploadSessionId: initResponse.uploadSessionId,
      jobId: initResponse.jobId,
      partSizeBytes: initResponse.partSizeBytes,
      totalParts: initResponse.parts.length,
      expiresAt: initResponse.expiresAt,
      completedParts,
      createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  async function initializeMultipartUploadSession() {
    const initController = new AbortController();
    activeControllers.add(initController);
    try {
      const initResponse = await requestJson<UploadInitResponse>(`${baseUrl}/api/uploads/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
        signal: initController.signal,
      });
      uploadSessionId = initResponse.uploadSessionId;
      return initResponse;
    } finally {
      activeControllers.delete(initController);
    }
  }

  async function resumeMultipartUploadSession() {
    if (!checkpointId) {
      return null;
    }

    const checkpoint = await loadMultipartUploadCheckpoint(checkpointId);
    if (!checkpoint) {
      return null;
    }
    if (!doesMultipartUploadCheckpointMatchFile(checkpoint, file)) {
      await removeMultipartUploadCheckpoint(checkpointId);
      return null;
    }

    try {
      const resumeResponse = await requestJson<UploadInitResponse>(`${baseUrl}/api/uploads/${checkpoint.uploadSessionId}`, {
        cache: "no-store",
      });
      uploadSessionId = resumeResponse.uploadSessionId;
      return {
        initResponse: resumeResponse,
        completedParts: checkpoint.completedParts,
        createdAt: checkpoint.createdAt,
      };
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code !== "upload_session_expired") {
        throw apiError;
      }

      await removeMultipartUploadCheckpoint(checkpointId);
      return null;
    }
  }

  const promise = (async () => {
    try {
      const resumedSession = await resumeMultipartUploadSession();
      const initResponse = resumedSession?.initResponse ?? (await initializeMultipartUploadSession());
      const createdAt = resumedSession?.createdAt ?? new Date().toISOString();
      options.onPhaseChange?.("transferring");
      await saveCheckpoint(initResponse, resumedSession?.completedParts ?? [], createdAt);

      const completedParts = await uploadMultipartParts({
        file,
        initResponse,
        activeXhrs,
        onUploadProgress: options.onUploadProgress,
        completedParts: resumedSession?.completedParts ?? [],
        onCompletedPartsChange(nextCompletedParts) {
          void saveCheckpoint(initResponse, nextCompletedParts, createdAt);
        },
      });

      if (cancelled) {
        throw new ApiError(buildErrorDetail("upload_cancelled", API_ERROR_MESSAGES.upload_cancelled, true));
      }

      options.onPhaseChange?.("finalizing");
      const completeController = new AbortController();
      activeControllers.add(completeController);
      const payload = await requestJson<UploadJobResponse>(
        `${baseUrl}/api/uploads/${uploadSessionId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parts: completedParts,
          }),
          signal: completeController.signal,
        }
      );
      activeControllers.delete(completeController);
      sessionClosed = true;
      await clearCheckpoint();

      options.onUploadProgress?.({ loaded: file.size, total: file.size, percentage: 100 });
      options.onPhaseChange?.("processing");
      console.info("[ClipMine] Multipart upload complete", {
        fileName: file.name,
        baseUrl,
        jobId: payload.jobId,
        parts: completedParts.length,
      });
      return payload;
    } catch (error) {
      if (cancelled) {
        await clearCheckpoint();
      }
      if (cancelled && uploadSessionId && !sessionClosed) {
        void abortUploadSession();
      }

      throw toApiError(error);
    }
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      activeControllers.forEach((controller) => controller.abort());
      activeXhrs.forEach((xhr) => xhr.abort());
      void abortUploadSession();
      void clearCheckpoint();
    },
  };
}

async function uploadMultipartParts({
  file,
  initResponse,
  activeXhrs,
  onUploadProgress,
  completedParts = [],
  onCompletedPartsChange,
}: {
  file: File;
  initResponse: UploadInitResponse;
  activeXhrs: Set<XMLHttpRequest>;
  onUploadProgress?: (progress: UploadProgress) => void;
  completedParts?: MultipartCompletedPart[];
  onCompletedPartsChange?: (parts: MultipartCompletedPart[]) => void;
}): Promise<MultipartCompletedPart[]> {
  const progressByPart = new Map<number, number>();
  const completedPartMap = new Map<number, MultipartCompletedPart>();
  let nextIndex = 0;

  const emitProgress = () => {
    onUploadProgress?.(aggregateUploadProgress(progressByPart.values(), file.size));
  };

  const normalizedCompletedParts = completedParts
    .filter((part) => part.partNumber >= 1 && part.partNumber <= initResponse.parts.length)
    .toSorted((left, right) => left.partNumber - right.partNumber);

  normalizedCompletedParts.forEach((part) => {
    completedPartMap.set(part.partNumber, part);
    progressByPart.set(
      part.partNumber,
      getMultipartPartSizeBytes({
        fileSizeBytes: file.size,
        partSizeBytes: initResponse.partSizeBytes,
        partNumber: part.partNumber,
      })
    );
  });
  emitProgress();

  async function worker() {
    while (true) {
      const partIndex = nextIndex;
      nextIndex += 1;
      if (partIndex >= initResponse.parts.length) {
        return;
      }

      const descriptor = initResponse.parts[partIndex];
      if (completedPartMap.has(descriptor.partNumber)) {
        continue;
      }
      const start = (descriptor.partNumber - 1) * initResponse.partSizeBytes;
      const end = Math.min(start + initResponse.partSizeBytes, file.size);
      const blob = file.slice(start, end);
      const etag = await uploadPartWithRetries({
        descriptor,
        blob,
        activeXhrs,
        onProgress(loaded) {
          progressByPart.set(descriptor.partNumber, Math.min(loaded, blob.size));
          emitProgress();
        },
        onRetry() {
          progressByPart.set(descriptor.partNumber, 0);
          emitProgress();
        },
      });
      progressByPart.set(descriptor.partNumber, blob.size);
      emitProgress();
      completedPartMap.set(descriptor.partNumber, {
        partNumber: descriptor.partNumber,
        etag,
      });
      onCompletedPartsChange?.(
        Array.from(completedPartMap.values()).toSorted((left, right) => left.partNumber - right.partNumber)
      );
    }
  }

  const workers = Array.from({ length: Math.min(MULTIPART_CONCURRENCY, initResponse.parts.length) }, () => worker());
  await Promise.all(workers);
  return Array.from(completedPartMap.values()).toSorted((left, right) => left.partNumber - right.partNumber);
}

function getMultipartPartSizeBytes({
  fileSizeBytes,
  partSizeBytes,
  partNumber,
}: {
  fileSizeBytes: number;
  partSizeBytes: number;
  partNumber: number;
}) {
  const start = (partNumber - 1) * partSizeBytes;
  const end = Math.min(start + partSizeBytes, fileSizeBytes);
  return Math.max(0, end - start);
}

async function uploadPartWithRetries({
  descriptor,
  blob,
  activeXhrs,
  onProgress,
  onRetry,
}: {
  descriptor: UploadInitResponse["parts"][number];
  blob: Blob;
  activeXhrs: Set<XMLHttpRequest>;
  onProgress: (loaded: number) => void;
  onRetry: () => void;
}) {
  let lastError: ApiError | null = null;

  for (let attempt = 1; attempt <= MULTIPART_RETRY_LIMIT; attempt += 1) {
    try {
      return await uploadPart(descriptor, blob, activeXhrs, onProgress);
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;
      if (!apiError.retryable || attempt === MULTIPART_RETRY_LIMIT || apiError.code === "upload_cancelled") {
        throw apiError;
      }
      onRetry();
    }
  }

  throw lastError ?? new ApiError(buildErrorDetail("upload_part_failed", API_ERROR_MESSAGES.upload_part_failed, true));
}

function uploadPart(
  descriptor: UploadInitResponse["parts"][number],
  blob: Blob,
  activeXhrs: Set<XMLHttpRequest>,
  onProgress: (loaded: number) => void
) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    activeXhrs.add(request);
    request.open("PUT", descriptor.url);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(event.loaded);
    });

    request.addEventListener("load", () => {
      activeXhrs.delete(request);
      if (request.status >= 200 && request.status < 300) {
        const etag = request.getResponseHeader("ETag") ?? request.getResponseHeader("etag");
        if (!etag) {
          reject(
            new ApiError(
              buildErrorDetail(
                "upload_part_missing_etag",
                API_ERROR_MESSAGES.upload_part_missing_etag,
                true
              ),
              request.status
            )
          );
          return;
        }

        resolve(etag);
        return;
      }

      reject(
        new ApiError(
          buildErrorDetail("upload_part_failed", API_ERROR_MESSAGES.upload_part_failed, true),
          request.status
        )
      );
    });

    request.addEventListener("error", () => {
      activeXhrs.delete(request);
      reject(
        new ApiError(
          buildErrorDetail("network_unreachable", API_ERROR_MESSAGES.network_unreachable, true)
        )
      );
    });

    request.addEventListener("abort", () => {
      activeXhrs.delete(request);
      reject(new ApiError(buildErrorDetail("upload_cancelled", API_ERROR_MESSAGES.upload_cancelled, true)));
    });

    request.send(blob);
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw await parseApiErrorFromResponse(response);
    }

    recordSuccessfulApiBaseUrl(extractApiBaseUrl(url));

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isAbortLikeError(error)) {
      throw new ApiError(buildErrorDetail("upload_cancelled", API_ERROR_MESSAGES.upload_cancelled, true));
    }

    throw new ApiError(buildErrorDetail("network_unreachable", API_ERROR_MESSAGES.network_unreachable, true));
  }
}

async function requestBlob(url: string, init?: RequestInit): Promise<BlobDownloadResponse> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw await parseApiErrorFromResponse(response);
    }

    recordSuccessfulApiBaseUrl(extractApiBaseUrl(url));

    return {
      blob: await response.blob(),
      fileName: parseContentDispositionFilename(response.headers.get("content-disposition")) ?? "clipmine-export.zip",
      batchWarningSummary: parseBatchExportWarningSummary(
        response.headers.get(BATCH_EXPORT_WARNING_SUMMARY_HEADER)
      ),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isAbortLikeError(error)) {
      throw new ApiError(buildErrorDetail("upload_cancelled", API_ERROR_MESSAGES.upload_cancelled, true));
    }

    throw new ApiError(buildErrorDetail("network_unreachable", API_ERROR_MESSAGES.network_unreachable, true));
  }
}

async function parseApiErrorFromResponse(response: Response) {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return buildApiError(payload.detail, response.status);
  } catch {
    return new ApiError(
      buildErrorDetail("request_failed", API_ERROR_MESSAGES.request_failed, response.status >= 500),
      response.status
    );
  }
}

function parseApiErrorFromText(responseText: string, status: number) {
  try {
    const payload = JSON.parse(responseText) as ErrorPayload;
    return buildApiError(payload.detail, status);
  } catch {
    return new ApiError(
      buildErrorDetail("request_failed", API_ERROR_MESSAGES.request_failed, status >= 500),
      status
    );
  }
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(
      buildErrorDetail("request_failed", error.message || API_ERROR_MESSAGES.request_failed, false)
    );
  }

  return new ApiError(buildErrorDetail("request_failed", API_ERROR_MESSAGES.request_failed, false));
}

export function buildApiError(detail: ErrorPayload["detail"], status: number) {
  if (typeof detail === "string") {
    return new ApiError(
      buildErrorDetail("request_failed", detail || API_ERROR_MESSAGES.request_failed, status >= 500),
      status
    );
  }

  const code = detail?.code ?? "request_failed";
  const message = detail?.message || API_ERROR_MESSAGES[code] || API_ERROR_MESSAGES.request_failed;
  const retryable = typeof detail?.retryable === "boolean" ? detail.retryable : status >= 500;
  const preferredMessage =
    code === "invalid_clip_selection" ? message : API_ERROR_MESSAGES[code] ?? message;

  return new ApiError(
    buildErrorDetail(code, preferredMessage, retryable),
    status
  );
}

function buildErrorDetail(code: string, message: string, retryable: boolean): ApiErrorDetail {
  return {
    code,
    message,
    retryable,
  };
}

function getApiBaseUrls() {
  const configuredBaseUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (typeof window === "undefined") {
    return configuredBaseUrl ? [configuredBaseUrl] : [DEFAULT_API_BASE_URL];
  }

  const baseUrls = [SAME_ORIGIN_API_BASE_URL];
  if (configuredBaseUrl) {
    baseUrls.push(configuredBaseUrl);
  }

  const loopbackBaseUrls = LOOPBACK_API_BASE_URLS[window.location.hostname];
  if (loopbackBaseUrls) {
    baseUrls.push(...loopbackBaseUrls);
  } else if (!configuredBaseUrl) {
    baseUrls.push(DEFAULT_API_BASE_URL);
  }

  return Array.from(new Set(baseUrls));
}

function recordSuccessfulApiBaseUrl(baseUrl: string | null) {
  if (!baseUrl) {
    return;
  }

  lastSuccessfulApiBaseUrl = baseUrl.replace(/\/$/, "");
}

function extractApiBaseUrl(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function normalizeApiBaseUrl(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/$/, "");
}

function isAbortLikeError(error: unknown) {
  return typeof DOMException !== "undefined" && error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && /abort/i.test(error.name);
}

function parseContentDispositionFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const bareMatch = contentDisposition.match(/filename=([^;]+)/i);
  return bareMatch?.[1]?.trim() ?? null;
}

function parseBatchExportWarningSummary(headerValue: string | null): BatchPackageExportWarningSummary | null {
  if (!headerValue) {
    return null;
  }

  try {
    const normalizedValue = headerValue.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalizedValue.length % 4;
    const paddedValue = padding === 0 ? normalizedValue : `${normalizedValue}${"=".repeat(4 - padding)}`;
    if (typeof globalThis.atob !== "function") {
      return null;
    }
    const decodedValue = globalThis.atob(paddedValue);

    return JSON.parse(decodedValue) as BatchPackageExportWarningSummary;
  } catch {
    return null;
  }
}
