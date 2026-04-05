import { createClipMineLauncher, openExternalUrl } from "../desktop/runtime/launcher.mjs";

const launcher = createClipMineLauncher({ mode: "browser-dev" });
let shuttingDown = false;

async function main() {
  bindShutdownSignals();

  try {
    console.log("[start:app] Starting backend on http://127.0.0.1:8000");
    console.log("[start:app] Starting frontend on http://127.0.0.1:3000");
    const { frontendUrl } = await launcher.start();
    console.log(`[start:app] App ready at ${frontendUrl}`);
    await openExternalUrl(frontendUrl);
    await new Promise(() => {});
  } catch (error) {
    await shutdown(1, error instanceof Error ? error.message : String(error));
  }
}

async function shutdown(exitCode, reason = null) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (reason) {
    console.error(`[start:app] ${reason}`);
  }

  await launcher.stop();
  process.exit(exitCode);
}

function bindShutdownSignals() {
  launcher.once("fatal", (error) => {
    void shutdown(1, error.message);
  });

  process.once("exit", () => {
    launcher.stopSync();
  });

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      void shutdown(0);
    });
  }
}

await main();
