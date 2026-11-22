const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openDesktopNote: (noteData) => ipcRenderer.invoke("open-desktop-note", noteData),
  isDesktop: true,
});
