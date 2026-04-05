const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
  "clipmineDesktop",
  Object.freeze({
    platform: process.platform,
  })
);
