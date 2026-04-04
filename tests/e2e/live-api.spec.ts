import { expect, test } from "@playwright/test";

test("browser can reach the local api health endpoint without mocked routes", async ({ page }) => {
  await page.goto("/");

  const health = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8000/api/health", {
      headers: {
        Accept: "application/json",
      },
    });

    return {
      status: response.status,
      payload: (await response.json()) as {
        status: string;
        checks: Record<string, boolean>;
        queueDepth: number;
        activeWorkers: number;
      },
    };
  });

  expect(health.status).toBe(200);
  expect(health.payload.status).toBe("ok");
  expect(health.payload.checks).toHaveProperty("storageWritable", true);
  expect(health.payload.checks).toHaveProperty("objectStoreReachable");
  expect(typeof health.payload.queueDepth).toBe("number");
  expect(typeof health.payload.activeWorkers).toBe("number");
});
