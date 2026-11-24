const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function getDataPath() {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'todos.json');
}

function loadStore() {
  const file = getDataPath();
  if (!fs.existsSync(file)) {
    return { drafts: [], history: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { drafts: [], history: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(getDataPath(), JSON.stringify(store, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'AUBM PCheck — Fiches Todo PC',
    backgroundColor: '#0f1419',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('store:load', () => loadStore());

ipcMain.handle('store:save', (_event, store) => {
  saveStore(store);
  return true;
});

ipcMain.handle('export:pdf', async (_event, { html, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter la fiche en PDF',
    defaultPath: defaultName || 'fiche-todo-pc.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  try {
    await pdfWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'default'
      }
    });
    fs.writeFileSync(filePath, pdfData);
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    pdfWindow.destroy();
  }
});

ipcMain.handle('print:fiche', async (_event, { html }) => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
    await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true
        },
        (success, failureReason) => {
          if (success) {
            resolve();
          } else {
            reject(new Error(failureReason || 'Impression annulée'));
          }
        }
      );
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    printWindow.destroy();
  }
});

ipcMain.handle('dialog:open-path', async (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});
