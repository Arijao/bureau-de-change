const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable:     (cb) => ipcRenderer.on('update-available',         (_, data) => cb(data)),
  onDownloadProgress:    (cb) => ipcRenderer.on('update-download-progress', (_, data) => cb(data)),
  onUpdateDownloaded:    (cb) => ipcRenderer.on('update-downloaded',        ()        => cb()),
  installUpdate:         ()   => ipcRenderer.send('install-update'),
  removeUpdateListeners: ()   => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-download-progress')
    ipcRenderer.removeAllListeners('update-downloaded')
  },
})