
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashboardAPI', {
  getLabs: () => ipcRenderer.invoke('dashboard:get-labs'),
  getBootstrap: (rangeKey) => ipcRenderer.invoke('dashboard:get-bootstrap', rangeKey),
  getDbConfig: () => ipcRenderer.invoke('dashboard:get-db-config'),
  saveDbConfig: (config) => ipcRenderer.invoke('dashboard:save-db-config', config),
  testDbConnection: (config) => ipcRenderer.invoke('dashboard:test-db-connection', config),
  shutdownLab: (payload) => ipcRenderer.invoke('dashboard:shutdown-lab', payload),
  startLab: (labId) => ipcRenderer.invoke('dashboard:start-lab', labId),
  getMeasurementHistory: (labId, rangeKey) => ipcRenderer.invoke('dashboard:get-measurement-history', labId, rangeKey),
  authorizeSettingsAccess: (payload) => ipcRenderer.invoke('dashboard:authorize-settings-access', payload),
});
