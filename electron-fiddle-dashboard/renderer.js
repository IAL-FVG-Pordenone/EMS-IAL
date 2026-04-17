const PAGE_META = {
  dashboard: {
    title: 'Dashboard generale',
    subtitle: "Vista realtime dei laboratori e dello stato dell'impianto.",
  },
  laboratori: {
    title: 'Pagina laboratori',
    subtitle: 'Dettaglio completo dei laboratori con azioni puntuali.',
  },
  allarmi: {
    title: 'Pagina allarmi',
    subtitle: 'Presa in carico, focus e monitoraggio degli allarmi attivi.',
  },
  storico: {
    title: 'Pagina storico',
    subtitle: 'Log completo di sistema, allarmi, accensioni e spegnimenti.',
  },
  impostazioni: {
    title: 'Pagina impostazioni',
    subtitle: 'Configurazione dashboard, connessione database e servizi software.',
  },
};

const RANGE_META = {
  hours: { label: 'Ore', points: 12, stepMs: 60 * 60 * 1000, variance: 0.55 },
  days: { label: 'Giorni', points: 10, stepMs: 24 * 60 * 60 * 1000, variance: 0.42 },
  months: { label: 'Mesi', points: 8, stepMs: 30 * 24 * 60 * 60 * 1000, variance: 0.38 },
  quarter: { label: '3 mesi', points: 8, stepMs: 15 * 24 * 60 * 60 * 1000, variance: 0.3 },
  years: { label: 'Anni', points: 6, stepMs: 365 * 24 * 60 * 60 * 1000, variance: 0.22 },
};

const DEFAULT_SETTINGS = {
  realtimeActive: true,
  glowEffects: true,
  alarmSound: false,
};

const DEFAULT_DB_FORM = {
  server: 'localhost',
  port: 1433,
  database: 'EMS-IAL',
  user: '',
  password: '',
  instanceName: '',
  demoMode: true,
  encrypt: false,
  trustServerCertificate: true,
  schoolName: 'Istituto Tecnico - Monitoraggio Energetico',
  settingsRequireAuth: false,
};

const state = {
  schoolName: 'Monitoraggio energetico',
  activePage: 'dashboard',
  sidebarCollapsed: false,
  timeRange: 'hours',
  historyFilter: 'all',
  settings: { ...DEFAULT_SETTINGS },
  dbConfig: { ...DEFAULT_DB_FORM },
  database: {
    connected: false,
    demoMode: true,
    driverAvailable: false,
    usingFallbackData: true,
    lastError: '',
  },
  chartHover: null,
  labs: [],
  alarms: [],
  chartLabels: [],
  focusLabId: null,
  refreshTimer: null,
  acknowledgedAlarmIds: new Set(),
  localHistory: [],
  remoteHistory: [],
  transientAlarmSerial: 0,
  settingsAccessGranted: false,
  settingsAccessOperator: '',
  settingsHistoryRangeByLab: {},
  measurementHistoryByLab: {},
};

const refs = {
  appRoot: document.getElementById('appRoot'),
  navList: document.getElementById('navList'),
  pageTitle: document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  lastRefresh: document.getElementById('lastRefresh'),
  sidebarStatusTitle: document.getElementById('sidebarStatusTitle'),
  sidebarStatusBadge: document.getElementById('sidebarStatusBadge'),
  sidebarRealtimeState: document.getElementById('sidebarRealtimeState'),
  sidebarDbState: document.getElementById('sidebarDbState'),
  sidebarLastSync: document.getElementById('sidebarLastSync'),
  systemStateBadge: document.getElementById('systemStateBadge'),
  systemRealtimeText: document.getElementById('systemRealtimeText'),
  systemDbText: document.getElementById('systemDbText'),
  systemSignalText: document.getElementById('systemSignalText'),
  systemSampleText: document.getElementById('systemSampleText'),
  metricsGrid: document.getElementById('metricsGrid'),
  dashboardLabStrip: document.getElementById('dashboardLabStrip'),
  laboratoriGrid: document.getElementById('laboratoriGrid'),
  dashboardAlarmPreview: document.getElementById('dashboardAlarmPreview'),
  alarmManagementGrid: document.getElementById('alarmManagementGrid'),
  historyTableBody: document.getElementById('historyTableBody'),
  chartLegend: document.getElementById('chartLegend'),
  energyChart: document.getElementById('energyChart'),
  timeFilterGroup: document.getElementById('timeFilterGroup'),
  historyFilterGroup: document.getElementById('historyFilterGroup'),
  shutdownModal: document.getElementById('shutdownModal'),
  settingsAuthModal: document.getElementById('settingsAuthModal'),
  settingsAuthForm: document.getElementById('settingsAuthForm'),
  settingsAuthError: document.getElementById('settingsAuthError'),
  settingsNome: document.getElementById('settingsNome'),
  settingsCognome: document.getElementById('settingsCognome'),
  settingsPassword: document.getElementById('settingsPassword'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  cancelSettingsModalBtn: document.getElementById('cancelSettingsModalBtn'),
  shutdownForm: document.getElementById('shutdownForm'),
  shutdownLabId: document.getElementById('shutdownLabId'),
  operatorNome: document.getElementById('operatorNome'),
  operatorCognome: document.getElementById('operatorCognome'),
  operatorPassword: document.getElementById('operatorPassword'),
  shutdownReason: document.getElementById('shutdownReason'),
  shutdownError: document.getElementById('shutdownError'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  toastStack: document.getElementById('toastStack'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetDemoBtn: document.getElementById('resetDemoBtn'),
  simulateAlarmBtn: document.getElementById('simulateAlarmBtn'),
  dbServer: document.getElementById('dbServer'),
  dbPort: document.getElementById('dbPort'),
  dbName: document.getElementById('dbName'),
  dbUser: document.getElementById('dbUser'),
  dbPassword: document.getElementById('dbPassword'),
  dbInstance: document.getElementById('dbInstance'),
  dbSchoolName: document.getElementById('dbSchoolName'),
  dbDemoMode: document.getElementById('dbDemoMode'),
  dbEncrypt: document.getElementById('dbEncrypt'),
  dbTrust: document.getElementById('dbTrust'),
  settingsRequireAuth: document.getElementById('settingsRequireAuth'),
  testDbConnectionBtn: document.getElementById('testDbConnectionBtn'),
  dbStatusLabel: document.getElementById('dbStatusLabel'),
  dbDriverLabel: document.getElementById('dbDriverLabel'),
  dbStatusText: document.getElementById('dbStatusText'),
  dbLastError: document.getElementById('dbLastError'),
  chartTooltip: document.getElementById('chartTooltip'),
};

function formatClock(date) {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDateTime(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(safeDate);
}

function formatXAxisLabel(date, rangeKey) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (rangeKey === 'hours') {
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(safeDate);
  }

  if (rangeKey === 'days') {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(safeDate);
  }

  if (rangeKey === 'months' || rangeKey === 'quarter') {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(safeDate);
  }

  return new Intl.DateTimeFormat('it-IT', { year: 'numeric' }).format(safeDate);
}

function formatPower(value) {
  return `${Number(value || 0).toFixed(2)} kW`;
}

function formatHoverDate(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(safeDate);
}

function getLabLatestValue(lab) {
  const values = Array.isArray(lab?.trend) ? lab.trend : [];
  const index = Math.max(0, values.length - 1);
  return {
    value: Number(values[index] ?? lab?.powerKw ?? 0),
    label: state.chartLabels[index] || Date.now(),
  };
}

function getStatusChip(lab) {
  if (lab.isOn) return '<span class="chip chip--ok">Attivo</span>';
  return '<span class="chip chip--danger">Spento</span>';
}

function getHistoryTypeLabel(type) {
  return {
    shutdown: 'Spegnimento',
    start: 'Accensione',
    alarm: 'Allarme',
    system: 'Sistema',
  }[type] || type;
}

function sparklineSvg(points, color) {
  const width = 220;
  const height = 72;
  const padding = 4;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 0.1);

  const line = points
    .map((value, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${line}"></polyline>
    </svg>
  `;
}

function buildChartLabels() {
  const meta = RANGE_META[state.timeRange];
  const now = Date.now();
  state.chartLabels = Array.from({ length: meta.points }, (_, index) => {
    const offset = (meta.points - 1 - index) * meta.stepMs;
    return now - offset;
  });
}

function formatRelativeRangeLabel(rangeKey) {
  return { '1h': '1h fa', '1d': '1 giorno fa', '7d': '7 giorni', '30d': '30 giorni', '90d': '90 giorni' }[rangeKey] || rangeKey;
}

function getLabChartPoints(lab) {
  const labels = state.chartLabels || [];
  const values = Array.isArray(lab?.trend) ? lab.trend : [];
  return values.map((value, index) => ({ at: labels[index], kw: Number(value || 0) })).filter((item) => item.at != null);
}

function miniTrendSvg(lab) {
  const points = getLabChartPoints(lab);
  const width = 520;
  const height = 190;
  const left = 52;
  const right = 16;
  const top = 12;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const values = points.map((p) => p.kw);
  const max = Math.max(4, ...values, Number(lab?.powerKw || 0));
  const stepX = chartWidth / Math.max(points.length - 1, 1);
  const toX = (i) => left + i * stepX;
  const toY = (v) => top + chartHeight - (Number(v || 0) / Math.max(max, 0.1)) * chartHeight;
  const poly = points.map((p, i) => `${toX(i)},${toY(p.kw)}`).join(' ');
  const yTicks = [max, max * 0.5, 0];
  const xIdx = [0, Math.max(0, Math.floor((points.length - 1) / 2)), Math.max(0, points.length - 1)];
  return `
    <svg class="lab-trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Storico consumi ${lab.name}">
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartHeight}" class="chart-axis"></line>
      <line x1="${left}" y1="${top + chartHeight}" x2="${left + chartWidth}" y2="${top + chartHeight}" class="chart-axis"></line>
      ${yTicks.map((tick, idx) => { const y = top + (chartHeight / 2) * idx; return `<g><line x1="${left}" y1="${y}" x2="${left + chartWidth}" y2="${y}" class="chart-grid"></line><text x="8" y="${y + 4}" class="chart-text">${Number(tick).toFixed(1)} kW</text></g>`; }).join('')}
      ${xIdx.map((idx) => { const item = points[idx]; if (!item) return ''; const x = toX(idx); return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="chart-text">${formatXAxisLabel(item.at, state.timeRange)}</text>`; }).join('')}
      <polyline fill="none" stroke="${lab.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${poly}"></polyline>
      ${points.length ? `<circle cx="${toX(points.length - 1)}" cy="${toY(points[points.length - 1].kw)}" r="4" fill="${lab.color}"></circle>` : ''}
    </svg>
  `;
}

function getMeasurementHistoryPoints(labId) {
  return state.measurementHistoryByLab[labId] || [];
}


function buildTrend(baseValue, rangeKey) {
  const meta = RANGE_META[rangeKey];
  const points = [];
  let current = Number(baseValue || 0);

  for (let index = 0; index < meta.points; index += 1) {
    current += (Math.random() - 0.48) * meta.variance * 2;
    current = Math.max(0.04, Math.min(8.2, current));
    points.push(Number(current.toFixed(2)));
  }

  return points;
}

function normalizeLabs(labs) {
  return (labs || []).map((lab, index) => ({
    ...lab,
    color: lab.color || ['#5cc8ff', '#8f7cff', '#44f5b1', '#ff8bd6', '#ffba52'][index % 5],
    trend: Array.isArray(lab.trend) && lab.trend.length ? lab.trend : buildTrend(lab.powerKw, state.timeRange),
    consumptionToday: Number((lab.consumptionToday ?? (lab.powerKw * 3.8 + Math.random() * 4)).toFixed(1)),
    zone: lab.zone || `Linea ${index + 1}`,
  }));
}

function getMetricCards() {
  const activeCount = state.labs.filter((lab) => lab.isOn).length;
  const totalPower = state.labs.reduce((sum, lab) => sum + Number(lab.powerKw || 0), 0);
  const avgPower = state.labs.length ? totalPower / state.labs.length : 0;

  return [
    { label: 'Laboratori attivi', value: String(activeCount) },
    { label: 'Consumo totale', value: formatPower(totalPower) },
    { label: 'Allarmi aperti', value: String(state.alarms.length) },
    { label: 'Media per aula', value: formatPower(avgPower) },
  ];
}

function addHistoryEvent(type, labName, detail, operator = 'Sistema') {
  state.localHistory.unshift({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    labName,
    detail,
    operator,
    at: new Date(),
    source: 'local',
  });

  state.localHistory = state.localHistory.slice(0, 80);
}

function getCombinedHistory() {
  return [...state.localHistory, ...state.remoteHistory].sort((a, b) => new Date(b.at) - new Date(a.at));
}

function computeAlarms() {
  const alarms = [];

  state.labs.forEach((lab) => {
    if (lab.isOn && Number(lab.powerKw || 0) >= 5.4) {
      alarms.push({
        id: `${lab.id}-high`,
        type: 'danger',
        title: `${lab.name} oltre soglia`,
        description: `Consumo attuale ${formatPower(lab.powerKw)}`,
        labId: lab.id,
      });
    }

    if (!lab.isOn && Number(lab.powerKw || 0) >= 0.3) {
      alarms.push({
        id: `${lab.id}-ghost`,
        type: 'warning',
        title: `${lab.name} con carico residuo`,
        description: `Assorbimento residuo rilevato: ${formatPower(lab.powerKw)}`,
        labId: lab.id,
      });
    }
  });

  state.alarms
    .filter((alarm) => alarm.source === 'database')
    .forEach((alarm) => alarms.push(alarm));

  if (!state.settings.realtimeActive) {
    alarms.unshift({
      id: 'realtime-paused',
      type: 'warning',
      title: 'Monitoraggio realtime sospeso',
      description: 'La ricezione dei dati realtime è stata fermata dalle impostazioni.',
      labId: null,
    });
  }

  state.alarms = alarms.filter((alarm) => !state.acknowledgedAlarmIds.has(alarm.id)).slice(0, 16);
}

function renderTopbar() {
  const meta = PAGE_META[state.activePage];
  refs.pageTitle.textContent = meta.title;
  refs.pageSubtitle.textContent = meta.subtitle;
  refs.lastRefresh.textContent = formatClock(new Date());
  refs.sidebarLastSync.textContent = formatClock(new Date());
}

function renderSidebar() {
  const buttons = refs.navList.querySelectorAll('[data-page]');
  buttons.forEach((button) => {
    button.classList.toggle('nav-btn--active', button.dataset.page === state.activePage);
  });

  refs.sidebarStatusTitle.textContent = 'Monitoraggio realtime';
  if (!state.settings.realtimeActive) {
    refs.sidebarStatusBadge.textContent = 'Sospeso';
    refs.sidebarStatusBadge.className = 'chip chip--danger';
    refs.sidebarRealtimeState.textContent = 'Pausa';
    refs.sidebarRealtimeState.className = 'micro micro--danger';
  } else {
    refs.sidebarStatusBadge.textContent = 'Attivo';
    refs.sidebarStatusBadge.className = 'chip chip--ok';
    refs.sidebarRealtimeState.textContent = 'Streaming';
    refs.sidebarRealtimeState.className = 'micro micro--ok';
  }

  if (refs.sidebarDbState) {
    if (state.database.connected) {
      refs.sidebarDbState.textContent = 'Connesso';
      refs.sidebarDbState.className = 'micro micro--ok';
    } else if (state.database.demoMode) {
      refs.sidebarDbState.textContent = 'Demo';
      refs.sidebarDbState.className = 'micro micro--info';
    } else {
      refs.sidebarDbState.textContent = 'Disconnesso';
      refs.sidebarDbState.className = 'micro micro--danger';
    }
  }
}

function renderPages() {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('page--active', page.dataset.page === state.activePage);
  });
}

function renderMetrics() {
  refs.metricsGrid.innerHTML = getMetricCards()
    .map(
      (metric) => `
        <article class="metric-card">
          <span>${metric.label}</span>
          <strong>${metric.value}</strong>
        </article>
      `,
    )
    .join('');
}

function renderChartLegend() {
  refs.chartLegend.innerHTML = state.labs
    .map(
      (lab) => `
        <button class="legend-item ${state.chartHover?.labName === lab.name ? 'legend-item--active' : ''}" type="button" data-select-series="${lab.id}">
          <span class="legend-color" style="background:${lab.color}"></span>
          <div class="legend-item__meta">
            <span>${lab.name}</span>
            <small>${formatPower(getLabLatestValue(lab).value)} · ${formatHoverDate(getLabLatestValue(lab).label)}</small>
          </div>
        </button>
      `,
    )
    .join('');
}


function renderDashboardLabStrip() {
  refs.dashboardLabStrip.innerHTML = state.labs
    .map(
      (lab) => `
        <article class="lab-card">
          <div class="lab-card__top">
            <div class="lab-meta">
              <span>${lab.zone}</span>
              <strong>${lab.name}</strong>
            </div>
            ${getStatusChip(lab)}
          </div>
          <div class="lab-meta">
            <span>Consumo istantaneo</span>
            <strong>${formatPower(lab.powerKw)}</strong>
          </div>
          ${sparklineSvg(lab.trend, lab.color)}
          <div class="mini-chart-meta">
            <span>Ultimo campione: ${formatHoverDate(getLabLatestValue(lab).label)}</span>
            <strong>${formatPower(getLabLatestValue(lab).value)}</strong>
          </div>
          <div class="lab-card__actions">
            <button class="ghost-btn ghost-btn--small" type="button" data-focus-lab="${lab.id}">
              <svg><use href="#icon-eye"></use></svg>
              <span>Dettaglio</span>
            </button>
            ${lab.isOn ? `
              <button class="primary-btn" type="button" data-shutdown-lab="${lab.id}">
                <svg><use href="#icon-power"></use></svg>
                <span>Spegni</span>
              </button>
            ` : `
              <button class="primary-btn" type="button" data-start-lab="${lab.id}">
                <svg><use href="#icon-play"></use></svg>
                <span>Accendi</span>
              </button>
            `}
          </div>
        </article>
      `,
    )
    .join('');
}

function renderLaboratoriPage() {
  refs.laboratoriGrid.innerHTML = state.labs
    .map((lab) => {
      const historyRange = state.settingsHistoryRangeByLab[lab.id] || '1h';
      const historyPoints = getMeasurementHistoryPoints(lab.id);
      return `
        <article class="lab-card lab-card--large ${state.focusLabId === lab.id ? 'lab-card--focus' : ''}" id="lab-card-${lab.id}">
          <div class="lab-card__top">
            <div class="lab-meta">
              <span>${lab.zone}</span>
              <strong>${lab.name}</strong>
            </div>
            ${getStatusChip(lab)}
          </div>

          <div class="lab-stats">
            <div class="stat-box">
              <span>Potenza</span>
              <strong>${formatPower(lab.powerKw)}</strong>
            </div>
            <div class="stat-box">
              <span>Consumo oggi</span>
              <strong>${lab.consumptionToday} kWh</strong>
            </div>
            <div class="stat-box">
              <span>Range grafico</span>
              <strong>${RANGE_META[state.timeRange].label}</strong>
            </div>
            <div class="stat-box">
              <span>Ultimo campione</span>
              <strong>${formatHoverDate(getLabLatestValue(lab).label)}</strong>
            </div>
          </div>

          ${miniTrendSvg(lab)}
          <div class="mini-chart-meta mini-chart-meta--full">
            <span>Ultimo valore misurato</span>
            <strong>${formatPower(getLabLatestValue(lab).value)} · ${formatHoverDate(getLabLatestValue(lab).label)}</strong>
          </div>

          <div class="lab-card__actions">
            <button class="ghost-btn" type="button" data-toggle-history="${lab.id}">
              <svg><use href="#icon-history"></use></svg>
              <span>${lab.historyOpen ? 'Chiudi storico' : 'Apri storico'}</span>
            </button>
            ${lab.isOn ? `
              <button class="primary-btn" type="button" data-shutdown-lab="${lab.id}">
                <svg><use href="#icon-power"></use></svg>
                <span>Spegni laboratorio</span>
              </button>
            ` : `
              <button class="primary-btn" type="button" data-start-lab="${lab.id}">
                <svg><use href="#icon-play"></use></svg>
                <span>Accendi laboratorio</span>
              </button>
            `}
          </div>

          ${lab.historyOpen ? `
            <div class="lab-history-panel panel panel--soft">
              <div class="lab-history-panel__head">
                <div>
                  <p class="eyebrow">Storico consumi</p>
                  <h3>${lab.name}</h3>
                </div>
                <div class="segmented segmented--compact">
                  ${['1h','1d','7d','30d','90d'].map((key) => `<button class="segmented__btn ${historyRange === key ? 'segmented__btn--active' : ''}" type="button" data-history-range="${key}" data-history-lab="${lab.id}">${formatRelativeRangeLabel(key)}</button>`).join('')}
                </div>
              </div>
              <div class="table-wrap table-wrap--compact">
                <table>
                  <thead>
                    <tr>
                      <th>Data / Ora</th>
                      <th>Consumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${historyPoints.length ? historyPoints.map((point) => `<tr><td>${formatDateTime(point.at)}</td><td>${formatPower(point.kw)}</td></tr>`).join('') : '<tr><td colspan="2"><div class="empty-state">Nessun dato disponibile per il range selezionato.</div></td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </article>
      `;
    })
    .join('');
}


function renderDashboardAlarms() {
  if (!state.alarms.length) {
    refs.dashboardAlarmPreview.innerHTML = '<div class="empty-state">Nessun allarme aperto in questo momento.</div>';
    return;
  }

  refs.dashboardAlarmPreview.innerHTML = state.alarms
    .slice(0, 4)
    .map(
      (alarm) => `
        <article class="alarm-inline alarm-inline--${alarm.type}">
          <strong>${alarm.title}</strong>
          <p>${alarm.description}</p>
        </article>
      `,
    )
    .join('');
}

function renderAlarmPage() {
  if (!state.alarms.length) {
    refs.alarmManagementGrid.innerHTML = '<div class="empty-state">Tutti gli allarmi risultano chiusi o presi in carico.</div>';
    return;
  }

  refs.alarmManagementGrid.innerHTML = state.alarms
    .map(
      (alarm) => `
        <article class="alarm-card alarm-card--${alarm.type}">
          <strong>${alarm.title}</strong>
          <p>${alarm.description}</p>
          <div class="alarm-card__actions">
            <button class="ghost-btn ghost-btn--small" type="button" data-ack-alarm="${alarm.id}">
              <svg><use href="#icon-check"></use></svg>
              <span>Prendi in carico</span>
            </button>
            ${alarm.labId ? `
              <button class="ghost-btn ghost-btn--small" type="button" data-focus-lab="${alarm.labId}">
                <svg><use href="#icon-eye"></use></svg>
                <span>Vai al laboratorio</span>
              </button>
            ` : ''}
          </div>
        </article>
      `,
    )
    .join('');
}

function renderHistoryPage() {
  const filtered = getCombinedHistory().filter((entry) => {
    if (state.historyFilter === 'all') return true;
    return entry.type === state.historyFilter;
  });

  if (!filtered.length) {
    refs.historyTableBody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Nessun evento per il filtro selezionato.</div></td></tr>';
    return;
  }

  refs.historyTableBody.innerHTML = filtered
    .map(
      (entry) => `
        <tr>
          <td>${formatDateTime(entry.at)}</td>
          <td>${getHistoryTypeLabel(entry.type)}</td>
          <td>${entry.labName}</td>
          <td>${entry.detail}</td>
          <td>${entry.operator}</td>
        </tr>
      `,
    )
    .join('');

  refs.historyFilterGroup.querySelectorAll('[data-history-filter]').forEach((button) => {
    button.classList.toggle('segmented__btn--active', button.dataset.historyFilter === state.historyFilter);
  });
}

function renderSettingsPage() {
  document.querySelectorAll('[data-setting]').forEach((button) => {
    const key = button.dataset.setting;
    const isOn = Boolean(state.settings[key]);
    button.classList.toggle('is-on', isOn);
    button.setAttribute('aria-pressed', String(isOn));
  });

  if (state.settings.glowEffects) {
    document.body.classList.remove('glow-disabled');
  } else {
    document.body.classList.add('glow-disabled');
  }

  if (refs.dbStatusLabel) {
    if (state.database.connected) {
      refs.dbStatusLabel.textContent = 'Connesso';
      refs.dbStatusLabel.className = 'chip chip--ok';
    } else if (state.dbConfig.demoMode) {
      refs.dbStatusLabel.textContent = 'Demo';
      refs.dbStatusLabel.className = 'chip chip--info';
    } else {
      refs.dbStatusLabel.textContent = 'Disconnesso';
      refs.dbStatusLabel.className = 'chip chip--danger';
    }
  }

  if (refs.dbDriverLabel) {
    refs.dbDriverLabel.textContent = state.database.driverAvailable ? 'mssql pronto' : 'mssql assente';
    refs.dbDriverLabel.className = state.database.driverAvailable ? 'chip chip--ok' : 'chip chip--danger';
  }

  if (refs.dbStatusText) {
    if (state.database.connected) {
      refs.dbStatusText.textContent = `Server ${state.database.server || state.dbConfig.server} / DB ${state.database.database || state.dbConfig.database}`;
    } else if (state.dbConfig.demoMode) {
      refs.dbStatusText.textContent = 'La dashboard usa dati demo locali finché la modalità demo resta attiva.';
    } else {
      refs.dbStatusText.textContent = 'Connessione reale non disponibile. Controlla parametri e rete.';
    }
  }

  if (refs.dbLastError) {
    refs.dbLastError.textContent = state.database.lastError || 'Nessun errore recente.';
  }

}

function renderSystemStatus() {
  refs.systemSampleText.textContent = formatClock(new Date());

  if (state.settings.realtimeActive) {
    refs.systemStateBadge.textContent = 'Attivo';
    refs.systemStateBadge.className = 'chip chip--ok';
    refs.systemRealtimeText.textContent = 'Monitoraggio realtime attivo';
    refs.systemSignalText.textContent = 'Flusso dati regolare';
  } else {
    refs.systemStateBadge.textContent = 'Sospeso';
    refs.systemStateBadge.className = 'chip chip--danger';
    refs.systemRealtimeText.textContent = 'Monitoraggio realtime sospeso';
    refs.systemSignalText.textContent = 'Flusso dati in pausa';
  }

  if (state.database.connected) {
    refs.systemDbText.textContent = `Connessione attiva a ${state.database.database || state.dbConfig.database}`;
  } else if (state.dbConfig.demoMode) {
    refs.systemDbText.textContent = 'Modalità demo attiva';
  } else {
    refs.systemDbText.textContent = state.database.lastError || 'Database non connesso';
  }
}


function drawChart() {
  const canvas = refs.energyChart;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(Math.floor(rect.width || canvas.width), 300);
  const height = 430;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const top = 28;
  const left = 62;
  const right = 20;
  const bottom = 56;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(8, ...state.labs.flatMap((lab) => lab.trend || [0]).map((value) => Number(value || 0) + 1));

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + chartWidth, y);
    ctx.stroke();
  }

  const labelCount = Math.min(state.chartLabels.length, 6);
  for (let i = 0; i < labelCount; i += 1) {
    const ratioX = labelCount === 1 ? 0 : i / (labelCount - 1);
    const x = left + ratioX * chartWidth;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + chartHeight);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(143,167,195,0.85)';
  ctx.font = '12px Inter, sans-serif';
  [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].forEach((tick, index) => {
    const y = top + (chartHeight / 4) * index;
    ctx.fillText(`${Number(tick).toFixed(1)} kW`, 10, y + 4);
  });

  const step = Math.max(1, Math.floor((state.chartLabels.length - 1) / Math.max(labelCount - 1, 1)));
  state.chartLabels.forEach((labelDate, index) => {
    if (index % step !== 0 && index !== state.chartLabels.length - 1) return;
    const x = left + (index / Math.max(state.chartLabels.length - 1, 1)) * chartWidth;
    ctx.fillText(formatXAxisLabel(labelDate, state.timeRange), x - 18, height - 20);
  });

  state.labs.forEach((lab) => {
    const values = lab.trend;
    if (!values || !values.length) return;

    const points = [];
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = left + (index / Math.max(values.length - 1, 1)) * chartWidth;
      const y = top + chartHeight - (Number(value || 0) / maxValue) * chartHeight;
      points.push({ x, y, value: Number(value || 0), label: state.chartLabels[index] });
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = lab.color;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    if (state.chartHover && state.chartHover.labName === lab.name && points[state.chartHover.index]) {
      const hoverPoint = points[state.chartHover.index];
      ctx.beginPath();
      ctx.fillStyle = lab.color;
      ctx.arc(hoverPoint.x, hoverPoint.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
}

function updateChartTooltip(event) {
  const canvas = refs.energyChart;
  const tooltip = refs.chartTooltip;
  if (!canvas || !tooltip || !state.chartLabels.length) return;

  const rect = canvas.getBoundingClientRect();
  const left = 62;
  const right = 20;
  const chartWidth = rect.width - left - right;
  const x = event.clientX - rect.left;

  if (x < left || x > left + chartWidth) {
    hideChartTooltip();
    return;
  }

  const index = Math.max(0, Math.min(state.chartLabels.length - 1, Math.round(((x - left) / Math.max(chartWidth, 1)) * (state.chartLabels.length - 1))));
  let targetLab = state.labs[0];
  if (!targetLab) return;

  if (state.chartHover?.labName) {
    targetLab = state.labs.find((lab) => lab.name === state.chartHover.labName) || targetLab;
  }

  state.chartHover = { index, labName: targetLab.name };
  tooltip.hidden = false;
  tooltip.innerHTML = `<strong>${targetLab.name}</strong><span>${formatHoverDate(state.chartLabels[index])}</span><span>${formatPower(targetLab.trend?.[index] ?? targetLab.powerKw)}</span>`;
  tooltip.style.left = `${Math.min(rect.width - 24, Math.max(24, x))}px`;
  tooltip.style.top = '16px';
  drawChart();
}

function hideChartTooltip() {
  if (refs.chartTooltip) refs.chartTooltip.hidden = true;
  state.chartHover = null;
  drawChart();
}

function renderTimeFilters() {
  refs.timeFilterGroup.querySelectorAll('[data-range]').forEach((button) => {
    button.classList.toggle('segmented__btn--active', button.dataset.range === state.timeRange);
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  refs.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

function openSettingsAuthModal() {
  refs.settingsAuthError.textContent = '';
  refs.settingsAuthForm.reset();
  refs.settingsAuthModal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => refs.settingsNome.focus(), 30);
}

function closeSettingsAuthModal() {
  refs.settingsAuthModal.hidden = true;
  refs.settingsAuthError.textContent = '';
  if (refs.shutdownModal.hidden) {
    document.body.classList.remove('modal-open');
  }
}

function openShutdownModal(labId) {
  refs.shutdownLabId.value = labId;
  refs.shutdownError.textContent = '';
  refs.shutdownForm.reset();
  refs.shutdownModal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => refs.operatorNome.focus(), 30);
}

function closeShutdownModal() {
  refs.shutdownModal.hidden = true;
  document.body.classList.remove('modal-open');
  refs.shutdownError.textContent = '';
}

function focusLab(labId) {
  state.focusLabId = labId;
  setActivePage('laboratori');
  renderLaboratoriPage();
  const target = document.getElementById(`lab-card-${labId}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function setActivePage(page) {
  if (page === 'impostazioni' && state.dbConfig.settingsRequireAuth && !state.settingsAccessGranted) {
    openSettingsAuthModal();
    return;
  }
  state.activePage = page;
  renderSidebar();
  renderPages();
  renderTopbar();
}

function rerenderAll() {
  computeAlarms();
  renderTopbar();
  renderSidebar();
  renderPages();
  renderMetrics();
  renderDashboardLabStrip();
  renderLaboratoriPage();
  renderDashboardAlarms();
  renderAlarmPage();
  renderHistoryPage();
  renderSettingsPage();
  renderSystemStatus();
  renderChartLegend();
  renderTimeFilters();
  drawChart();
}

function applyBootstrap(payload, options = {}) {
  state.schoolName = payload?.schoolName || state.schoolName;
  state.database = { ...state.database, ...(payload?.database || {}) };
  state.chartLabels = Array.isArray(payload?.chartLabels) && payload.chartLabels.length ? payload.chartLabels : state.chartLabels;
  if (!state.chartLabels.length) buildChartLabels();
  state.labs = normalizeLabs(payload?.labs || state.labs);

  const dbAlarms = Array.isArray(payload?.alarms) ? payload.alarms : [];
  state.alarms = dbAlarms;

  if (!options.keepRemoteHistory) {
    state.remoteHistory = (payload?.history || []).map((entry) => ({
      ...entry,
      at: new Date(entry.at),
    }));
  }
}

async function refreshFromBackend(rangeKey = state.timeRange, silent = false) {
  try {
    const payload = await window.dashboardAPI.getBootstrap(rangeKey);
    applyBootstrap(payload);
    rerenderAll();
  } catch (error) {
    console.error(error);
    if (!silent) showToast('Errore nel caricamento dei dati dal backend.', 'error');
  }
}

async function updateRange(rangeKey) {
  state.timeRange = rangeKey;
  if (state.database.connected || !state.dbConfig.demoMode) {
    await refreshFromBackend(rangeKey, true);
    return;
  }

  buildChartLabels();
  state.labs = state.labs.map((lab) => ({
    ...lab,
    trend: buildTrend(lab.powerKw, rangeKey),
  }));
  rerenderAll();
}

function pulseData() {
  if (!state.settings.realtimeActive) {
    rerenderAll();
    return;
  }

  if (state.database.connected) {
    refreshFromBackend(state.timeRange, true);
    return;
  }

  if (state.chartLabels.length > 1) {
    const step = Number(state.chartLabels[state.chartLabels.length - 1]) - Number(state.chartLabels[state.chartLabels.length - 2]);
    state.chartLabels = [...state.chartLabels.slice(1), Number(state.chartLabels[state.chartLabels.length - 1]) + Math.max(step, 60000)];
  }

  state.labs = state.labs.map((lab) => {
    let powerKw = Number(lab.powerKw || 0);
    if (lab.isOn) {
      powerKw += (Math.random() - 0.45) * 0.45;
      powerKw = Math.max(0.85, Math.min(7.2, powerKw));
    } else {
      powerKw += (Math.random() - 0.8) * 0.08;
      powerKw = Math.max(0, Math.min(0.5, powerKw));
    }

    const trend = [...(lab.trend || []).slice(1), Number(powerKw.toFixed(2))];
    return {
      ...lab,
      powerKw: Number(powerKw.toFixed(2)),
      trend,
      consumptionToday: Number((Number(lab.consumptionToday || 0) + (lab.isOn ? Math.random() * 0.18 : 0.01)).toFixed(1)),
    };
  });

  rerenderAll();
}

async function startLab(labId) {
  const result = await window.dashboardAPI.startLab(labId);
  if (!result?.ok) {
    showToast(result?.error || 'Impossibile avviare il laboratorio.', 'error');
    return;
  }

  if (state.chartLabels.length > 1) {
    const step = Number(state.chartLabels[state.chartLabels.length - 1]) - Number(state.chartLabels[state.chartLabels.length - 2]);
    state.chartLabels = [...state.chartLabels.slice(1), Number(state.chartLabels[state.chartLabels.length - 1]) + Math.max(step, 60000)];
  }

  state.labs = state.labs.map((lab) => {
    if (lab.id !== labId) return lab;
    const updatedPower = Number(result.updated.powerKw || 1.8);
    return {
      ...lab,
      isOn: true,
      powerKw: updatedPower,
      trend: buildTrend(updatedPower, state.timeRange),
    };
  });

  const lab = state.labs.find((item) => item.id === labId);
  addHistoryEvent('start', lab?.name || 'Laboratorio', 'Accensione laboratorio eseguita', 'Operatore locale');

  if (state.database.connected) {
    await refreshFromBackend(state.timeRange, true);
  } else {
    rerenderAll();
  }
  showToast('Laboratorio acceso correttamente.');
}

async function shutdownLab(event) {
  event.preventDefault();
  refs.shutdownError.textContent = '';

  const payload = {
    labId: refs.shutdownLabId.value,
    operator: {
      nome: refs.operatorNome.value,
      cognome: refs.operatorCognome.value,
      password: refs.operatorPassword.value,
    },
    reason: refs.shutdownReason.value,
  };

  const result = await window.dashboardAPI.shutdownLab(payload);

  if (!result?.ok) {
    refs.shutdownError.textContent = result?.error || 'Errore durante lo spegnimento.';
    return;
  }

  if (state.chartLabels.length > 1) {
    const step = Number(state.chartLabels[state.chartLabels.length - 1]) - Number(state.chartLabels[state.chartLabels.length - 2]);
    state.chartLabels = [...state.chartLabels.slice(1), Number(state.chartLabels[state.chartLabels.length - 1]) + Math.max(step, 60000)];
  }

  state.labs = state.labs.map((lab) => {
    if (lab.id !== payload.labId) return lab;
    return {
      ...lab,
      isOn: false,
      powerKw: Number(result.updated.powerKw || 0),
      trend: buildTrend(Number(result.updated.powerKw || 0), state.timeRange),
    };
  });

  const lab = state.labs.find((item) => item.id === payload.labId);
  addHistoryEvent(
    'shutdown',
    lab?.name || 'Laboratorio',
    payload.reason,
    result?.operator || `${payload.operator.nome} ${payload.operator.cognome}`.trim(),
  );

  closeShutdownModal();
  if (state.database.connected) {
    await refreshFromBackend(state.timeRange, true);
  } else {
    rerenderAll();
  }
  showToast('Spegnimento confermato.');
}

function acknowledgeAlarm(alarmId) {
  state.acknowledgedAlarmIds.add(alarmId);
  addHistoryEvent('alarm', 'Sistema allarmi', `Allarme ${alarmId} preso in carico`, 'Operatore locale');
  rerenderAll();
  showToast('Allarme preso in carico.');
}

function simulateAlarm() {
  if (!state.labs.length) return;
  const target = state.labs[state.transientAlarmSerial % state.labs.length];
  state.transientAlarmSerial += 1;
  target.powerKw = 6.4;
  target.trend = buildTrend(target.powerKw, state.timeRange);
  addHistoryEvent('alarm', target.name, 'Simulazione allarme manuale generata', 'Operatore locale');
  rerenderAll();
  showToast('Allarme simulato sulla linea selezionata.');
}

async function resetDemo() {
  state.settings = { ...DEFAULT_SETTINGS };
  state.acknowledgedAlarmIds = new Set();
  state.historyFilter = 'all';
  state.localHistory = [];
  await loadDbConfig();
  await refreshFromBackend(state.timeRange, true);
  addHistoryEvent('system', 'Sistema', 'Dashboard ripristinata', 'Sistema');
  rerenderAll();
  showToast('Dashboard ripristinata.');
}

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];

  if (key === 'realtimeActive') {
    addHistoryEvent(
      'system',
      'Sistema',
      state.settings.realtimeActive ? 'Monitoraggio realtime riattivato' : 'Monitoraggio realtime sospeso',
      'Operatore locale',
    );
  }


  rerenderAll();
}

function collectDbConfigForm() {
  return {
    server: refs.dbServer?.value?.trim() || DEFAULT_DB_FORM.server,
    port: Number(refs.dbPort?.value || DEFAULT_DB_FORM.port),
    database: refs.dbName?.value?.trim() || DEFAULT_DB_FORM.database,
    user: refs.dbUser?.value?.trim() || '',
    password: refs.dbPassword?.value || '',
    instanceName: refs.dbInstance?.value?.trim() || '',
    schoolName: refs.dbSchoolName?.value?.trim() || DEFAULT_DB_FORM.schoolName,
    demoMode: Boolean(refs.dbDemoMode?.checked),
    encrypt: Boolean(refs.dbEncrypt?.checked),
    trustServerCertificate: Boolean(refs.dbTrust?.checked),
    settingsRequireAuth: Boolean(refs.settingsRequireAuth?.checked),
  };
}


function populateDbConfigForm(config) {
  state.dbConfig = { ...DEFAULT_DB_FORM, ...(config || {}) };
  if (refs.dbServer) refs.dbServer.value = state.dbConfig.server || '';
  if (refs.dbPort) refs.dbPort.value = state.dbConfig.port || 1433;
  if (refs.dbName) refs.dbName.value = state.dbConfig.database || '';
  if (refs.dbUser) refs.dbUser.value = state.dbConfig.user || '';
  if (refs.dbPassword) refs.dbPassword.value = state.dbConfig.password || '';
  if (refs.dbInstance) refs.dbInstance.value = state.dbConfig.instanceName || '';
  if (refs.dbSchoolName) refs.dbSchoolName.value = state.dbConfig.schoolName || '';
  if (refs.dbDemoMode) refs.dbDemoMode.checked = Boolean(state.dbConfig.demoMode);
  if (refs.dbEncrypt) refs.dbEncrypt.checked = Boolean(state.dbConfig.encrypt);
  if (refs.dbTrust) refs.dbTrust.checked = Boolean(state.dbConfig.trustServerCertificate);
  if (refs.settingsRequireAuth) refs.settingsRequireAuth.checked = Boolean(state.dbConfig.settingsRequireAuth);
}

async function loadDbConfig() {
  const response = await window.dashboardAPI.getDbConfig();
  populateDbConfigForm(response?.config || DEFAULT_DB_FORM);
  state.database.driverAvailable = Boolean(response?.driverAvailable);
}

async function testDbConnection() {
  const config = collectDbConfigForm();
  const response = await window.dashboardAPI.testDbConnection(config);
  state.database.driverAvailable = Boolean(response?.driverAvailable);
  state.database.connected = Boolean(response?.connected);
  state.database.lastError = response?.error || '';
  state.dbConfig = { ...state.dbConfig, ...config };
  rerenderAll();

  if (response?.ok) {
    showToast(response.message || 'Test connessione completato.');
  } else {
    showToast(response?.error || 'Connessione non riuscita.', 'error');
  }
}


async function handleSettingsAuthSubmit(event) {
  event.preventDefault();
  refs.settingsAuthError.textContent = '';
  const payload = {
    nome: refs.settingsNome.value.trim(),
    cognome: refs.settingsCognome.value.trim(),
    password: refs.settingsPassword.value,
  };
  const response = await window.dashboardAPI.authorizeSettingsAccess(payload);
  if (!response?.ok) {
    refs.settingsAuthError.textContent = response?.error || 'Accesso non autorizzato.';
    return;
  }
  state.settingsAccessGranted = true;
  state.settingsAccessOperator = response?.operator || `${payload.nome} ${payload.cognome}`.trim();
  addHistoryEvent('system', 'Impostazioni', 'Accesso impostazioni autorizzato', state.settingsAccessOperator || 'Operatore locale');
  closeSettingsAuthModal();
  state.activePage = 'impostazioni';
  rerenderAll();
  showToast('Accesso impostazioni autorizzato.');
}

async function toggleLabHistory(labId) {
  const target = state.labs.find((lab) => lab.id === labId);
  if (!target) return;
  target.historyOpen = !target.historyOpen;
  if (target.historyOpen) {
    await loadMeasurementHistory(labId, state.settingsHistoryRangeByLab[labId] || '1h');
  }
  renderLaboratoriPage();
}

async function loadMeasurementHistory(labId, rangeKey = '1h') {
  state.settingsHistoryRangeByLab[labId] = rangeKey;
  const response = await window.dashboardAPI.getMeasurementHistory(labId, rangeKey);
  state.measurementHistoryByLab[labId] = (response?.points || []).map((point) => ({ at: point.at, kw: point.kw, labName: point.labName })).sort((a, b) => new Date(b.at) - new Date(a.at));
  renderLaboratoriPage();
}

async function saveSettings() {
  const dbConfig = collectDbConfigForm();
  const response = await window.dashboardAPI.saveDbConfig(dbConfig);
  populateDbConfigForm(response?.config || dbConfig);
  state.settingsAccessGranted = !Boolean((response?.config || dbConfig).settingsRequireAuth) || state.settingsAccessGranted;
  state.database.driverAvailable = Boolean(response?.driverAvailable);
  addHistoryEvent('system', 'Impostazioni', 'Configurazione dashboard e database salvata', state.settingsAccessOperator || 'Operatore locale');
  await refreshFromBackend(state.timeRange, true);
  rerenderAll();
  showToast('Impostazioni salvate.');
}

function handleDocumentClick(event) {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.dataset.page) {
    setActivePage(target.dataset.page);
    return;
  }

  if (target.dataset.navPage) {
    setActivePage(target.dataset.navPage);
    return;
  }

  if (target.dataset.range) {
    updateRange(target.dataset.range);
    return;
  }

  if (target.dataset.historyFilter) {
    state.historyFilter = target.dataset.historyFilter;
    renderHistoryPage();
    return;
  }

  if (target.dataset.shutdownLab) {
    openShutdownModal(target.dataset.shutdownLab);
    return;
  }

  if (target.dataset.startLab) {
    startLab(target.dataset.startLab);
    return;
  }

  if (target.dataset.ackAlarm) {
    acknowledgeAlarm(target.dataset.ackAlarm);
    return;
  }

  if (target.dataset.focusLab) {
    focusLab(target.dataset.focusLab);
    return;
  }

  if (target.dataset.toggleHistory) {
    toggleLabHistory(target.dataset.toggleHistory);
    return;
  }

  if (target.dataset.historyLab && target.dataset.historyRange) {
    loadMeasurementHistory(target.dataset.historyLab, target.dataset.historyRange);
    return;
  }

  if (target.dataset.selectSeries) {
    const selected = state.labs.find((lab) => lab.id === target.dataset.selectSeries);
    if (selected) {
      state.chartHover = { index: Math.max(0, state.chartLabels.length - 1), labName: selected.name };
      renderChartLegend();
      drawChart();
    }
    return;
  }

  if (target.dataset.setting) {
    toggleSetting(target.dataset.setting);
  }
}

async function init() {
  try {
    buildChartLabels();
    await loadDbConfig();
    state.settingsAccessGranted = !state.dbConfig.settingsRequireAuth;
    await refreshFromBackend(state.timeRange, true);

    addHistoryEvent('system', 'Sistema', 'Dashboard inizializzata correttamente', 'Sistema');
    addHistoryEvent(
      'system',
      'Database',
      state.database.connected
        ? 'Connessione SQL Server attiva'
        : (state.dbConfig.demoMode ? 'Modalità demo locale attiva' : 'Avvio con fallback locale'),
      'Sistema',
    );

    rerenderAll();
    state.refreshTimer = window.setInterval(pulseData, 5000);
  } catch (error) {
    console.error(error);
    showToast('Errore iniziale nel caricamento della dashboard.', 'error');
  }
}

refs.sidebarToggle.addEventListener('click', () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  refs.appRoot.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
});

refs.shutdownForm.addEventListener('submit', shutdownLab);
refs.closeSettingsModalBtn?.addEventListener('click', closeSettingsAuthModal);
refs.cancelSettingsModalBtn?.addEventListener('click', closeSettingsAuthModal);
refs.settingsAuthForm?.addEventListener('submit', handleSettingsAuthSubmit);
refs.settingsAuthModal?.addEventListener('click', (event) => { if (event.target === refs.settingsAuthModal) closeSettingsAuthModal(); });
refs.closeModalBtn.addEventListener('click', closeShutdownModal);
refs.cancelModalBtn.addEventListener('click', closeShutdownModal);
refs.shutdownModal.addEventListener('click', (event) => {
  if (event.target === refs.shutdownModal) closeShutdownModal();
});
refs.saveSettingsBtn.addEventListener('click', saveSettings);
refs.resetDemoBtn.addEventListener('click', resetDemo);
refs.simulateAlarmBtn.addEventListener('click', simulateAlarm);
refs.testDbConnectionBtn?.addEventListener('click', testDbConnection);
refs.energyChart?.addEventListener('mousemove', updateChartTooltip);
refs.energyChart?.addEventListener('mouseleave', hideChartTooltip);
document.addEventListener('click', handleDocumentClick);
window.addEventListener('resize', drawChart);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && refs.settingsAuthModal && !refs.settingsAuthModal.hidden) {
    closeSettingsAuthModal();
    return;
  }
  if (event.key === 'Escape' && !refs.shutdownModal.hidden) {
    closeShutdownModal();
  }
});

init();
