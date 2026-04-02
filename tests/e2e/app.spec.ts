import { expect, test } from "@playwright/test";

import { createMockJob } from "./fixtures";

const recentJobsKey = "clipmine:recent-jobs:v1";

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

test("uploading a valid source opens the workspace and supports shortlist persistence", async ({ page }) => {
  const job = createMockJob({ jobId: "job-ready" });
  const uploadSessionId = "session-ready";

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
        parts: [{ partNumber: 1, url: `https://uploads.example/${uploadSessionId}/part/1` }],
      }),
    });
  });

  await page.route(`https://uploads.example/${uploadSessionId}/part/1`, async (route) => {
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
  await expect(page.getByText("Shortlist")).toBeVisible();

  await page.getByRole("button", { name: /Add to shortlist/i }).click();
  await expect(page.getByRole("button", { name: /Remove from shortlist/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /Remove from shortlist/i })).toBeVisible();

  await page.getByRole("button", { name: /Add more context before the final label\./i }).click();
  await expect(page).toHaveURL(/clip=clip-2/);
  await expect(page.getByText("Boundary messy")).toBeVisible();
  await expect(page.getByText("Speech density")).toBeVisible();
});

test("multipart upload can be cancelled and returns a retryable error state", async ({ page }) => {
  const uploadSessionId = "session-cancel";

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
        parts: [{ partNumber: 1, url: `https://uploads.example/${uploadSessionId}/part/1` }],
      }),
    });
  });

  await page.route(`https://uploads.example/${uploadSessionId}/part/1`, async (route) => {
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
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByText("Upload was cancelled before processing started.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry upload" })).toBeVisible();
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
  await expect(page.getByText("Shortlist-ready region")).toBeVisible();
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
  await expect(page.getByText("Keep the labeling steady across every segment.")).toBeVisible();
  await expect(page.getByText("Add more context before the final label.")).toHaveCount(0);
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
  await expect(page.getByText("clip_001__clip-1.mp4")).toBeVisible();
  await expect(page.getByText("clip_002__clip-2.mp4")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download selected package" }).click();
  await downloadPromise;

  expect(packageRequestBody).toEqual({ clipIds: ["clip-1", "clip-2"] });
  await expect(page.getByText("Full job JSON")).toBeVisible();
});
