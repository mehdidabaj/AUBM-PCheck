const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcheck', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (store) => ipcRenderer.invoke('store:save', store),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  printFiche: (payload) => ipcRenderer.invoke('print:fiche', payload),
  openPath: (filePath) => ipcRenderer.invoke('dialog:open-path', filePath)
});
