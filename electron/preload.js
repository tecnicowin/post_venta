const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  checkUpdates: () => ipcRenderer.send('check-updates'),
  exportData: (json) => ipcRenderer.invoke('export-data', json),
  importData: () => ipcRenderer.invoke('import-data'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  autoSave: (json) => ipcRenderer.invoke('auto-save', json),
  autoLoad: () => ipcRenderer.invoke('auto-load')
});
