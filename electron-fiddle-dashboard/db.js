
const fs = require('fs');
const path = require('path');

let sql = null;
try {
  sql = require('mssql');
} catch (error) {
  sql = null;
}

const DEFAULT_DB_CONFIG = {
  server: 'localhost',
  port: 1433,
  database: 'EMS-IAL',
  user: '',
  password: '',
  instanceName: '',
  encrypt: false,
  trustServerCertificate: true,
  demoMode: true,
  connectionTimeout: 15000,
  requestTimeout: 15000,
  schoolName: 'Istituto Tecnico - Monitoraggio Energetico',
  settingsRequireAuth: false,
};

const FALLBACK_COLORS = ['#5cc8ff', '#8f7cff', '#44f5b1', '#ff8bd6', '#ffba52'];
let currentPool = null;
let currentSignature = '';

function getConfigPath(appDataDir) {
  return path.join(appDataDir, 'db.config.json');
}

function normalizeDbConfig(partial = {}) {
  const merged = { ...DEFAULT_DB_CONFIG, ...partial };
  return {
    server: String(merged.server || '').trim() || DEFAULT_DB_CONFIG.server,
    port: Number(merged.port || DEFAULT_DB_CONFIG.port),
    database: String(merged.database || '').trim() || DEFAULT_DB_CONFIG.database,
    user: String(merged.user || '').trim(),
    password: String(merged.password || ''),
    instanceName: String(merged.instanceName || '').trim(),
    encrypt: Boolean(merged.encrypt),
    trustServerCertificate: merged.trustServerCertificate !== false,
    demoMode: merged.demoMode !== false,
    connectionTimeout: Number(merged.connectionTimeout || DEFAULT_DB_CONFIG.connectionTimeout),
    requestTimeout: Number(merged.requestTimeout || DEFAULT_DB_CONFIG.requestTimeout),
    schoolName: String(merged.schoolName || '').trim() || DEFAULT_DB_CONFIG.schoolName,
    settingsRequireAuth: Boolean(merged.settingsRequireAuth),
  };
}

function loadDbConfig(appDataDir) {
  const filePath = getConfigPath(appDataDir);
  if (!fs.existsSync(filePath)) {
    return normalizeDbConfig();
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return normalizeDbConfig(JSON.parse(raw));
  } catch (error) {
    return normalizeDbConfig();
  }
}

function saveDbConfig(appDataDir, partial = {}) {
  const nextConfig = normalizeDbConfig({ ...loadDbConfig(appDataDir), ...partial });
  const filePath = getConfigPath(appDataDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(nextConfig, null, 2), 'utf8');
  resetPool();
  return nextConfig;
}

function isDriverAvailable() {
  return Boolean(sql);
}

function resetPool() {
  if (currentPool && typeof currentPool.close === 'function') {
    currentPool.close().catch(() => null);
  }
  currentPool = null;
  currentSignature = '';
}

function getPoolSignature(config) {
  return JSON.stringify({
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    instanceName: config.instanceName,
    encrypt: config.encrypt,
    trustServerCertificate: config.trustServerCertificate,
  });
}

function toSqlConfig(config) {
  const sqlConfig = {
    server: config.server,
    database: config.database,
    user: config.user,
    password: config.password,
    port: config.port,
    options: {
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: config.connectionTimeout,
    requestTimeout: config.requestTimeout,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (config.instanceName) {
    sqlConfig.options.instanceName = config.instanceName;
  }

  return sqlConfig;
}

async function getPool(config) {
  if (!sql) {
    throw new Error('Driver mssql non installato. In Electron Fiddle usa mssql@10.0.4.');
  }

  if (config.demoMode) {
    throw new Error('Modalità demo attiva. Disattivala per usare il database reale.');
  }

  if (!config.server || !config.database || !config.user) {
    throw new Error('Configurazione database incompleta.');
  }

  const signature = getPoolSignature(config);
  if (currentPool && currentSignature === signature && currentPool.connected) {
    return currentPool;
  }

  if (currentPool) {
    await currentPool.close().catch(() => null);
    currentPool = null;
  }

  currentPool = await new sql.ConnectionPool(toSqlConfig(config)).connect();
  currentSignature = signature;
  return currentPool;
}

function getRangeSpec(rangeKey) {
  const now = Date.now();
  const map = {
    hours: { lookbackMs: 12 * 60 * 60 * 1000, desiredPoints: 12, stepMs: 60 * 60 * 1000 },
    days: { lookbackMs: 10 * 24 * 60 * 60 * 1000, desiredPoints: 10, stepMs: 24 * 60 * 60 * 1000 },
    months: { lookbackMs: 8 * 30 * 24 * 60 * 60 * 1000, desiredPoints: 8, stepMs: 30 * 24 * 60 * 60 * 1000 },
    quarter: { lookbackMs: 90 * 24 * 60 * 60 * 1000, desiredPoints: 8, stepMs: 15 * 24 * 60 * 60 * 1000 },
    years: { lookbackMs: 6 * 365 * 24 * 60 * 60 * 1000, desiredPoints: 6, stepMs: 365 * 24 * 60 * 60 * 1000 },
  };
  const selected = map[rangeKey] || map.hours;
  return {
    ...selected,
    fromDate: new Date(now - selected.lookbackMs),
  };
}

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function toEpoch(value) {
  if (!value) return null;
  return new Date(value).getTime();
}

function getMeasurementLookback(rangeKey) {
  const now = Date.now();
  const map = {
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  const lookbackMs = map[rangeKey] || map['1h'];
  return new Date(now - lookbackMs);
}

function parseAuditReason(raw) {
  const value = String(raw || '').trim();
  const settingsMatch = value.match(/^\[SETTINGS:ACCESS\]\s*(.*)$/i);
  if (settingsMatch) {
    return { type: 'system', labName: 'Impostazioni', detail: settingsMatch[1].trim() || 'Accesso impostazioni' };
  }
  const disconnect = parseDisconnectReason(value);
  return { type: 'shutdown', ...disconnect };
}

async function insertAuditLog(transactionOrPool, userId, message) {
  const request = new sql.Request(transactionOrPool);
  request.input('motivo', sql.NVarChar(255), message);
  request.input('idUtente', sql.Int, userId);
  await request.query(`
    INSERT INTO DisconnectLog (data, motivo, idUtente)
    VALUES (GETDATE(), @motivo, @idUtente);
  `);
}

async function findAuthorizedUser(transactionOrPool, nome, cognome, password) {
  const request = new sql.Request(transactionOrPool);
  request.input('nome', sql.NVarChar(50), nome);
  request.input('cognome', sql.NVarChar(50), cognome);
  request.input('password', sql.NVarChar(100), password);
  const result = await request.query(`
    SELECT TOP (1) idUtente, nome, cognome
    FROM Users
    WHERE nome = @nome
      AND cognome = @cognome
      AND password = @password
      AND autorizzato = 'S';
  `);
  return result.recordset[0] || null;
}

function buildFallbackChartLabels(rangeKey) {
  const spec = getRangeSpec(rangeKey);
  const labels = [];
  const now = Date.now();
  for (let i = spec.desiredPoints - 1; i >= 0; i -= 1) {
    labels.push(now - i * spec.stepMs);
  }
  return labels;
}

function buildFallbackTrend(baseValue, labels) {
  let current = Number(baseValue || 0);
  return labels.map(() => {
    current += (Math.random() - 0.48) * 0.5;
    current = Math.max(0.04, Math.min(7.8, current));
    return round(current);
  });
}

function createFallbackLabs(rangeKey) {
  const labels = buildFallbackChartLabels(rangeKey);
  const labs = [
    { id: 'lab-1', name: 'Lab1', isOn: true, zone: 'Viale Grigoletti', powerKw: 2.16 },
    { id: 'lab-2', name: 'Lab2', isOn: true, zone: 'Viale Grigoletti', powerKw: 2.84 },
    { id: 'lab-3', name: 'Lab3', isOn: true, zone: 'Polo Tecnologico', powerKw: 3.21 },
    { id: 'lab-4', name: 'Lab4', isOn: true, zone: 'Polo Tecnologico', powerKw: 2.42 },
  ].map((lab, index) => ({
    ...lab,
    color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    trend: buildFallbackTrend(lab.powerKw, labels),
    plcStatus: lab.isOn ? 'Sincronizzato' : 'Standby',
    consumptionToday: round(lab.powerKw * 3.4 + Math.random() * 4, 1),
    lastMeasurementAt: Date.now(),
  }));

  return { labels, labs };
}

function fallbackBootstrap(appDataDir, rangeKey, errorMessage = '') {
  const config = loadDbConfig(appDataDir);
  const fallback = createFallbackLabs(rangeKey);

  return {
    schoolName: config.schoolName,
    refreshedAt: Date.now(),
    chartLabels: fallback.labels,
    labs: fallback.labs,
    alarms: [],
    history: [],
    database: {
      connected: false,
      demoMode: config.demoMode,
      driverAvailable: isDriverAvailable(),
      server: config.server,
      database: config.database,
      lastSync: Date.now(),
      lastError: errorMessage,
      statusLabel: config.demoMode ? 'Demo' : 'Disconnesso',
      usingFallbackData: true,
    },
  };
}

function decodeLabId(labId) {
  if (labId == null) return null;
  const asString = String(labId);
  const matched = asString.match(/(\d+)/);
  return matched ? Number(matched[1]) : Number(asString);
}

function parseDisconnectReason(raw) {
  const value = String(raw || '').trim();
  const match = value.match(/^\[LAB:([^\]]+)\]\s*(.*)$/i);
  if (!match) {
    return { labName: 'N/D', detail: value || 'Nessun dettaglio' };
  }
  return {
    labName: match[1].trim() || 'N/D',
    detail: match[2].trim() || 'Nessun dettaglio',
  };
}

function createTrendsFromMeasurements(labs, measurementRows, chartLabels, rangeKey) {
  const labelsMs = chartLabels.map((iso) => new Date(iso).getTime());
  const grouped = new Map();
  measurementRows.forEach((row) => {
    const key = `lab-${row.idLaboratorio}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({
      time: new Date(row.timestamp).getTime(),
      value: round(row.potenzaAssorbitakW, 3),
    });
  });

  return labs.map((lab) => {
    const series = (grouped.get(lab.id) || []).sort((a, b) => a.time - b.time);
    if (!series.length) {
      return { ...lab, trend: buildFallbackTrend(lab.powerKw, chartLabels) };
    }

    let cursor = 0;
    let lastKnown = round(series[0].value);
    const trend = labelsMs.map((labelMs) => {
      while (cursor < series.length && series[cursor].time <= labelMs) {
        lastKnown = round(series[cursor].value);
        cursor += 1;
      }
      return round(lastKnown);
    });

    return { ...lab, trend };
  });
}

async function fetchBootstrapFromDb(appDataDir, rangeKey) {
  const config = loadDbConfig(appDataDir);
  const pool = await getPool(config);
  const spec = getRangeSpec(rangeKey);

  const request = pool.request();
  request.input('fromDate', spec.fromDate);

  const result = await request.query(`
    SET NOCOUNT ON;

    WITH LatestMeasurements AS (
      SELECT
        em.idLaboratorio,
        em.potenzaAssorbitakW,
        em.[timestamp],
        ROW_NUMBER() OVER (PARTITION BY em.idLaboratorio ORDER BY em.[timestamp] DESC) AS rn
      FROM EnergyMeasurements em
    )
    SELECT
      l.idLaboratorio,
      l.nome,
      l.descrizione,
      l.zonascolastica,
      l.coordGPS,
      l.attivo,
      COALESCE(lm.potenzaAssorbitakW, CASE WHEN l.attivo = 'S' THEN 1.500 ELSE 0 END) AS potenzaAssorbitakW,
      lm.[timestamp] AS lastMeasurementAt
    FROM Laboratories l
    LEFT JOIN LatestMeasurements lm
      ON lm.idLaboratorio = l.idLaboratorio
      AND lm.rn = 1
    ORDER BY l.idLaboratorio;

    SELECT
      em.idLaboratorio,
      em.potenzaAssorbitakW,
      em.[timestamp]
    FROM EnergyMeasurements em
    WHERE em.[timestamp] >= @fromDate
    ORDER BY em.[timestamp] ASC, em.idLaboratorio ASC;

    SELECT TOP (24)
      sa.idAllarme,
      sa.tipo,
      sa.idLaboratorio,
      sa.valoremisurato,
      sa.soglia,
      sa.dataevento,
      l.nome AS laboratorioNome
    FROM SystemAlarms sa
    INNER JOIN Laboratories l ON l.idLaboratorio = sa.idLaboratorio
    ORDER BY sa.dataevento DESC;

    SELECT TOP (40)
      dl.idLog,
      dl.data,
      dl.motivo,
      u.nome,
      u.cognome
    FROM DisconnectLog dl
    INNER JOIN Users u ON u.idUtente = dl.idUtente
    ORDER BY dl.data DESC;
  `);

  const labRows = result.recordsets[0] || [];
  const measurementRows = result.recordsets[1] || [];
  const alarmRows = result.recordsets[2] || [];
  const historyRows = result.recordsets[3] || [];

  let chartLabels = [...new Set(measurementRows.map((row) => toEpoch(row.timestamp)).filter(Boolean))].sort((a, b) => a - b);
  if (!chartLabels.length) {
    chartLabels = buildFallbackChartLabels(rangeKey);
  }

  if (chartLabels.length > spec.desiredPoints) {
    const step = Math.max(1, Math.floor(chartLabels.length / spec.desiredPoints));
    chartLabels = chartLabels.filter((_, index) => index % step === 0).slice(-spec.desiredPoints);
  }

  const rawLabs = labRows.map((row, index) => ({
    id: `lab-${row.idLaboratorio}`,
    numericId: row.idLaboratorio,
    name: row.nome,
    description: row.descrizione || '',
    zone: row.zonascolastica || `Linea ${index + 1}`,
    isOn: String(row.attivo).toUpperCase() === 'S',
    powerKw: round(row.potenzaAssorbitakW),
    color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    plcStatus: String(row.attivo).toUpperCase() === 'S' ? 'Sincronizzato' : 'Standby',
    consumptionToday: round((Number(row.potenzaAssorbitakW || 0) * 3.8) + Math.random() * 2.4, 1),
    lastMeasurementAt: row.lastMeasurementAt ? toEpoch(row.lastMeasurementAt) : null,
  }));

  const labs = createTrendsFromMeasurements(rawLabs, measurementRows, chartLabels, rangeKey);

  const alarms = alarmRows.map((row) => ({
    id: `db-alarm-${row.idAllarme}`,
    type: Number(row.valoremisurato || 0) > Number(row.soglia || 0) ? 'danger' : 'warning',
    title: `${row.laboratorioNome} - ${row.tipo || 'Allarme sistema'}`,
    description: `Valore ${round(row.valoremisurato)} kW / soglia ${round(row.soglia)} kW - ${new Date(row.dataevento).toLocaleString('it-IT')}`,
    labId: `lab-${row.idLaboratorio}`,
    source: 'database',
  }));

  const history = historyRows.map((row) => {
    const parsed = parseAuditReason(row.motivo);
    return {
      id: `db-log-${row.idLog}`,
      type: parsed.type,
      labName: parsed.labName,
      detail: parsed.detail,
      operator: `${row.nome} ${row.cognome}`.trim(),
      at: new Date(row.data).getTime(),
      source: 'database',
    };
  });

  return {
    schoolName: config.schoolName,
    refreshedAt: Date.now(),
    chartLabels,
    labs,
    alarms,
    history,
    database: {
      connected: true,
      demoMode: false,
      driverAvailable: isDriverAvailable(),
      server: config.server,
      database: config.database,
      lastSync: Date.now(),
      lastError: '',
      statusLabel: 'Connesso',
      usingFallbackData: false,
    },
  };
}


function getPlcStatusSummary(config) {
  if (!config.plcEnabled) {
    return {
      enabled: false,
      connected: false,
      protocol: config.plcProtocol,
      endpoint: `${config.plcHost}:${config.plcPort}`,
      lastError: 'Connessione PLC disattivata dalle impostazioni.',
      statusLabel: 'Disattivato',
      pollMs: config.plcPollMs,
    };
  }

  return {
    enabled: true,
    connected: false,
    protocol: config.plcProtocol,
    endpoint: `${config.plcHost}:${config.plcPort}`,
    lastError: '',
    statusLabel: 'Configurato',
    pollMs: config.plcPollMs,
  };
}

function testPlcConnection(appDataDir, partialConfig = null) {
  const config = normalizeDbConfig(partialConfig ? { ...loadDbConfig(appDataDir), ...partialConfig } : loadDbConfig(appDataDir));

  if (!config.plcEnabled) {
    return Promise.resolve({
      ok: true,
      plc: {
        ...getPlcStatusSummary(config),
        connected: false,
        statusLabel: 'Disattivato',
        lastError: 'Connessione PLC disattivata dalle impostazioni.',
        testedAt: new Date().toISOString(),
      },
      message: 'PLC disattivato dalle impostazioni.',
    });
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        ok,
        plc: {
          ...getPlcStatusSummary(config),
          connected: ok,
          statusLabel: ok ? 'Online' : 'Offline',
          lastError: ok ? '' : message,
          testedAt: new Date().toISOString(),
        },
        message,
      });
    };

    socket.setTimeout(config.plcTimeout || 2500);
    socket.once('connect', () => finish(true, 'Connessione PLC raggiungibile.'));
    socket.once('timeout', () => finish(false, 'Timeout connessione PLC.'));
    socket.once('error', (error) => finish(false, error.message || 'PLC non raggiungibile.'));

    try {
      socket.connect(config.plcPort, config.plcHost);
    } catch (error) {
      finish(false, error.message || 'PLC non raggiungibile.');
    }
  });
}

async function getBootstrapData(appDataDir, rangeKey = 'hours') {
  try {
    return await fetchBootstrapFromDb(appDataDir, rangeKey);
  } catch (error) {
    return fallbackBootstrap(appDataDir, rangeKey, error.message);
  }
}

async function testDbConnection(appDataDir, partialConfig = null) {
  const config = normalizeDbConfig(partialConfig ? { ...loadDbConfig(appDataDir), ...partialConfig } : loadDbConfig(appDataDir));

  if (config.demoMode) {
    return {
      ok: true,
      connected: false,
      message: 'Modalità demo attiva. Disattivala per usare SQL Server reale.',
      config,
      driverAvailable: isDriverAvailable(),
    };
  }

  if (!isDriverAvailable()) {
    return {
      ok: false,
      connected: false,
      error: 'Modulo mssql non installato. In Electron Fiddle aggiungi la dipendenza mssql@10.0.4.',
      config,
      driverAvailable: false,
    };
  }

  let pool;
  try {
    pool = await new sql.ConnectionPool(toSqlConfig(config)).connect();
    const response = await pool.request().query('SELECT DB_NAME() AS databaseName, @@SERVERNAME AS serverName, GETDATE() AS serverTime;');
    const row = response.recordset[0] || {};

    return {
      ok: true,
      connected: true,
      message: `Connessione riuscita a ${row.serverName || config.server} / ${row.databaseName || config.database}`,
      config,
      driverAvailable: true,
    };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      error: error.message,
      config,
      driverAvailable: isDriverAvailable(),
    };
  } finally {
    if (pool) await pool.close().catch(() => null);
  }
}

async function shutdownLab(appDataDir, payload) {
  const config = loadDbConfig(appDataDir);
  const nome = String(payload?.operator?.nome || '').trim();
  const cognome = String(payload?.operator?.cognome || '').trim();
  const password = String(payload?.operator?.password || '').trim();
  const reason = String(payload?.reason || '').trim();
  const labNumericId = decodeLabId(payload?.labId);

  if (!nome || !cognome || !password || !reason) {
    return { ok: false, error: 'Compila tutti i campi richiesti prima di confermare lo spegnimento.' };
  }

  if (config.demoMode || !isDriverAvailable()) {
    if (!(nome === 'q' && cognome === 'q' && password === 'q')) {
      return {
        ok: false,
        error: 'In modalità demo le credenziali valide sono nome q, cognome q, password q.',
      };
    }

    return {
      ok: true,
      updated: {
        id: payload.labId,
        isOn: false,
        powerKw: 0,
        lastActionAt: Date.now(),
      },
      mode: 'demo',
    };
  }

  let transaction;
  try {
    const pool = await getPool(config);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const user = await findAuthorizedUser(transaction, nome, cognome, password);

    if (!user) {
      await transaction.rollback();
      return { ok: false, error: 'Utente non autorizzato o credenziali non valide.' };
    }

    const labRequest = new sql.Request(transaction);
    labRequest.input('idLaboratorio', sql.Int, labNumericId);
    const labResult = await labRequest.query(`
      SELECT TOP (1) idLaboratorio, nome, attivo
      FROM Laboratories
      WHERE idLaboratorio = @idLaboratorio;
    `);

    if (!labResult.recordset.length) {
      await transaction.rollback();
      return { ok: false, error: 'Laboratorio non trovato nel database.' };
    }

    const lab = labResult.recordset[0];

    const updateRequest = new sql.Request(transaction);
    updateRequest.input('idLaboratorio', sql.Int, labNumericId);
    await updateRequest.query(`
      UPDATE Laboratories
      SET attivo = 'N'
      WHERE idLaboratorio = @idLaboratorio;
    `);

    await insertAuditLog(transaction, user.idUtente, `[LAB:${lab.nome}] ${reason}`);

    const measurementRequest = new sql.Request(transaction);
    measurementRequest.input('idLaboratorio', sql.Int, labNumericId);
    measurementRequest.input('potenzaAssorbitakW', sql.Decimal(10, 3), 0);
    await measurementRequest.query(`
      INSERT INTO EnergyMeasurements (idLaboratorio, potenzaAssorbitakW, [timestamp])
      VALUES (@idLaboratorio, @potenzaAssorbitakW, GETDATE());
    `);

    await transaction.commit();

    return {
      ok: true,
      updated: {
        id: `lab-${labNumericId}`,
        isOn: false,
        powerKw: 0,
        lastActionAt: Date.now(),
      },
      operator: `${user.nome} ${user.cognome}`.trim(),
      mode: 'database',
    };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => null);
    return { ok: false, error: `Errore database in spegnimento: ${error.message}` };
  }
}

async function startLab(appDataDir, labId) {
  const config = loadDbConfig(appDataDir);
  const numericId = decodeLabId(labId);
  const simulatedPower = round(1.6 + Math.random() * 1.8, 3);

  if (config.demoMode || !isDriverAvailable()) {
    return {
      ok: true,
      updated: {
        id: labId,
        isOn: true,
        powerKw: simulatedPower,
        lastActionAt: Date.now(),
      },
      mode: 'demo',
    };
  }

  try {
    const pool = await getPool(config);

    const updateRequest = pool.request();
    updateRequest.input('idLaboratorio', sql.Int, numericId);
    await updateRequest.query(`
      UPDATE Laboratories
      SET attivo = 'S'
      WHERE idLaboratorio = @idLaboratorio;
    `);

    const measurementRequest = pool.request();
    measurementRequest.input('idLaboratorio', sql.Int, numericId);
    measurementRequest.input('potenzaAssorbitakW', sql.Decimal(10, 3), simulatedPower);
    await measurementRequest.query(`
      INSERT INTO EnergyMeasurements (idLaboratorio, potenzaAssorbitakW, [timestamp])
      VALUES (@idLaboratorio, @potenzaAssorbitakW, GETDATE());
    `);

    return {
      ok: true,
      updated: {
        id: `lab-${numericId}`,
        isOn: true,
        powerKw: simulatedPower,
        lastActionAt: Date.now(),
      },
      mode: 'database',
    };
  } catch (error) {
    return { ok: false, error: `Errore database in accensione: ${error.message}` };
  }
}


async function getMeasurementHistory(appDataDir, labId, rangeKey = '1h') {
  const config = loadDbConfig(appDataDir);
  const numericId = decodeLabId(labId);
  const fromDate = getMeasurementLookback(rangeKey);

  if (config.demoMode || !isDriverAvailable()) {
    const labels = buildFallbackChartLabels('hours');
    const base = 2 + Math.random() * 2;
    const trend = buildFallbackTrend(base, labels);
    return {
      ok: true,
      points: labels.map((at, index) => ({ at, kw: trend[index] })),
      mode: 'demo',
    };
  }

  try {
    const pool = await getPool(config);
    const request = pool.request();
    request.input('idLaboratorio', sql.Int, numericId);
    request.input('fromDate', sql.DateTime, fromDate);
    const result = await request.query(`
      SELECT em.[timestamp], em.potenzaAssorbitakW, l.nome
      FROM EnergyMeasurements em
      INNER JOIN Laboratories l ON l.idLaboratorio = em.idLaboratorio
      WHERE em.idLaboratorio = @idLaboratorio
        AND em.[timestamp] >= @fromDate
      ORDER BY em.[timestamp] DESC;
    `);

    return {
      ok: true,
      points: (result.recordset || []).map((row) => ({
        at: toEpoch(row.timestamp),
        kw: round(row.potenzaAssorbitakW, 3),
        labName: row.nome,
      })),
      mode: 'database',
    };
  } catch (error) {
    return { ok: false, error: `Errore storico consumi: ${error.message}`, points: [] };
  }
}

async function authorizeSettingsAccess(appDataDir, payload) {
  const config = loadDbConfig(appDataDir);
  const nome = String(payload?.nome || '').trim();
  const cognome = String(payload?.cognome || '').trim();
  const password = String(payload?.password || '').trim();

  if (!nome || !cognome || !password) {
    return { ok: false, error: 'Inserisci nome, cognome e password.' };
  }

  if (config.demoMode || !isDriverAvailable()) {
    if (!(nome === 'q' && cognome === 'q' && password === 'q')) {
      return { ok: false, error: 'In modalità demo usa nome q, cognome q e password q.' };
    }
    return { ok: true, operator: `${nome} ${cognome}`.trim(), mode: 'demo' };
  }

  try {
    const pool = await getPool(config);
    const user = await findAuthorizedUser(pool, nome, cognome, password);
    if (!user) {
      return { ok: false, error: 'Credenziali non valide o utente non autorizzato.' };
    }
    await insertAuditLog(pool, user.idUtente, '[SETTINGS:ACCESS] Accesso impostazioni autorizzato');
    return { ok: true, operator: `${user.nome} ${user.cognome}`.trim(), mode: 'database' };
  } catch (error) {
    return { ok: false, error: `Errore accesso impostazioni: ${error.message}` };
  }
}

module.exports = {
  DEFAULT_DB_CONFIG,
  isDriverAvailable,
  loadDbConfig,
  saveDbConfig,
  testDbConnection,
  getBootstrapData,
  shutdownLab,
  startLab,
  getMeasurementHistory,
  authorizeSettingsAccess,
};
