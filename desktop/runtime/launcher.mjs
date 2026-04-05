import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;
const STARTUP_TIMEOUT_MS = 120_000;
const FRONTEND_MARKER = "ClipMine AI";
const BACKEND_SERVICE_NAME = "ClipMine AI API";
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export class LauncherError extends Error {
  constructor(message) {
    super(message);
    this.name = "LauncherError";
  }
}

export function createClipMineLauncher(options = {}) {
  return new ClipMineLauncher(options);
}

export async function openExternalUrl(url) {
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

class ClipMineLauncher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = resolveLauncherOptions(options);
    this.managedChildren = [];
    this.shuttingDown = false;
    this.stopped = false;
    this.fatalError = null;
  }

  async start() {
    const backend = await this.ensureBackend();
    const frontend = await this.ensureFrontend();
    return {
      frontendUrl: FRONTEND_URL,
      backendHealthUrl: BACKEND_HEALTH_URL,
      backend,
      frontend,
    };
  }

  async stop() {
    if (this.shuttingDown || this.stopped) {
      return;
    }

    this.shuttingDown = true;
    await Promise.all(
      this.managedChildren
        .filter((entry) => entry.owned)
        .map((entry) => stopProcess(entry.child))
    );
    this.stopped = true;
    this.shuttingDown = false;
  }

  stopSync() {
    for (const entry of this.managedChildren) {
      if (!entry.owned || !entry.child || entry.child.exitCode !== null || entry.child.killed) {
        continue;
      }

      if (isWindows) {
        spawnSync("taskkill", ["/pid", String(entry.child.pid), "/t", "/f"], {
          stdio: "ignore",
        });
        continue;
      }

      try {
        entry.child.kill("SIGTERM");
      } catch {
        continue;
      }
    }
  }

  async ensureBackend() {
    return this.ensureService({
      label: "backend",
      port: BACKEND_PORT,
      probe: probeBackend,
      assertStartable: () => assertExecutable(this.options.backend.commandPath, this.options.backend.missingMessage),
      getSpawnConfig: () => ({
        command: this.options.backend.commandPath,
        args: this.options.backend.args,
        spawnOptions: {
          cwd: this.options.backend.cwd,
          env: this.options.backend.env,
        },
      }),
      readinessLabel: "backend healthcheck",
    });
  }

  async ensureFrontend() {
    return this.ensureService({
      label: "frontend",
      port: FRONTEND_PORT,
      probe: probeFrontend,
      assertStartable: async () => {
        if (this.options.frontend.requiredFilePath) {
          await assertReadable(this.options.frontend.requiredFilePath, this.options.frontend.missingMessage);
        }
      },
      getSpawnConfig: () => ({
        command: this.options.frontend.commandPath,
        args: this.options.frontend.args,
        spawnOptions: {
          cwd: this.options.frontend.cwd,
          env: this.options.frontend.env,
        },
      }),
      readinessLabel: "frontend",
    });
  }

  async ensureService({ label, port, probe, assertStartable, getSpawnConfig, readinessLabel }) {
    if (this.options.reuseExistingServices) {
      const initialProbe = await probe();
      if (initialProbe.ready) {
        return { owned: false, reused: true };
      }
      if (initialProbe.portInUse) {
        throw new LauncherError(
          `Port ${port} is already in use by another process, so the ${label} server could not be started or reused.`
        );
      }
    } else {
      await assertPortAvailable(port, label);
    }

    await assertStartable();
    const { command, args, spawnOptions } = getSpawnConfig();
    this.spawnManagedProcess(label, command, args, spawnOptions);
    await this.waitForProbe(probe, readinessLabel);
    return { owned: true, reused: false };
  }

  spawnManagedProcess(label, command, args, spawnOptions) {
    const child = spawn(command, args, {
      ...spawnOptions,
      detached: false,
      stdio: this.options.childStdio,
      windowsHide: this.options.windowsHide,
    });
    const entry = { label, child, owned: true };
    this.managedChildren.push(entry);

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        this.logOutput(label, "stdout", chunk);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        this.logOutput(label, "stderr", chunk);
      });
    }

    child.once("error", (error) => {
      this.handleFatal(new LauncherError(`Failed to start ${label}: ${error.message}`));
    });

    child.once("exit", (code, signal) => {
      if (this.shuttingDown || this.stopped) {
        return;
      }

      const suffix = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      this.handleFatal(new LauncherError(`${capitalize(label)} exited unexpectedly with ${suffix}.`));
    });

    return entry;
  }

  async waitForProbe(probe, readinessLabel) {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (this.fatalError) {
        throw this.fatalError;
      }

      const state = await probe();
      if (state.ready) {
        return;
      }

      await delay(500);
    }

    throw new LauncherError(
      `${readinessLabel} did not become ready within ${Math.round(STARTUP_TIMEOUT_MS / 1000)} seconds.`
    );
  }

  handleFatal(error) {
    if (this.fatalError) {
      return;
    }

    this.fatalError = error;
    this.emit("fatal", error);
  }

  logOutput(label, stream, chunk) {
    if (!this.options.logger) {
      return;
    }

    const message = chunk.toString().trim();
    if (!message) {
      return;
    }

    for (const line of message.split(/\r?\n/)) {
      this.options.logger(`[${label}:${stream}] ${line}`);
    }
  }
}

function resolveLauncherOptions(options) {
  const mode = options.mode ?? "browser-dev";
  const childStdio = options.childStdio ?? (mode === "browser-dev" ? "inherit" : "pipe");
  const windowsHide = options.windowsHide ?? mode !== "browser-dev";
  const logger = typeof options.logger === "function" ? options.logger : null;

  if (mode === "browser-dev" || mode === "electron-dev") {
    return {
      mode,
      childStdio,
      windowsHide,
      logger,
      reuseExistingServices: options.reuseExistingServices ?? mode !== "browser-dev",
      backend: resolveDevelopmentBackend(),
      frontend: resolveDevelopmentFrontend(),
    };
  }

  if (mode === "electron-packaged") {
    return {
      mode,
      childStdio,
      windowsHide,
      logger,
      reuseExistingServices: true,
      backend: resolvePackagedBackend(options),
      frontend: resolvePackagedFrontend(options),
    };
  }

  throw new LauncherError(`Unsupported launcher mode: ${mode}`);
}

function resolveDevelopmentBackend() {
  const commandPath = isWindows
    ? path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe")
    : path.join(repoRoot, "backend", ".venv", "bin", "python");

  return {
    commandPath,
    cwd: path.join(repoRoot, "backend"),
    args: [
      "-m",
      "uvicorn",
      "clipmine_api.main:app",
      "--reload",
      "--host",
      "127.0.0.1",
      "--port",
      String(BACKEND_PORT),
    ],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
    missingMessage: `Backend virtualenv is missing or incomplete at ${commandPath}. Run the backend setup first.`,
  };
}

function resolveDevelopmentFrontend() {
  return {
    commandPath: npmCommand,
    cwd: repoRoot,
    args: ["run", "dev", "--workspace", "apps/web"],
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      npm_config_cache: process.env.npm_config_cache ?? path.join(os.tmpdir(), "clipmine-npm-cache"),
    },
    requiredFilePath: null,
    missingMessage: "",
  };
}

function resolvePackagedBackend(options) {
  const resourcesPath = options.resourcesPath ?? process.resourcesPath;
  const userDataPath = options.userDataPath;
  if (!userDataPath) {
    throw new LauncherError("Packaged desktop mode requires an Electron user data path.");
  }

  const backendRoot = path.join(resourcesPath, "runtime", "backend");
  const commandPath = isWindows
    ? path.join(backendRoot, ".venv", "Scripts", "python.exe")
    : path.join(backendRoot, ".venv", "bin", "python");
  const storageDir = path.join(userDataPath, "storage");
  const modelCacheDir = path.join(userDataPath, "models");

  return {
    commandPath,
    cwd: backendRoot,
    args: [
      "-m",
      "uvicorn",
      "clipmine_api.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(BACKEND_PORT),
    ],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONPATH: [path.join(backendRoot, "src"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
      STORAGE_DIR: storageDir,
      MODEL_CACHE_DIR: modelCacheDir,
      HF_HOME: modelCacheDir,
      BACKEND_CORS_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
    },
    missingMessage:
      "The packaged backend runtime is incomplete. Run `npm run dist:desktop` again after creating `backend/.venv`.",
  };
}

function resolvePackagedFrontend(options) {
  const resourcesPath = options.resourcesPath ?? process.resourcesPath;
  const commandPath = options.execPath ?? process.execPath;
  const webRoot = path.join(resourcesPath, "runtime", "web");
  const serverScriptPath = path.join(webRoot, "apps", "web", "server.js");

  return {
    commandPath,
    cwd: path.join(webRoot, "apps", "web"),
    args: [serverScriptPath],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(FRONTEND_PORT),
    },
    requiredFilePath: serverScriptPath,
    missingMessage:
      "The packaged frontend runtime is incomplete. Run `npm run dist:desktop` again after building the desktop bundle.",
  };
}

async function probeBackend() {
  try {
    const response = await fetch(BACKEND_HEALTH_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.service === BACKEND_SERVICE_NAME || payload?.status === "ok") {
        return { ready: true, portInUse: true };
      }
    }
  } catch {
    // Retry or fall through to the port probe.
  }

  return {
    ready: false,
    portInUse: await isPortInUse(BACKEND_PORT),
  };
}

async function probeFrontend() {
  try {
    const response = await fetch(FRONTEND_URL, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.text();
      if (payload.includes(FRONTEND_MARKER)) {
        return { ready: true, portInUse: true };
      }
    }
  } catch {
    // Retry or fall through to the port probe.
  }

  return {
    ready: false,
    portInUse: await isPortInUse(FRONTEND_PORT),
  };
}

async function assertExecutable(filePath, errorMessage) {
  try {
    await access(filePath, isWindows ? constants.F_OK : constants.X_OK);
  } catch {
    throw new LauncherError(errorMessage);
  }
}

async function assertReadable(filePath, errorMessage) {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    throw new LauncherError(errorMessage);
  }
}

async function assertPortAvailable(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(new LauncherError(`Port ${port} is already in use, so the ${label} server could not start.`));
        return;
      }

      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve());
    });
  });
}

async function isPortInUse(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
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

function onceExit(child) {
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
  });
}

function delay(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
