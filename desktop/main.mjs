import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, shell } from "electron";

import { createClipMineLauncher } from "./runtime/launcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, "preload.cjs");

let mainWindow = null;
let launcher = null;
let shutdownRequested = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.whenReady().then(startDesktopApp).catch((error) => {
  dialog.showErrorBox("ClipMine AI failed to start", error instanceof Error ? error.message : String(error));
  app.exit(1);
});

app.on("window-all-closed", () => {
  void shutdownAndExit(0);
});

app.on("before-quit", (event) => {
  if (shutdownRequested) {
    return;
  }

  event.preventDefault();
  void shutdownAndExit(0);
});

async function startDesktopApp() {
  launcher = createClipMineLauncher({
    mode: app.isPackaged ? "electron-packaged" : "electron-dev",
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
    execPath: process.execPath,
    logger(message) {
      console.log(`[desktop] ${message}`);
    },
  });

  launcher.once("fatal", (error) => {
    void showStartupError(error.message);
  });

  const { frontendUrl } = await launcher.start();
  await createWindow(frontendUrl);
}

async function createWindow(frontendUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: "ClipMine AI",
    autoHideMenuBar: true,
    backgroundColor: "#09111a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(frontendUrl);
}

async function showStartupError(message) {
  dialog.showErrorBox("ClipMine AI failed to start", message);
  await shutdownAndExit(1);
}

async function shutdownAndExit(code) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  if (launcher) {
    await launcher.stop();
  }
  app.exit(code);
}
