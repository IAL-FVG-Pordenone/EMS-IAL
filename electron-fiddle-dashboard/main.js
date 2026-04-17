const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {
  loadDbConfig,
  saveDbConfig,
  testDbConnection,
  getBootstrapData,
  shutdownLab,
  startLab,
  isDriverAvailable,
  getMeasurementHistory,
  authorizeSettingsAccess
} = require('./db');

function getAppDataDir() {
  return app.getPath('userData');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#07111f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dashboard:get-bootstrap', async (_event, rangeKey = 'hours') => {
  return getBootstrapData(getAppDataDir(), rangeKey);
});

ipcMain.handle('dashboard:get-labs', async () => {
  return getBootstrapData(getAppDataDir(), 'hours');
});

ipcMain.handle('dashboard:get-db-config', async () => {
  return {
    ok: true,
    config: loadDbConfig(getAppDataDir()),
    driverAvailable: isDriverAvailable(),
  };
});

ipcMain.handle('dashboard:save-db-config', async (_event, partialConfig) => {
  const saved = saveDbConfig(getAppDataDir(), partialConfig || {});
  return {
    ok: true,
    config: saved,
    driverAvailable: isDriverAvailable(),
  };
});

ipcMain.handle('dashboard:test-db-connection', async (_event, partialConfig) => {
  return testDbConnection(getAppDataDir(), partialConfig || null);
});

ipcMain.handle('dashboard:shutdown-lab', async (_event, payload) => {
  return shutdownLab(getAppDataDir(), payload);
});

ipcMain.handle('dashboard:start-lab', async (_event, labId) => {
  return startLab(getAppDataDir(), labId);
});


ipcMain.handle('dashboard:get-measurement-history', async (_event, labId, rangeKey = '1h') => {
  return getMeasurementHistory(getAppDataDir(), labId, rangeKey);
});

ipcMain.handle('dashboard:authorize-settings-access', async (_event, payload) => {
  return authorizeSettingsAccess(getAppDataDir(), payload);
});
