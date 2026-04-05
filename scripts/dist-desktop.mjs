import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

await main();

async function main() {
  await rm(path.join(process.cwd(), "dist", "desktop"), {
    force: true,
    recursive: true,
    maxRetries: 5,
    retryDelay: 250,
  });
  await runCommand("npm", ["run", "build:desktop"]);

  const builderArgs = resolveElectronBuilderArgs();
  await runCommand("electron-builder", builderArgs);
}

function resolveElectronBuilderArgs() {
  const archFlag = resolveArchFlag(process.arch);

  if (process.platform === "darwin") {
    return ["--mac", "dmg", archFlag];
  }

  if (process.platform === "win32") {
    return ["--win", "nsis", archFlag];
  }

  throw new Error("Desktop packaging is supported in this repo only on macOS and Windows.");
}

function resolveArchFlag(arch) {
  if (arch === "arm64") {
    return "--arm64";
  }

  if (arch === "x64") {
    return "--x64";
  }

  throw new Error(`Unsupported desktop packaging architecture: ${arch}`);
}

async function runCommand(command, args) {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;

  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${executable} ${args.join(" ")} exited with code ${code ?? 1}.`));
    });
  });
}
