const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const isDev = !app.isPackaged;
const APP_NAME = 'Punto de Venta';
const CURRENT_VERSION = app.getVersion();
const UPDATE_URL = 'https://raw.githubusercontent.com/tecnicowin/post_venta/main/updates.json';

let mainWindow;
let updateInfo = null;

function getExeDir() {
  if (isDev) {
    return path.join(__dirname, '..');
  }
  return path.dirname(app.getPath('exe'));
}

function getDataPath() {
  const dataPath = path.join(getExeDir(), 'data');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
}

function getLocalVersion() {
  const versionFile = path.join(getDataPath(), 'version.json');
  try {
    if (fs.existsSync(versionFile)) {
      return JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    }
  } catch (e) {}
  return { version: CURRENT_VERSION, lastUpdate: null };
}

function saveLocalVersion(info) {
  const versionFile = path.join(getDataPath(), 'version.json');
  fs.writeFileSync(versionFile, JSON.stringify(info, null, 2));
}

function getLicenseLocal() {
  try {
    const dataPath = getDataPath();
    const licenseFile = path.join(dataPath, 'license.json');
    if (fs.existsSync(licenseFile)) {
      return JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    }
  } catch (e) {}
  return null;
}

function checkUpdateAvailable(remoteVersion) {
  const local = getLocalVersion();
  if (!remoteVersion) return false;
  const parts1 = remoteVersion.split('.').map(Number);
  const parts2 = (local.version || CURRENT_VERSION).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return true;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return false;
  }
  return false;
}

async function checkForUpdates(silent = false) {
  const license = getLicenseLocal();
  if (!license || license.tipo !== 'PRO' || license.estado !== 'activa') {
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Actualizaciones',
        message: 'Las actualizaciones están disponibles solo para licencias PRO.',
        buttons: ['OK']
      });
    }
    return;
  }

  try {
    const data = await fetchUrl(UPDATE_URL);
    updateInfo = JSON.parse(data);

    if (updateInfo && checkUpdateAvailable(updateInfo.version)) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Actualización disponible',
        message: `Nueva versión ${updateInfo.version} disponible.\n\nTu versión: ${CURRENT_VERSION}\n\n¿Deseas descargar la actualización?`,
        buttons: ['Actualizar', 'Más tarde'],
        defaultId: 0
      });

      if (result.response === 0) {
        await downloadUpdate(updateInfo);
      }
    } else if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Sin actualizaciones',
        message: `Estás usando la última versión (${CURRENT_VERSION}).`,
        buttons: ['OK']
      });
    }
  } catch (e) {
    if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Error',
        message: 'No se pudo verificar actualizaciones.',
        buttons: ['OK']
      });
    }
  }
}

async function downloadUpdate(info) {
  if (!info || !info.downloadUrl) return;

  const progressWin = new BrowserWindow({
    width: 400,
    height: 200,
    parent: mainWindow,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  progressWin.setMenu(null);
  progressWin.loadURL(`data:text/html,
    <html><body style="font-family:system-ui;padding:30px;text-align:center;background:#1e293b;color:#e2e8f0">
      <h3 style="margin:0 0 20px">Descargando actualización...</h3>
      <div style="background:#334155;border-radius:8px;overflow:hidden;height:24px">
        <div id="bar" style="background:#3b82f6;height:100%;width:0%;transition:width 0.3s"></div>
      </div>
      <p id="status" style="margin-top:12px;color:#94a3b8;font-size:13px">Conectando...</p>
    </body></html>
  `);

  try {
    const dataPath = getDataPath();
    const updateFile = path.join(dataPath, 'update.zip');

    await downloadFile(info.downloadUrl, updateFile, (percent) => {
      if (progressWin && !progressWin.isDestroyed()) {
        progressWin.webContents.executeJavaScript(`
          document.getElementById('bar').style.width = '${percent}%';
          document.getElementById('status').textContent = 'Descargando... ${percent}%';
        `);
      }
    });

    if (progressWin && !progressWin.isDestroyed()) {
      progressWin.webContents.executeJavaScript(`
        document.getElementById('bar').style.width = '100%';
        document.getElementById('status').textContent = 'Descarga completa. Reiniciando...';
      `);
    }

    saveLocalVersion({ version: info.version, lastUpdate: new Date().toISOString() });

    setTimeout(() => {
      if (progressWin && !progressWin.isDestroyed()) progressWin.close();
      app.relaunch();
      app.exit(0);
    }, 1500);

  } catch (e) {
    if (progressWin && !progressWin.isDestroyed()) progressWin.close();
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Error de descarga',
      message: 'No se pudo descargar la actualización.',
      buttons: ['OK']
    });
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      const total = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total && onProgress) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on('error', reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon-192.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
      sandbox: true
    },
    autoHideMenuBar: true,
    show: false
  });

  const menuTemplate = [
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Buscar actualizaciones',
          click: () => checkForUpdates(false)
        },
        { type: 'separator' },
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de',
              message: `${APP_NAME}\nVersión: ${CURRENT_VERSION}\n\nDesarrollado por Tecnicowin`,
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    }
  ];

  if (isDev) {
    menuTemplate.unshift({
      label: 'Dev',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  const indexPath = path.join(__dirname, '..', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isDev) {
      setTimeout(() => checkForUpdates(true), 5000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev) {
      if (input.key === 'F12') event.preventDefault();
      if (input.control && input.shift && input.key === 'I') event.preventDefault();
      if (input.control && input.key === 'u') event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  ipcMain.on('check-updates', () => {
    checkForUpdates(false);
  });

  ipcMain.handle('export-data', async (event, json) => {
    try {
      const dataPath = getDataPath();
      const backupFile = path.join(dataPath, 'backup_pdv.json');
      fs.writeFileSync(backupFile, json, 'utf8');
      return { ok: true, path: backupFile };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('import-data', async () => {
    try {
      const dataPath = getDataPath();
      const backupFile = path.join(dataPath, 'backup_pdv.json');
      if (fs.existsSync(backupFile)) {
        const data = fs.readFileSync(backupFile, 'utf8');
        return { ok: true, data };
      }
      return { ok: false, error: 'No hay backup encontrado' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('get-data-path', () => {
    return getDataPath();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });
});
