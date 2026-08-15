const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installerAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  installApp: (options) => ipcRenderer.invoke('install-app', options),
  launchApp: (path) => ipcRenderer.invoke('launch-app', path),
  onProgress: (callback) => ipcRenderer.on('install-progress', (event, data) => callback(data))
});
