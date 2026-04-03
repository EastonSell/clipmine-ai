const batchSourceFiles = new Map<string, File>();
const DATABASE_NAME = "clipmine-batch-source-files";
const DATABASE_VERSION = 1;
const STORE_NAME = "sources";

type BatchSourceFileRecord = {
  key: string;
  batchId: string;
  itemId: string;
  file: Blob;
  fileName: string;
  mimeType: string;
  lastModified: number;
};

function getBatchSourceKey(batchId: string, itemId: string) {
  return `${batchId}:${itemId}`;
}

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

async function openBatchSourceDatabase() {
  const indexedDb = getBrowserIndexedDb();
  if (!indexedDb) {
    return null;
  }

  return await new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => resolve(null));
  });
}

function toStoredFile(record: BatchSourceFileRecord) {
  if (record.file instanceof File) {
    return record.file;
  }

  return new File([record.file], record.fileName, {
    type: record.mimeType,
    lastModified: record.lastModified,
  });
}

export async function saveBatchSourceFile(batchId: string, itemId: string, file: File) {
  const key = getBatchSourceKey(batchId, itemId);
  batchSourceFiles.set(key, file);

  const database = await openBatchSourceDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(
      store.put({
        key,
        batchId,
        itemId,
        file,
        fileName: file.name,
        mimeType: file.type,
        lastModified: file.lastModified,
      } satisfies BatchSourceFileRecord)
    );
    await transactionToPromise(transaction);
  } catch {
    return;
  } finally {
    database.close();
  }
}

export async function loadBatchSourceFile(batchId: string, itemId: string) {
  const key = getBatchSourceKey(batchId, itemId);
  const cachedFile = batchSourceFiles.get(key);
  if (cachedFile) {
    return cachedFile;
  }

  const database = await openBatchSourceDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestToPromise(store.get(key)) as BatchSourceFileRecord | undefined;
    if (!record) {
      return null;
    }

    const file = toStoredFile(record);
    batchSourceFiles.set(key, file);
    return file;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function listBatchSourceFileItemIds(batchId: string) {
  const itemIds = new Set<string>();
  const prefix = `${batchId}:`;

  for (const key of batchSourceFiles.keys()) {
    if (key.startsWith(prefix)) {
      itemIds.add(key.slice(prefix.length));
    }
  }

  const database = await openBatchSourceDatabase();
  if (!database) {
    return [...itemIds];
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve) => {
      const request = store.openCursor();
      request.addEventListener("success", () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const record = cursor.value as BatchSourceFileRecord;
        if (record.batchId === batchId) {
          itemIds.add(record.itemId);
        }
        cursor.continue();
      });
      request.addEventListener("error", () => resolve());
    });
  } finally {
    database.close();
  }

  return [...itemIds];
}

export async function removeBatchSourceFile(batchId: string, itemId: string) {
  const key = getBatchSourceKey(batchId, itemId);
  batchSourceFiles.delete(key);

  const database = await openBatchSourceDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.delete(key));
    await transactionToPromise(transaction);
  } catch {
    return;
  } finally {
    database.close();
  }
}

export async function clearBatchSourceFiles(batchId: string) {
  const prefix = `${batchId}:`;
  for (const key of batchSourceFiles.keys()) {
    if (key.startsWith(prefix)) {
      batchSourceFiles.delete(key);
    }
  }

  const database = await openBatchSourceDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve) => {
      const request = store.openCursor();
      request.addEventListener("success", () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const record = cursor.value as BatchSourceFileRecord;
        if (record.batchId === batchId) {
          cursor.delete();
        }
        cursor.continue();
      });
      request.addEventListener("error", () => resolve());
    });
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
