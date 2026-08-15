const { app, BrowserWindow, Menu, clipboard, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let tempUserData;

function setupCleanEnvironment() {
  tempUserData = path.join(os.tmpdir(), 'pdv_license_gen_' + Date.now());
  app.setPath('userData', tempUserData);
}

function cleanupSync() {
  try {
    if (tempUserData && fs.existsSync(tempUserData)) {
      fs.rmSync(tempUserData, { recursive: true, force: true });
    }
  } catch (e) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 800,
    minWidth: 500,
    minHeight: 600,
    title: 'Generador de Licencias',
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon-192.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true,
    show: false
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' }
      ]
    }
  ]));

  mainWindow.loadFile(path.join(__dirname, 'generador-licencias.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupCleanEnvironment();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupSync();
  app.quit();
});

app.on('before-quit', () => {
  cleanupSync();
});

process.on('exit', () => {
  cleanupSync();
});
