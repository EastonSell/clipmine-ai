const batchSourceFiles = new Map<string, File>();

function getBatchSourceKey(batchId: string, itemId: string) {
  return `${batchId}:${itemId}`;
}

export function saveBatchSourceFile(batchId: string, itemId: string, file: File) {
  batchSourceFiles.set(getBatchSourceKey(batchId, itemId), file);
}

export function loadBatchSourceFile(batchId: string, itemId: string) {
  return batchSourceFiles.get(getBatchSourceKey(batchId, itemId)) ?? null;
}

export function removeBatchSourceFile(batchId: string, itemId: string) {
  batchSourceFiles.delete(getBatchSourceKey(batchId, itemId));
}

export function clearBatchSourceFiles(batchId: string) {
  const prefix = `${batchId}:`;
  for (const key of batchSourceFiles.keys()) {
    if (key.startsWith(prefix)) {
      batchSourceFiles.delete(key);
    }
  }
}
