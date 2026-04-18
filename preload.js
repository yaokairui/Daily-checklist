const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  getRecycleBinDir: () => ipcRenderer.invoke('get-recycle-bin-dir'),

  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listFiles: (dirPath) => ipcRenderer.invoke('list-files', dirPath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  moveToRecycleBin: (fileName) => ipcRenderer.invoke('move-to-recycle-bin', fileName),
  restoreFromRecycleBin: (fileName) => ipcRenderer.invoke('restore-from-recycle-bin', fileName),
  permanentlyDelete: (fileName) => ipcRenderer.invoke('permanently-delete', fileName),
  emptyRecycleBin: () => ipcRenderer.invoke('empty-recycle-bin'),
  listRecycleBin: () => ipcRenderer.invoke('list-recycle-bin'),

  exportChecklist: (data) => ipcRenderer.invoke('export-checklist', data),

  setupReminders: (todos) => ipcRenderer.invoke('setup-reminders', todos),

  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowClose: () => ipcRenderer.send('window-close'),

  toggleAlwaysOnTop: (pin) => ipcRenderer.invoke('toggle-always-on-top', pin),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),
  getOpacity: () => ipcRenderer.invoke('get-opacity'),

  onCreateNewChecklist: (callback) => {
    ipcRenderer.on('create-new-checklist', () => callback());
  },
  onReminderFired: (callback) => {
    ipcRenderer.on('reminder-fired', (event, id) => callback(id));
  }
});
