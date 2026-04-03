import { expect, test } from "@playwright/test";

import { createMockJob } from "./fixtures";

const recentJobsKey = "clipmine:recent-jobs:v1";
const batchSessionsKey = "clipmine:batches:v1";

function buildMultipartPartUrl(uploadSessionId: string, partNumber: number) {
  return `http://127.0.0.1:3000/__playwright/uploads/${uploadSessionId}/part/${partNumber}`;
}

test("landing page renders recent jobs and validates unsupported uploads", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          jobId: "recent-job",
          fileName: "team-sync.mp4",
          updatedAt: "2026-04-01T10:00:00.000Z",
          clipCount: 6,
          topScore: 92,
          durationSeconds: 132,
          language: "en",
        },
      ])
    );
  }, recentJobsKey);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Reopen recent workspaces" })).toBeVisible();
  await expect(page.getByText("team-sync.mp4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Research workspace" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not-a-video"),
  });
  await page.getByRole("button", { name: "Upload video" }).click();

  await expect(page.getByText("Only .mp4 and .mov files are supported.")).toBeVisible();
  expect(consoleErrors.some((message) => message.includes("same key"))).toBe(false);
});

test("landing page reopens the most recent finished batch session", async ({ page }) => {
  const alpha = createMockJob({
    jobId: "saved-batch-alpha",
    sourceVideo: {
      id: "saved-video-alpha",
      file_name: "alpha.mp4",
      content_type: "video/mp4",
      size_bytes: 12_000_000,
      duration_seconds: 164,
      url: "/api/jobs/saved-batch-alpha/video",
    },
  });
  const beta = createMockJob({
    jobId: "saved-batch-beta",
    sourceVideo: {
      id: "saved-video-beta",
      file_name: "beta.mp4",
      content_type: "video/mp4",
      size_bytes: 10_500_000,
      duration_seconds: 141,
      url: "/api/jobs/saved-batch-beta/video",
    },
  });

  await page.addInitScript(
    ({ batchSessionsKey, session }) => {
      window.localStorage.setItem(batchSessionsKey, JSON.stringify([session]));
    },
    {
      batchSessionsKey,
      session: {
        batchId: "saved-batch",
        label: "2 sources queued",
        createdAt: "2026-04-02T11:50:00.000Z",
        updatedAt: "2026-04-02T12:12:00.000Z",
        qualityThreshold: 84,
        lastCompletionSummary: {
          batchId: "saved-batch",
          label: "2 sources queued",
          finishedAt: "2026-04-02T12:12:00.000Z",
          totalSources: 2,
          readyCount: 2,
          failedCount: 0,
          cancelledCount: 0,
        },
        items: [
          {
            id: "upload-1",
            fileName: "alpha.mp4",
            sizeBytes: 12_000_000,
            jobId: "saved-batch-alpha",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:10:00.000Z",
          },
          {
            id: "upload-2",
            fileName: "beta.mp4",
            sizeBytes: 10_500_000,
            jobId: "saved-batch-beta",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:12:00.000Z",
          },
        ],
      },
    }
  );

  await page.route("**/api/jobs/saved-batch-alpha", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alpha),
    });
  });
  await page.route("**/api/jobs/saved-batch-beta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(beta),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Latest finished batch")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reopen the last batch review session" })).toBeVisible();
  await expect(page.getByText("2 of 2 sources reached the workspace stage.")).toBeVisible();

  await page.getByRole("button", { name: "Open batch workspace" }).click();
  await page.waitForURL("**/batches/saved-batch");
  await expect(page.getByRole("heading", { name: "2 sources queued" })).toBeVisible();
  await expect(page.getByRole("button", { name: /alpha\.mp4 ready/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /beta\.mp4 ready/i })).toBeVisible();
});

test("landing page can dismiss a saved batch shortcut without letting it reappear", async ({ page }) => {
  await page.addInitScript(
    ({ batchSessionsKey, session }) => {
      window.localStorage.setItem(batchSessionsKey, JSON.stringify([session]));
    },
    {
      batchSessionsKey,
      session: {
        batchId: "saved-batch-dismiss",
        label: "2 sources queued",
        createdAt: "2026-04-02T11:50:00.000Z",
        updatedAt: "2026-04-02T12:12:00.000Z",
        qualityThreshold: 84,
        lastCompletionSummary: {
          batchId: "saved-batch-dismiss",
          label: "2 sources queued",
          finishedAt: "2026-04-02T12:12:00.000Z",
          totalSources: 2,
          readyCount: 2,
          failedCount: 0,
          cancelledCount: 0,
        },
        items: [
          {
            id: "upload-1",
            fileName: "alpha.mp4",
            sizeBytes: 12_000_000,
            jobId: "saved-batch-alpha",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:10:00.000Z",
          },
        ],
      },
    }
  );

  await page.goto("/");

  await expect(page.getByText("Latest finished batch")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss shortcut" }).click();
  await expect(page.getByText("Latest finished batch")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Reopen the last batch review session" })).not.toBeVisible();

  await expect
    .poll(async () => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), batchSessionsKey))
    .toBeNull();
});

test("landing page previews failed source names in a saved batch shortcut", async ({ page }) => {
  await page.addInitScript(
    ({ batchSessionsKey, session }) => {
      window.localStorage.setItem(batchSessionsKey, JSON.stringify([session]));
    },
    {
      batchSessionsKey,
      session: {
        batchId: "saved-batch-failures",
        label: "3 sources queued",
        createdAt: "2026-04-02T11:50:00.000Z",
        updatedAt: "2026-04-02T12:12:00.000Z",
        qualityThreshold: 84,
        lastCompletionSummary: {
          batchId: "saved-batch-failures",
          label: "3 sources queued",
          finishedAt: "2026-04-02T12:12:00.000Z",
          totalSources: 3,
          readyCount: 1,
          failedCount: 1,
          cancelledCount: 1,
        },
        items: [
          {
            id: "upload-1",
            fileName: "alpha.mp4",
            sizeBytes: 12_000_000,
            jobId: "saved-batch-alpha",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:10:00.000Z",
          },
          {
            id: "upload-2",
            fileName: "broken-intro.mov",
            sizeBytes: 10_500_000,
            jobId: null,
            status: "failed",
            uploadPhase: "queued",
            uploadProgress: 34,
            error: "Upload failed.",
            updatedAt: "2026-04-02T12:11:00.000Z",
          },
          {
            id: "upload-3",
            fileName: "retake.mp4",
            sizeBytes: 9_500_000,
            jobId: null,
            status: "cancelled",
            uploadPhase: "queued",
            uploadProgress: 0,
            error: "Queue was cancelled before this source finished uploading.",
            updatedAt: "2026-04-02T12:12:00.000Z",
          },
        ],
      },
    }
  );

  await page.goto("/");

  await expect(page.getByText("Latest finished batch")).toBeVisible();
  await expect(page.getByText("1 of 3 sources reached the workspace stage.")).toBeVisible();
  await expect(page.getByText("Failed or cancelled sources")).toBeVisible();
  await expect(page.getByText("broken-intro.mov")).toBeVisible();
  await expect(page.getByText("retake.mp4")).toBeVisible();
});

test("uploading a valid source opens the workspace and supports shortlist persistence", async ({ page }) => {
  const job = createMockJob({ jobId: "job-ready" });
  const uploadSessionId = "session-ready";
  const uploadPartUrl = buildMultipartPartUrl(uploadSessionId, 1);

  await page.route("**/api/uploads/init", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        uploadSessionId,
        jobId: job.jobId,
        fileName: job.sourceVideo.file_name,
        partSizeBytes: 16 * 1024 * 1024,
        expiresAt: "2026-04-02T12:30:00.000Z",
        parts: [{ partNumber: 1, url: uploadPartUrl }],
      }),
    });
  });

  await page.route(uploadPartUrl, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      headers: {
        ETag: '"etag-ready"',
      },
      body: "",
    });
  });

  await page.route(`**/api/uploads/${uploadSessionId}/complete`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: job.jobId,
        status: "queued",
        fileName: job.sourceVideo.file_name,
      }),
    });
  });

  await page.route(`**/api/jobs/${job.jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job),
    });
  });

  await page.route(`**/api/jobs/${job.jobId}/video`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "video/mp4",
      body: "",
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: job.sourceVideo.file_name,
    mimeType: "video/mp4",
    buffer: Buffer.from("fake-mp4-data"),
  });
  await page.getByRole("button", { name: "Upload video" }).click();

  await expect(page.getByText("Upload progress")).toBeVisible();
  await page.waitForURL(`**/jobs/${job.jobId}`);
  await expect(page.getByRole("heading", { name: job.sourceVideo.file_name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ranked by training usefulness" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to shortlist/i })).toBeVisible();

  await page.getByRole("button", { name: /Add to shortlist/i }).click();
  await expect(page.getByRole("button", { name: /Remove from shortlist/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /Remove from shortlist/i })).toBeVisible();

  await page.getByRole("button", { name: /Add more context before the final label\./i }).click();
  await expect(page).toHaveURL(/clip=clip-2/);
  await expect(page.getByText("Boundary Messy", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Speech density", { exact: true }).first()).toBeVisible();
});

test("multipart upload can be cancelled and returns a retryable error state", async ({ page }) => {
  const uploadSessionId = "session-cancel";
  const uploadPartUrl = buildMultipartPartUrl(uploadSessionId, 1);

  await page.route("**/api/uploads/init", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        uploadSessionId,
        jobId: "job-cancel",
        fileName: "cancel-me.mp4",
        partSizeBytes: 16 * 1024 * 1024,
        expiresAt: "2026-04-02T12:30:00.000Z",
        parts: [{ partNumber: 1, url: uploadPartUrl }],
      }),
    });
  });

  await page.route(uploadPartUrl, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.fulfill({
      status: 200,
      headers: {
        ETag: '"etag-cancel"',
      },
      body: "",
    });
  });

  await page.route(`**/api/uploads/${uploadSessionId}`, async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "cancel-me.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(2 * 1024 * 1024, 7),
  });
  await page.getByRole("button", { name: "Upload video" }).click();

  await expect(page.getByText("Upload progress")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(page.getByText("Upload was cancelled before processing started.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry upload" })).toBeVisible();
});

test("batch queue shows current source progress before completion", async ({ page }) => {
  const uploadSessionId = "session-batch-progress";
  const uploadPartUrl = buildMultipartPartUrl(uploadSessionId, 1);

  await page.route("**/api/uploads/init", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        uploadSessionId,
        jobId: "job-batch-progress",
        fileName: "alpha.mp4",
        partSizeBytes: 16 * 1024 * 1024,
        expiresAt: "2026-04-02T12:30:00.000Z",
        parts: [{ partNumber: 1, url: uploadPartUrl }],
      }),
    });
  });

  await page.route(uploadPartUrl, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.fulfill({
      status: 200,
      headers: {
        ETag: '"etag-batch-progress"',
      },
      body: "",
    });
  });

  await page.route(`**/api/uploads/${uploadSessionId}`, async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "alpha.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(2 * 1024 * 1024, 7),
    },
    {
      name: "beta.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(2 * 1024 * 1024, 8),
    },
  ]);
  await page.getByRole("button", { name: "Queue 2 videos" }).click();

  await expect(page.getByText("Queue progress")).toBeVisible();
  await expect(page.getByText("Current source")).toBeVisible();
  await expect(page.getByText("Source 1 of 2")).toBeVisible();
  await expect(page.getByText("Backend ready")).toBeVisible();
  await expect(page.getByText("Failed / cancelled")).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("The batch queue was cancelled before any upload reached the processing stage.")).toBeVisible();
});

test("timeline tab is shareable with query params", async ({ page }) => {
  const job = createMockJob();

  await page.route(`**/api/jobs/${job.jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job),
    });
  });

  await page.goto(`/jobs/${job.jobId}?tab=timeline`);

  await expect(page.getByRole("heading", { name: "Training usefulness across the full video" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best regions" })).toBeVisible();
  await expect(page).toHaveURL(/tab=timeline/);
});

test("export stays disabled while processing is incomplete", async ({ page }) => {
  const job = createMockJob({
    jobId: "job-processing",
    status: "processing",
    progressPhase: "transcribing",
    summary: null,
    clips: [],
    timeline: [],
    warnings: ["Speech extraction is still running."],
  });

  await page.route(`**/api/jobs/${job.jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job),
    });
  });

  await page.goto(`/jobs/${job.jobId}?tab=export`);

  await expect(page.getByText("Export becomes available when processing is complete")).toBeVisible();
  await expect(page.getByText(/training package and raw JSON export unlock/i)).toBeVisible();
});

test("precision signals are filterable in the clips workspace", async ({ page }) => {
  const job = createMockJob();

  await page.route(`**/api/jobs/${job.jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job),
    });
  });

  await page.goto(`/jobs/${job.jobId}?recommendation=shortlist`);

  await expect(page.getByRole("heading", { name: "Ranked by training usefulness" })).toBeVisible();
  await expect(page.getByLabel(/Add Keep the labeling steady across every segment\./i)).toBeVisible();
  await expect(page.getByLabel(/Add Add more context before the final label\./i)).toHaveCount(0);
});

test("selected clips can be batched into a package export", async ({ page }) => {
  const job = createMockJob();
  let packageRequestBody: { clipIds: string[] } | null = null;

  await page.route(`**/api/jobs/${job.jobId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job),
    });
  });

  await page.route(`**/api/jobs/${job.jobId}/exports/package`, async (route) => {
    packageRequestBody = JSON.parse(route.request().postData() ?? "{}") as { clipIds: string[] };
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="clipmine-export-${job.jobId}.zip"`,
      },
      body: Buffer.from("PK\x03\x04"),
    });
  });

  await page.goto(`/jobs/${job.jobId}`);
  await page.getByLabel(/Add Keep the labeling steady across every segment\./i).check();
  await page.getByLabel(/Add Add more context before the final label\./i).check();

  await expect(page.getByText("2 clips ready for export")).toBeVisible();
  await page.getByRole("button", { name: /Open export/i }).click();
  await expect(page.getByRole("heading", { name: "Build a training-ready clip archive" })).toBeVisible();
  await expect(page.getByText("clip_001__clip-1.mp4", { exact: true })).toBeVisible();
  await expect(page.getByText("clip_002__clip-2.mp4", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download selected package" }).click();
  await downloadPromise;

  expect(packageRequestBody).toEqual({ clipIds: ["clip-1", "clip-2"] });
  await expect(page.getByText("Full job JSON")).toBeVisible();
});

test("batch workspace groups jobs and exports thresholded clips", async ({ page }) => {
  const jobAlpha = createMockJob({
    jobId: "job-alpha",
    sourceVideo: {
      id: "video-alpha",
      file_name: "alpha.mp4",
      content_type: "video/mp4",
      size_bytes: 12_000_000,
      duration_seconds: 164,
      url: "/api/jobs/job-alpha/video",
    },
  });
  const jobBeta = createMockJob(
    {
      jobId: "job-beta",
      sourceVideo: {
        id: "video-beta",
        file_name: "beta.mp4",
        content_type: "video/mp4",
        size_bytes: 14_000_000,
        duration_seconds: 201,
        url: "/api/jobs/job-beta/video",
      },
    },
    [
      {
        id: "job-beta-clip-1",
        score: 94,
        text: "Ship the batch package as one archive.",
      },
      {
        id: "job-beta-clip-2",
        score: 83,
        text: "The second clip should fall below the threshold later.",
      },
    ]
  );
  let batchRequestBody: Record<string, unknown> | null = null;

  await page.addInitScript(
    ({ batchSessionsKey, session }) => {
      window.localStorage.setItem(batchSessionsKey, JSON.stringify([session]));
    },
    {
      batchSessionsKey,
      session: {
        batchId: "demo-batch",
        label: "3 sources queued",
        createdAt: "2026-04-02T12:00:00.000Z",
        updatedAt: "2026-04-02T12:10:00.000Z",
        qualityThreshold: 84,
        items: [
          {
            id: "upload-1",
            fileName: "alpha.mp4",
            sizeBytes: 12_000_000,
            jobId: "job-alpha",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:10:00.000Z",
          },
          {
            id: "upload-2",
            fileName: "beta.mp4",
            sizeBytes: 14_000_000,
            jobId: "job-beta",
            status: "ready",
            uploadPhase: "complete",
            uploadProgress: 100,
            error: null,
            updatedAt: "2026-04-02T12:11:00.000Z",
          },
        ],
      },
    }
  );

  await page.route("**/api/jobs/job-alpha", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(jobAlpha),
    });
  });
  await page.route("**/api/jobs/job-beta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(jobBeta),
    });
  });
  await page.route("**/api/exports/batch-package", async (route) => {
    batchRequestBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="clipmine-batch-export-demo.zip"',
      },
      body: Buffer.from("PK\x03\x04"),
    });
  });

  await page.goto("/batches/demo-batch");

  await expect(page.getByRole("heading", { name: "3 sources queued" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top clips across the batch" })).toBeVisible();
  await expect(page.getByRole("button", { name: /alpha\.mp4 ready/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /beta\.mp4 ready/i })).toBeVisible();

  await page.locator('input[type="range"]').fill("90");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export 2 clips/i }).click();
  await downloadPromise;

  expect(batchRequestBody?.qualityThreshold).toBe(90);
  expect(batchRequestBody?.selections).toEqual([
    { jobId: "job-alpha", clipIds: ["clip-1"] },
    { jobId: "job-beta", clipIds: ["job-beta-clip-1"] },
  ]);
});

test("batch workspace retries a failed source without returning home", async ({ page }) => {
  const beta = createMockJob({
    jobId: "job-beta",
    sourceVideo: {
      id: "video-beta",
      file_name: "beta.mp4",
      content_type: "video/mp4",
      size_bytes: 11_000_000,
      duration_seconds: 155,
      url: "/api/jobs/job-beta/video",
    },
  });
  const alphaRetry = createMockJob({
    jobId: "job-alpha-retry",
    sourceVideo: {
      id: "video-alpha-retry",
      file_name: "alpha.mp4",
      content_type: "video/mp4",
      size_bytes: 10_000_000,
      duration_seconds: 140,
      url: "/api/jobs/job-alpha-retry/video",
    },
  });
  const uploadSessions = [
    {
      uploadSessionId: "session-beta-success",
      jobId: "job-beta",
      fileName: "beta.mp4",
      uploadPartUrl: buildMultipartPartUrl("session-beta-success", 1),
    },
    {
      uploadSessionId: "session-alpha-retry",
      jobId: "job-alpha-retry",
      fileName: "alpha.mp4",
      uploadPartUrl: buildMultipartPartUrl("session-alpha-retry", 1),
    },
  ];
  let initCallCount = 0;

  await page.route("**/api/uploads/init", async (route) => {
    if (initCallCount === 0) {
      initCallCount += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            code: "invalid_request",
            message: "Upload init failed.",
            retryable: false,
          },
        }),
      });
      return;
    }

    const payload = uploadSessions[initCallCount - 1];
    initCallCount += 1;

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        uploadSessionId: payload.uploadSessionId,
        jobId: payload.jobId,
        fileName: payload.fileName,
        partSizeBytes: 16 * 1024 * 1024,
        expiresAt: "2026-04-02T12:30:00.000Z",
        parts: [{ partNumber: 1, url: payload.uploadPartUrl }],
      }),
    });
  });
  for (const session of uploadSessions) {
    await page.route(session.uploadPartUrl, async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          ETag: `"etag-${session.uploadSessionId}"`,
        },
        body: "",
      });
    });
  }
  await page.route("**/api/uploads/session-beta-success/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "job-beta",
        status: "queued",
        fileName: "beta.mp4",
      }),
    });
  });
  await page.route("**/api/uploads/session-alpha-retry/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "job-alpha-retry",
        status: "queued",
        fileName: "alpha.mp4",
      }),
    });
  });
  await page.route("**/api/jobs/job-beta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(beta),
    });
  });
  await page.route("**/api/jobs/job-alpha-retry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alphaRetry),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "alpha.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("alpha"),
    },
    {
      name: "beta.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("beta"),
    },
  ]);
  await page.getByRole("button", { name: "Queue 2 videos" }).click();

  await expect(page.getByRole("heading", { name: "Batch review session is ready" })).toBeVisible();
  await expect(page.getByText("1 of 2 sources reached the workspace stage.")).toBeVisible();

  await page.getByRole("button", { name: "Open batch workspace" }).click();
  await page.waitForURL("**/batches/*");
  await expect(page.getByRole("button", { name: "Retry alpha.mp4" })).toBeVisible();

  await page.getByRole("button", { name: "Retry alpha.mp4" }).click();

  await expect(page.getByRole("button", { name: /alpha\.mp4 ready/i })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((storageKey) => {
        const sessions = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        const alphaItem = sessions[0]?.items?.find?.((item: { fileName: string }) => item.fileName === "alpha.mp4");
        return alphaItem?.jobId ?? null;
      }, batchSessionsKey)
    )
    .toBe("job-alpha-retry");
});

test("landing page completes a batch queue and then opens the workspace on demand", async ({ page }) => {
  const alpha = createMockJob({
    jobId: "queued-alpha",
    sourceVideo: {
      id: "queued-alpha",
      file_name: "alpha.mp4",
      content_type: "video/mp4",
      size_bytes: 10_000_000,
      duration_seconds: 140,
      url: "/api/jobs/queued-alpha/video",
    },
  });
  const beta = createMockJob({
    jobId: "queued-beta",
    sourceVideo: {
      id: "queued-beta",
      file_name: "beta.mp4",
      content_type: "video/mp4",
      size_bytes: 11_000_000,
      duration_seconds: 155,
      url: "/api/jobs/queued-beta/video",
    },
  });
  let uploadCount = 0;
  const uploadSessions = [
    {
      uploadSessionId: "session-alpha",
      jobId: alpha.jobId,
      fileName: alpha.sourceVideo.file_name,
      uploadPartUrl: buildMultipartPartUrl("session-alpha", 1),
    },
    {
      uploadSessionId: "session-beta",
      jobId: beta.jobId,
      fileName: beta.sourceVideo.file_name,
      uploadPartUrl: buildMultipartPartUrl("session-beta", 1),
    },
  ];

  await page.route("**/api/uploads/init", async (route) => {
    uploadCount += 1;
    const payload = uploadSessions[uploadCount - 1];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        uploadSessionId: payload.uploadSessionId,
        jobId: payload.jobId,
        fileName: payload.fileName,
        partSizeBytes: 16 * 1024 * 1024,
        expiresAt: "2026-04-02T12:30:00.000Z",
        parts: [{ partNumber: 1, url: payload.uploadPartUrl }],
      }),
    });
  });
  for (const session of uploadSessions) {
    await page.route(session.uploadPartUrl, async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          ETag: `"etag-${session.uploadSessionId}"`,
        },
        body: "",
      });
    });
    await page.route(`**/api/uploads/${session.uploadSessionId}/complete`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: session.jobId,
          status: "queued",
          fileName: session.fileName,
        }),
      });
    });
  }

  await page.route("**/api/jobs/queued-alpha", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alpha),
    });
  });
  await page.route("**/api/jobs/queued-beta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(beta),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "alpha.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("alpha"),
    },
    {
      name: "beta.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("beta"),
    },
  ]);
  await page.getByRole("button", { name: "Queue 2 videos" }).click();

  await expect(page.getByText("Queue complete")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Batch review session is ready" })).toBeVisible();
  await expect(page.getByText("2 of 2 sources reached the workspace stage.")).toBeVisible();
  await expect(page.getByText("Workspace ready")).toBeVisible();

  await page.getByRole("button", { name: "Open batch workspace" }).click();
  await page.waitForURL("**/batches/*");
  await expect(page.getByRole("heading", { name: "2 sources queued" })).toBeVisible();
  await expect(page.getByRole("button", { name: /alpha\.mp4 processing|alpha\.mp4 ready/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /beta\.mp4 processing|beta\.mp4 ready/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top clips across the batch" })).toBeVisible();
});
