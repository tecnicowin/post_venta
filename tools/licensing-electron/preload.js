const { contextBridge, ipcRenderer, shell, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  copyToClipboard: (text) => clipboard.writeText(text),
  openWhatsApp: (url) => shell.openExternal(url)
});
