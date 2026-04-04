export type MultipartUploadCheckpointScope =
  | {
      kind: "single";
    }
  | {
      kind: "batch";
      batchId: string;
      itemId: string;
    };

export type MultipartUploadCheckpointPart = {
  partNumber: number;
  etag: string;
};

export type MultipartUploadCheckpointRecord = {
  id: string;
  scope: MultipartUploadCheckpointScope["kind"];
  batchId: string | null;
  itemId: string | null;
  file: File;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  lastModified: number;
  baseUrl: string;
  uploadSessionId: string;
  jobId: string;
  partSizeBytes: number;
  totalParts: number;
  expiresAt: string;
  completedParts: MultipartUploadCheckpointPart[];
  createdAt: string;
  updatedAt: string;
};

type StoredMultipartUploadCheckpointRecord = Omit<MultipartUploadCheckpointRecord, "file"> & {
  file: Blob;
};

const DATABASE_NAME = "clipmine-multipart-upload-checkpoints";
const DATABASE_VERSION = 1;
const STORE_NAME = "checkpoints";

function getBrowserIndexedDb() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.indexedDB ?? null;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed.")));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")));
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")));
  });
}

async function openMultipartUploadCheckpointDatabase() {
  const indexedDb = getBrowserIndexedDb();
  if (!indexedDb) {
    return null;
  }

  return await new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(null));
  });
}

function toStoredFile(record: StoredMultipartUploadCheckpointRecord) {
  if (record.file instanceof File) {
    return record.file;
  }

  return new File([record.file], record.fileName, {
    type: record.mimeType,
    lastModified: record.lastModified,
  });
}

function toRuntimeRecord(
  record: StoredMultipartUploadCheckpointRecord | null | undefined
): MultipartUploadCheckpointRecord | null {
  if (!record || typeof record.id !== "string" || typeof record.uploadSessionId !== "string") {
    return null;
  }

  return {
    ...record,
    file: toStoredFile(record),
    completedParts: normalizeCompletedParts(record.completedParts),
  };
}

function normalizeCompletedParts(
  parts: MultipartUploadCheckpointPart[] | null | undefined
): MultipartUploadCheckpointPart[] {
  if (!Array.isArray(parts)) {
    return [];
  }

  return Array.from(
    new Map(
      parts
        .filter(
          (part): part is MultipartUploadCheckpointPart =>
            Boolean(part) &&
            Number.isInteger(part.partNumber) &&
            part.partNumber > 0 &&
            typeof part.etag === "string" &&
            part.etag.length > 0
        )
        .map((part) => [part.partNumber, part])
    ).values()
  ).toSorted((left, right) => left.partNumber - right.partNumber);
}

export function getMultipartUploadCheckpointId(scope: MultipartUploadCheckpointScope) {
  return scope.kind === "single" ? "single:active" : `batch:${scope.batchId}:${scope.itemId}`;
}

export function doesMultipartUploadCheckpointMatchFile(
  checkpoint: Pick<MultipartUploadCheckpointRecord, "fileName" | "sizeBytes" | "lastModified">,
  file: File
) {
  return (
    checkpoint.fileName === file.name &&
    checkpoint.sizeBytes === file.size &&
    checkpoint.lastModified === file.lastModified
  );
}

export async function saveMultipartUploadCheckpoint(record: MultipartUploadCheckpointRecord) {
  const database = await openMultipartUploadCheckpointDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(
      store.put({
        ...record,
        completedParts: normalizeCompletedParts(record.completedParts),
      } satisfies StoredMultipartUploadCheckpointRecord)
    );
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadMultipartUploadCheckpoint(checkpointId: string) {
  const database = await openMultipartUploadCheckpointDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = (await requestToPromise(store.get(checkpointId))) as StoredMultipartUploadCheckpointRecord | undefined;
    return toRuntimeRecord(record);
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function listMultipartUploadCheckpoints() {
  const database = await openMultipartUploadCheckpointDatabase();
  if (!database) {
    return [] satisfies MultipartUploadCheckpointRecord[];
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const records = (await requestToPromise(store.getAll())) as StoredMultipartUploadCheckpointRecord[];
    return records
      .map((record) => toRuntimeRecord(record))
      .filter((record): record is MultipartUploadCheckpointRecord => Boolean(record))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [] satisfies MultipartUploadCheckpointRecord[];
  } finally {
    database.close();
  }
}

export async function removeMultipartUploadCheckpoint(checkpointId: string) {
  const database = await openMultipartUploadCheckpointDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.delete(checkpointId));
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
