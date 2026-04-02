import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command:
      "env -u FORCE_COLOR -u NO_COLOR NEXT_PUBLIC_UPLOAD_MODE=multipart npm_config_cache=/tmp/clipmine-npm-cache npm run preview:web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
