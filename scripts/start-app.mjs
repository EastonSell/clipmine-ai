import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;
const STARTUP_TIMEOUT_MS = 120_000;
const isWindows = process.platform === "win32";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendPythonPath = isWindows
  ? path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe")
  : path.join(repoRoot, "backend", ".venv", "bin", "python");
const npmCommand = isWindows ? "npm.cmd" : "npm";
const managedChildren = [];
let shuttingDown = false;

async function main() {
  await assertExecutable(backendPythonPath);
  await Promise.all([
    assertPortAvailable(FRONTEND_PORT, "frontend"),
    assertPortAvailable(BACKEND_PORT, "backend"),
  ]);

  console.log(`[start:app] Starting backend on http://127.0.0.1:${BACKEND_PORT}`);
  const backend = spawnManagedProcess("backend", backendPythonPath, [
    "-m",
    "uvicorn",
    "clipmine_api.main:app",
    "--reload",
    "--host",
    "127.0.0.1",
    "--port",
    String(BACKEND_PORT),
  ], {
    cwd: path.join(repoRoot, "backend"),
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  console.log(`[start:app] Starting frontend on ${FRONTEND_URL}`);
  const frontend = spawnManagedProcess("frontend", npmCommand, ["run", "dev", "--workspace", "apps/web"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      npm_config_cache: process.env.npm_config_cache ?? "/tmp/clipmine-npm-cache",
    },
  });

  bindShutdownSignals();

  try {
    await Promise.all([
      waitForUrl(BACKEND_HEALTH_URL, "backend healthcheck"),
      waitForUrl(FRONTEND_URL, "frontend"),
    ]);
  } catch (error) {
    await shutdown(1, error instanceof Error ? error.message : String(error));
    return;
  }

  console.log(`[start:app] App ready at ${FRONTEND_URL}`);
  await openBrowser(FRONTEND_URL);

  await new Promise(() => {});
}

function spawnManagedProcess(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    detached: false,
    stdio: "inherit",
  });
  managedChildren.push(child);

  child.once("error", (error) => {
    void shutdown(1, `Failed to start ${label}: ${error.message}`);
  });

  child.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const suffix = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    void shutdown(code ?? 1, `${label} exited unexpectedly with ${suffix}.`);
  });

  return child;
}

async function shutdown(exitCode, reason = null) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (reason) {
    console.error(`[start:app] ${reason}`);
  }

  await Promise.all(managedChildren.map((child) => stopProcess(child)));
  process.exit(exitCode);
}

function bindShutdownSignals() {
  process.once("exit", () => {
    stopProcessesSync();
  });

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      void shutdown(0);
    });
  }
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }

  await Promise.race([
    onceExit(child),
    delay(3_000).then(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        return;
      }
    }),
  ]);
}

function stopProcessesSync() {
  for (const child of managedChildren) {
    if (!child || child.exitCode !== null || child.killed) {
      continue;
    }

    if (isWindows) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      continue;
    }

    try {
      child.kill("SIGTERM");
    } catch {
      continue;
    }
  }
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
  });
}

async function assertExecutable(filePath) {
  try {
    await access(filePath, isWindows ? constants.F_OK : constants.X_OK);
  } catch {
    throw new Error(
      `Backend virtualenv is missing or incomplete at ${filePath}. Run the backend setup first.`
    );
  }
}

async function assertPortAvailable(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use, so the ${label} server could not start.`));
        return;
      }

      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve());
    });
  });
}

async function waitForUrl(url, label) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the startup timeout is hit.
    }

    await delay(500);
  }

  throw new Error(`${label} did not become ready within ${Math.round(STARTUP_TIMEOUT_MS / 1000)} seconds.`);
}

async function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? { executable: "open", args: [url] }
      : process.platform === "win32"
        ? { executable: "cmd", args: ["/c", "start", "", url] }
        : { executable: "xdg-open", args: [url] };

  await new Promise((resolve) => {
    const opener = spawn(command.executable, command.args, {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
    });
    opener.once("error", () => resolve());
    opener.once("spawn", () => {
      opener.unref();
      resolve();
    });
  });
}

function delay(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

await main().catch(async (error) => {
  await shutdown(1, error instanceof Error ? error.message : String(error));
});
