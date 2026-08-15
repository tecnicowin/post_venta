const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function getDefaultInstallPath() {
  return path.join(app.getPath('desktop'), 'PuntoDeVenta');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 580,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Instalador Punto de Venta',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a'
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile('installer.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Seleccionar carpeta de instalacion',
      defaultPath: getDefaultInstallPath()
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-default-path', () => {
    return getDefaultInstallPath();
  });

  ipcMain.handle('install-app', async (event, { installPath, createShortcut }) => {
    const steps = [
      { name: 'Preparando instalacion', progress: 10 },
      { name: 'Copiando archivos del sistema', progress: 40 },
      { name: 'Copiando archivos de la aplicacion', progress: 70 },
      { name: 'Configurando el sistema', progress: 85 },
      { name: 'Creando acceso directo', progress: 95 },
      { name: 'Finalizando instalacion', progress: 100 }
    ];

    try {
      for (const step of steps) {
        mainWindow.webContents.send('install-progress', step);

        if (step.name === 'Copiando archivos del sistema') {
          const appSource = path.join(__dirname, '..', '..', 'Portable Punto de Venta', 'PuntoDeVenta-win32-x64');
          if (!fs.existsSync(appSource)) {
            throw new Error('No se encontro la carpeta del sistema en: ' + appSource);
          }
          await copyDirectory(appSource, installPath);
        }

        if (step.name === 'Copiando archivos de la aplicacion') {
          const dataDir = path.join(installPath, 'data');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
        }

        if (step.name === 'Creando acceso directo' && createShortcut) {
          createDesktopShortcut(installPath);
        }

        await new Promise(r => setTimeout(r, 400));
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('launch-app', (event, installPath) => {
    const exePath = path.join(installPath, 'PuntoDeVenta.exe');
    if (fs.existsSync(exePath)) {
      shell.openPath(exePath);
      return true;
    }
    return false;
  });
}

async function copyDirectory(source, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createDesktopShortcut(installPath) {
  const exePath = path.join(installPath, 'PuntoDeVenta.exe');
  const desktopPath = app.getPath('desktop');
  const shortcutPath = path.join(desktopPath, 'Punto de Venta.lnk');

  const ps = `
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
    $Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
    $Shortcut.WorkingDirectory = "${installPath.replace(/\\/g, '\\\\')}"
    $Shortcut.Description = "Punto de Venta - Sistema de Facturacion"
    $Shortcut.Save()
  `;

  try {
    require('child_process').execSync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
  } catch (e) {
    console.error('Error creating shortcut:', e);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
