const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow = null;
const noteWindows = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "ruang. — Fokus & Selesaikan",
    icon: path.join(__dirname, "../public/icon.png"),
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin =
      isDev && process.env.VITE_DEV_SERVER_URL
        ? new URL(process.env.VITE_DEV_SERVER_URL).origin
        : "file://";
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault();
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Support IPC for native Desktop Always-On-Top Sticky Note
ipcMain.handle("open-desktop-note", (event, noteData) => {
  const { id, title, notes, color, category } = noteData;

  if (noteWindows.has(id)) {
    const existing = noteWindows.get(id);
    existing.focus();
    return true;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(color || ""))
    ? color
    : "#fffdf0";
  const safeTitle = escapeHtml(title || "Catatan");
  const safeCategory = escapeHtml(category || "Tugas");
  const safeNotes = escapeHtml(notes || "(Tanpa catatan tambahan)");

  const noteWin = new BrowserWindow({
    width: 320,
    height: 380,
    minWidth: 240,
    minHeight: 200,
    frame: true,
    alwaysOnTop: true, // Always floating on Windows desktop above all apps!
    skipTaskbar: false,
    title: `📌 ${String(title || "Catatan")}`,
    backgroundColor: safeColor,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  noteWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  noteWin.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("data:text/html")) {
      event.preventDefault();
    }
  });

  noteWindows.set(id, noteWin);

  noteWin.on("closed", () => {
    noteWindows.delete(id);
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>📌 ${safeTitle}</title>
        <style>
          body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${safeColor};
            color: #222;
            user-select: text;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            opacity: 0.7;
            margin-bottom: 8px;
          }
          .category {
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(0,0,0,0.06);
            font-weight: 600;
          }
          h2 {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 700;
          }
          p {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            opacity: 0.85;
          }
          .footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px dashed rgba(0,0,0,0.15);
            font-size: 10px;
            opacity: 0.55;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span>📌 Catatan Melayang Desktop</span>
          <span class="category">${safeCategory}</span>
        </div>
        <h2>${safeTitle}</h2>
        <p>${safeNotes}</p>
        <div class="footer">
          Jendela ini Always-On-Top di atas game, browser & aplikasi desktop lainnya.
        </div>
      </body>
    </html>
  `;

  noteWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return true;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
