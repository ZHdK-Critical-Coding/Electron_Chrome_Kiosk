// Connects the launcher page with main.js. Only these functions are available to the page.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('kiosk', {
  getState: () => ipcRenderer.invoke('get-state'),
  saveSettings: (changes) => ipcRenderer.invoke('save-settings', changes),
  launch: (url) => ipcRenderer.invoke('launch', url),
  // Dropped File objects → their paths on disk
  addExtensions: (files) =>
    ipcRenderer.invoke('add-extensions', Array.from(files, (file) => webUtils.getPathForFile(file))),
  chooseExtensions: () => ipcRenderer.invoke('choose-extensions'),
  setExtensionEnabled: (id, enabled) => ipcRenderer.invoke('set-extension-enabled', id, enabled),
  removeExtension: (id) => ipcRenderer.invoke('remove-extension', id),
  showExtension: (id) => ipcRenderer.invoke('show-extension', id),
  // Called when main.js has news, e.g. after returning from the kiosk
  onState: (callback) => ipcRenderer.on('state', (event, state) => callback(state)),
});
