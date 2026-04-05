import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(repoRoot, ".desktop-build");
const runtimeRoot = path.join(stageRoot, "runtime");
const standaloneRoot = path.join(repoRoot, "apps", "web", ".next", "standalone");
const webStaticRoot = path.join(repoRoot, "apps", "web", ".next", "static");
const publicRoot = path.join(repoRoot, "apps", "web", "public");
const buildResourcesRoot = path.join(repoRoot, "desktop", "build-resources");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const backendPythonPath =
  process.platform === "win32"
    ? path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe")
    : path.join(repoRoot, "backend", ".venv", "bin", "python");

await main();

async function main() {
  await assertDesktopAssets();
  await assertBackendVirtualenv();
  await runCommand(npmCommand, ["run", "build", "--workspace", "apps/web"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      npm_config_cache: process.env.npm_config_cache ?? path.join(os.tmpdir(), "clipmine-npm-cache"),
    },
  });
  await prepareRuntimeBundle();
  console.log("[build:desktop] Desktop runtime prepared in .desktop-build/runtime");
}

async function assertDesktopAssets() {
  for (const fileName of ["icon.png", "icon.ico", "icon.icns"]) {
    await assertReadable(
      path.join(buildResourcesRoot, fileName),
      `Missing desktop icon asset at desktop/build-resources/${fileName}.`
    );
  }
}

async function assertBackendVirtualenv() {
  try {
    await access(backendPythonPath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
  } catch {
    throw new Error(
      `Backend virtualenv is missing or incomplete at ${backendPythonPath}. Create backend/.venv before building the desktop app.`
    );
  }
}

async function prepareRuntimeBundle() {
  await rm(stageRoot, { force: true, recursive: true });
  await mkdir(runtimeRoot, { recursive: true });

  const stagedWebRoot = path.join(runtimeRoot, "web");
  const stagedBackendRoot = path.join(runtimeRoot, "backend");

  await assertReadable(standaloneRoot, "Next.js standalone output is missing. The web build did not produce a desktop runtime.");
  await assertReadable(webStaticRoot, "Next.js static assets are missing. The web build did not produce static output.");

  await cp(standaloneRoot, stagedWebRoot, {
    recursive: true,
    preserveTimestamps: true,
  });
  await mkdir(path.join(stagedWebRoot, "apps", "web", ".next"), { recursive: true });
  await cp(webStaticRoot, path.join(stagedWebRoot, "apps", "web", ".next", "static"), {
    recursive: true,
    preserveTimestamps: true,
  });

  try {
    await access(publicRoot, constants.F_OK);
    await cp(publicRoot, path.join(stagedWebRoot, "apps", "web", "public"), {
      recursive: true,
      preserveTimestamps: true,
    });
  } catch {
    // The app currently has no public directory.
  }

  await assertReadable(
    path.join(stagedWebRoot, "apps", "web", "server.js"),
    "Next.js standalone server.js is missing from the staged desktop runtime."
  );

  await cp(path.join(repoRoot, "backend", "src"), path.join(stagedBackendRoot, "src"), {
    recursive: true,
    preserveTimestamps: true,
  });
  await cp(path.join(repoRoot, "backend", ".venv"), path.join(stagedBackendRoot, ".venv"), {
    recursive: true,
    preserveTimestamps: true,
  });
}

async function assertReadable(targetPath, message) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(message);
  }
}

async function runCommand(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}.`));
    });
  });
}
