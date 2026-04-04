import { open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

const DEFAULT_FILE_SIZE_GB = 1.25;
const DEFAULT_PART_SIZE_MB = 16;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const directBaseUrl = normalizeBaseUrl(args.directBaseUrl ?? "");
  const multipartBaseUrl = normalizeBaseUrl(args.multipartBaseUrl ?? "");
  const outputPath = args.output ? path.resolve(process.cwd(), args.output) : null;
  const sizeGb = Number(args.sizeGb ?? DEFAULT_FILE_SIZE_GB);
  const partSizeMb = Number(args.partSizeMb ?? DEFAULT_PART_SIZE_MB);

  if (!Number.isFinite(sizeGb) || sizeGb <= 1) {
    throw new Error("--size-gb must be greater than 1 so the harness actually exercises the large-file path.");
  }
  if (!Number.isFinite(partSizeMb) || partSizeMb <= 0) {
    throw new Error("--part-size-mb must be a positive number.");
  }
  if (!directBaseUrl && !multipartBaseUrl) {
    throw new Error("Provide --direct-base-url, --multipart-base-url, or both.");
  }

  const fileSizeBytes = Math.round(sizeGb * 1024 * 1024 * 1024);
  const benchmarkFilePath = path.join(
    os.tmpdir(),
    `clipmine-benchmark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp4`
  );

  await createSparseBenchmarkFile(benchmarkFilePath, fileSizeBytes);

  const result = {
    generatedAt: new Date().toISOString(),
    file: {
      path: benchmarkFilePath,
      sizeBytes: fileSizeBytes,
      sizeGb,
    },
    direct: null,
    multipart: null,
  };

  try {
    if (directBaseUrl) {
      result.direct = await benchmarkDirectUpload({
        baseUrl: directBaseUrl,
        filePath: benchmarkFilePath,
        fileSizeBytes,
      });
    }

    if (multipartBaseUrl) {
      result.multipart = await benchmarkMultipartUpload({
        baseUrl: multipartBaseUrl,
        filePath: benchmarkFilePath,
        fileSizeBytes,
        partSizeMb,
      });
    }
  } finally {
    await rm(benchmarkFilePath, { force: true });
  }

  const payload = JSON.stringify(result, null, 2);
  console.log(payload);

  if (outputPath) {
    await writeFile(outputPath, payload, "utf8");
  }
}

async function benchmarkDirectUpload({ baseUrl, filePath, fileSizeBytes }) {
  const responseBodyPath = path.join(os.tmpdir(), `clipmine-direct-response-${Date.now().toString(36)}.json`);
  const startedAt = performance.now();

  try {
    const { stdout, stderr } = await runCommand("curl", [
      "-sS",
      "-X",
      "POST",
      `${baseUrl}/api/jobs`,
      "-F",
      `file=@${filePath};type=video/mp4`,
      "-o",
      responseBodyPath,
      "-w",
      "%{http_code}",
    ]);
    const durationMs = performance.now() - startedAt;
    const responseBody = await safeReadJson(responseBodyPath);
    const httpStatus = Number(stdout.trim());

    if (!Number.isFinite(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`Direct upload failed with status ${stdout.trim() || "unknown"}${stderr ? `: ${stderr}` : ""}`);
    }

    return {
      baseUrl,
      durationMs: round(durationMs),
      throughputMbps: round(bitsPerSecondToMbps(fileSizeBytes, durationMs)),
      response: responseBody,
    };
  } finally {
    await rm(responseBodyPath, { force: true });
  }
}

async function benchmarkMultipartUpload({ baseUrl, filePath, fileSizeBytes, partSizeMb }) {
  const partSizeBytes = partSizeMb * 1024 * 1024;
  const initStartedAt = performance.now();
  const initResponse = await fetchJson(`${baseUrl}/api/uploads/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: path.basename(filePath),
      contentType: "video/mp4",
      sizeBytes: fileSizeBytes,
    }),
  });
  const initDurationMs = performance.now() - initStartedAt;

  const completedParts = [];
  const fileHandle = await open(filePath, "r");
  const uploadStartedAt = performance.now();

  try {
    for (const descriptor of initResponse.parts) {
      const buffer = await readPartBuffer({
        fileHandle,
        fileSizeBytes,
        partSizeBytes: initResponse.partSizeBytes ?? partSizeBytes,
        partNumber: descriptor.partNumber,
      });
      const response = await fetch(descriptor.url, {
        method: "PUT",
        body: buffer,
      });
      if (!response.ok) {
        throw new Error(`Multipart part ${descriptor.partNumber} failed with status ${response.status}.`);
      }

      const etag = response.headers.get("etag") ?? response.headers.get("ETag");
      if (!etag) {
        throw new Error(`Multipart part ${descriptor.partNumber} completed without an ETag header.`);
      }

      completedParts.push({
        partNumber: descriptor.partNumber,
        etag,
      });
    }
  } finally {
    await fileHandle.close();
  }

  const uploadDurationMs = performance.now() - uploadStartedAt;
  const completeStartedAt = performance.now();
  const completeResponse = await fetchJson(`${baseUrl}/api/uploads/${initResponse.uploadSessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parts: completedParts,
    }),
  });
  const completeDurationMs = performance.now() - completeStartedAt;

  return {
    baseUrl,
    initDurationMs: round(initDurationMs),
    uploadDurationMs: round(uploadDurationMs),
    completeDurationMs: round(completeDurationMs),
    totalDurationMs: round(initDurationMs + uploadDurationMs + completeDurationMs),
    throughputMbps: round(bitsPerSecondToMbps(fileSizeBytes, uploadDurationMs)),
    response: completeResponse,
  };
}

async function createSparseBenchmarkFile(filePath, sizeBytes) {
  const fileHandle = await open(filePath, "w");
  try {
    await fileHandle.truncate(sizeBytes);
  } finally {
    await fileHandle.close();
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}: ${text}`);
  }

  return payload;
}

async function readPartBuffer({ fileHandle, fileSizeBytes, partSizeBytes, partNumber }) {
  const start = (partNumber - 1) * partSizeBytes;
  const length = Math.max(0, Math.min(partSizeBytes, fileSizeBytes - start));
  const buffer = Buffer.alloc(length);
  await fileHandle.read(buffer, 0, length, start);
  return buffer;
}

async function safeReadJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return content ? JSON.parse(content) : null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/$/, "");
}

function bitsPerSecondToMbps(sizeBytes, durationMs) {
  if (durationMs <= 0) {
    return 0;
  }

  return (sizeBytes * 8) / (durationMs / 1000) / 1_000_000;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

await main();
