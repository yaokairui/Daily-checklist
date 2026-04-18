const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const dataDir = path.join(userDataPath, 'checklist-data');
const recycleBinDir = path.join(userDataPath, 'checklist-recycle-bin');
const configFile = path.join(userDataPath, 'config.json');
const templatesDir = path.join(dataDir, 'templates');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(recycleBinDir)) fs.mkdirSync(recycleBinDir, { recursive: true });
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

let mainWindow = null;
let tray = null;
let reminderTimers = [];
let isAlwaysOnTop = true;
let windowOpacity = 0.92;

const cliArgs = process.argv.slice(1);
const shouldCreateNew = cliArgs.includes('--new') || cliArgs.includes('-n');
const shouldShowOnly = cliArgs.includes('--show') || cliArgs.includes('-s');

function loadConfig() {
  try {
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
  } catch (e) {}
  return {
    windowBounds: { width: 240, height: 380, x: undefined, y: undefined },
    theme: 'system',
    shortcutKey: 'CommandOrControl+Shift+N',
    alwaysOnTop: true,
    opacity: 0.92
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {}
}

function createWindow() {
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    width: config.windowBounds.width || 240,
    height: config.windowBounds.height || 380,
    minWidth: 200,
    minHeight: 260,
    title: '日常清单',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: config.alwaysOnTop !== false,
    opacity: config.opacity || 0.92,
    skipTaskbar: true,
    hasShadow: false,
    show: false
  });

  isAlwaysOnTop = config.alwaysOnTop !== false;
  windowOpacity = config.opacity || 0.92;

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (shouldCreateNew) {
      setTimeout(() => createNewChecklist(), 500);
    }
  });

  mainWindow.on('resize', () => saveWindowBounds());
  mainWindow.on('move', () => saveWindowBounds());

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function saveWindowBounds() {
  if (!mainWindow) return;
  const config = loadConfig();
  config.windowBounds = mainWindow.getBounds();
  saveConfig(config);
}

function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'tray-icon.png');
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = iconPath;
  } else {
    trayIcon = path.join(__dirname, 'src', 'assets', 'icon.png');
  }

  try {
    tray = new Tray(trayIcon);
  } catch (e) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => showMainWindow() },
    { label: '新建清单', click: () => createNewChecklist() },
    { type: 'separator' },
    { label: '置顶', type: 'checkbox', checked: isAlwaysOnTop, click: (menuItem) => {
      toggleAlwaysOnTop(menuItem.checked);
    }},
    { type: 'separator' },
    { label: '退出', click: () => quitApp() }
  ]);

  tray.setToolTip('日常清单');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createNewChecklist() {
  if (mainWindow) {
    mainWindow.webContents.send('create-new-checklist');
    showMainWindow();
  }
}

function toggleAlwaysOnTop(pin) {
  isAlwaysOnTop = pin;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(pin, 'floating');
  }
  const config = loadConfig();
  config.alwaysOnTop = pin;
  saveConfig(config);
}

function setWindowOpacity(opacity) {
  windowOpacity = Math.max(0.3, Math.min(1.0, opacity));
  if (mainWindow) {
    mainWindow.setOpacity(windowOpacity);
  }
  const config = loadConfig();
  config.opacity = windowOpacity;
  saveConfig(config);
}

function quitApp() {
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];
  if (tray) tray.destroy();
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
  app.quit();
}

function registerShortcuts() {
  const config = loadConfig();
  try {
    globalShortcut.register(config.shortcutKey, () => {
      createNewChecklist();
    });
  } catch (e) {}
}

function setupReminders(todos) {
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];
  if (!todos || !Array.isArray(todos)) return;

  const now = Date.now();
  todos.forEach(todo => {
    if (todo.reminder && !todo.completed) {
      const reminderTime = new Date(todo.reminder).getTime();
      const delay = reminderTime - now;
      if (delay > 0 && delay < 86400000) {
        const timer = setTimeout(() => {
          if (Notification.isSupported()) {
            new Notification({
              title: '事项提醒',
              body: todo.text,
              icon: path.join(__dirname, 'src', 'assets', 'icon.png')
            }).show();
          }
          if (mainWindow) {
            mainWindow.webContents.send('reminder-fired', todo.id);
          }
        }, delay);
        reminderTimers.push(timer);
      }
    }
  });
}

function moveToRecycleBin(fileName) {
  try {
    const srcPath = path.join(dataDir, fileName);
    if (!fs.existsSync(srcPath)) return { success: false, error: '文件不存在' };

    const content = fs.readFileSync(srcPath, 'utf-8');
    let data;
    try { data = JSON.parse(content); } catch (e) { data = {}; }

    const meta = {
      originalName: fileName.replace('.json', ''),
      deletedAt: new Date().toISOString(),
      originalData: data
    };

    const destPath = path.join(recycleBinDir, fileName);
    fs.writeFileSync(destPath, content, 'utf-8');

    const destMetaPath = path.join(recycleBinDir, fileName.replace('.json', '.meta.json'));
    fs.writeFileSync(destMetaPath, JSON.stringify(meta, null, 2), 'utf-8');

    fs.unlinkSync(srcPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function restoreFromRecycleBin(fileName) {
  try {
    const srcPath = path.join(recycleBinDir, fileName);
    if (!fs.existsSync(srcPath)) return { success: false, error: '回收站中文件不存在' };

    const content = fs.readFileSync(srcPath, 'utf-8');
    const destPath = path.join(dataDir, fileName);
    fs.writeFileSync(destPath, content, 'utf-8');

    fs.unlinkSync(srcPath);
    const metaPath = path.join(recycleBinDir, fileName.replace('.json', '.meta.json'));
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function permanentlyDelete(fileName) {
  try {
    const filePath = path.join(recycleBinDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const metaPath = path.join(recycleBinDir, fileName.replace('.json', '.meta.json'));
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function emptyRecycleBin() {
  try {
    const files = fs.readdirSync(recycleBinDir);
    files.forEach(f => {
      const fp = path.join(recycleBinDir, f);
      if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
    });
    return { success: true, count: files.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function listRecycleBin() {
  try {
    if (!fs.existsSync(recycleBinDir)) return [];
    const files = fs.readdirSync(recycleBinDir).filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));
    return files.map(f => {
      const metaPath = path.join(recycleBinDir, f.replace('.json', '.meta.json'));
      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (e) {}
      }
      return {
        fileName: f,
        name: f.replace('.json', ''),
        deletedAt: meta.deletedAt || null,
        originalData: meta.originalData || null
      };
    });
  } catch (e) {
    return [];
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  if (shouldShowOnly) {
    showMainWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    quitApp();
  }
});

app.on('before-quit', () => {
  reminderTimers.forEach(t => clearTimeout(t));
  if (tray) tray.destroy();
});

app.setAppUserModelId('com.daily.checklist');

ipcMain.handle('get-app-path', () => userDataPath);
ipcMain.handle('get-data-dir', () => dataDir);
ipcMain.handle('get-recycle-bin-dir', () => recycleBinDir);

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('list-files', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));
  } catch (e) {
    return [];
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('move-to-recycle-bin', (event, fileName) => moveToRecycleBin(fileName));
ipcMain.handle('restore-from-recycle-bin', (event, fileName) => restoreFromRecycleBin(fileName));
ipcMain.handle('permanently-delete', (event, fileName) => permanentlyDelete(fileName));
ipcMain.handle('empty-recycle-bin', () => emptyRecycleBin());
ipcMain.handle('list-recycle-bin', () => listRecycleBin());

ipcMain.handle('export-checklist', async (event, { content, format, defaultName }) => {
  try {
    const filters = format === 'json'
      ? [{ name: 'JSON 文件', extensions: ['json'] }]
      : [{ name: '文本文件', extensions: ['txt'] }];

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出清单',
      defaultPath: defaultName || 'checklist',
      filters
    });

    if (result.canceled) return { success: false, reason: 'cancelled' };

    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, reason: e.message };
  }
});

ipcMain.handle('setup-reminders', (event, todos) => {
  setupReminders(todos);
  return true;
});

ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (event, config) => {
  saveConfig(config);
  return true;
});

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.hide(); });

ipcMain.handle('toggle-always-on-top', (event, pin) => {
  toggleAlwaysOnTop(pin);
  return isAlwaysOnTop;
});

ipcMain.handle('get-always-on-top', () => isAlwaysOnTop);

ipcMain.handle('set-opacity', (event, opacity) => {
  setWindowOpacity(opacity);
  return windowOpacity;
});

ipcMain.handle('get-opacity', () => windowOpacity);
