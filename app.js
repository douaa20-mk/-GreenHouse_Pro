// STATE MANAGEMENT
let sensorData = { temp: 24.2, hum: 65, soil: 58, co2: 420 };
let deviceStates = { fan: 'OFF', pump: 'OFF', heat: 'OFF' };
let autoMode = true;
let thresholds = { tempHigh: 28, tempLow: 15, soilDry: 40 };
let historyEvents = [];
let alertsArray = [];
let pollTimer = null;
let pollInterval = 5;
let espIP = '192.168.1.100';
let camURL = '';
let camPaused = false;
let currentChartRange = 'hour';

// CHART DATA
let tempData = {
  hour: [22.5, 23.1, 24.0, 24.5, 23.8, 24.2, 24.4],
  day: [21.0, 22.5, 23.8, 24.2, 25.1, 24.8, 24.0, 23.5, 22.8, 23.0],
  week: [20.5, 21.2, 22.8, 23.5, 24.0, 24.5, 25.2]
};
let humData = {
  hour: [64, 66, 63, 65, 62, 64, 65],
  day: [68, 66, 64, 63, 61, 62, 63, 64, 65, 64],
  week: [70, 68, 65, 63, 62, 60, 61]
};
let soilData = {
  hour: [56, 57, 58, 57, 59, 58, 58],
  day: [55, 56, 57, 58, 57, 56, 55, 54, 55, 56],
  week: [58, 57, 56, 55, 54, 53, 52]
};
let co2Data = {
  hour: [410, 415, 420, 425, 418, 422, 423],
  day: [415, 418, 420, 422, 425, 428, 430, 432, 435, 438],
  week: [400, 410, 415, 420, 425, 430, 435]
};

let chartLabels = {
  hour: ['-6', '-5', '-4', '-3', '-2', '-1', 'now'],
  day: ['-9h', '-8h', '-7h', '-6h', '-5h', '-4h', '-3h', '-2h', '-1h', 'now'],
  week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
};

// CHART INSTANCES
let tempChart = null, humChart = null, analyticsTempChart = null, analyticsDualChart = null, analyticsCo2Chart = null, deviceActivityChart = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCharts();
  loadSettings();
  startPolling();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  setupNavigation();
  setupMenuToggle();
  setupChartControls();
  setupDeviceButtons();
  setupExportButtons();
  updateUI();
  renderHistoryTable();
  renderAlerts();
  addHistory("System started", "System");
  addHistory("Dashboard ready", "System");
});

// ============ THEME FUNCTIONS ============
function initTheme() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}

window.toggleTheme = function() {
  const cur = document.documentElement.getAttribute('data-theme');
  const newTheme = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
  showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode activated`);
  updateChartsTheme();
};

function updateChartsTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  
  const charts = [tempChart, humChart, analyticsTempChart, analyticsDualChart, analyticsCo2Chart, deviceActivityChart];
  charts.forEach(chart => {
    if (chart && chart.options && chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
      }
      chart.update();
    }
  });
}

// ============ CHART FUNCTIONS ============
function initCharts() {
  const ctxTemp = document.getElementById('tempChartMain');
  if (ctxTemp) {
    tempChart = new Chart(ctxTemp, {
      type: 'line',
      data: { labels: chartLabels.hour, datasets: [{ label: 'Temperature (°C)', data: tempData.hour, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', tension: 0.3, fill: true, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
  
  const ctxHum = document.getElementById('humChartMain');
  if (ctxHum) {
    humChart = new Chart(ctxHum, {
      type: 'line',
      data: { labels: chartLabels.hour, datasets: [{ label: 'Humidity (%)', data: humData.hour, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', tension: 0.3, fill: true, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
  
  const ctxAnalyticsTemp = document.getElementById('analyticsTempChart');
  if (ctxAnalyticsTemp) {
    analyticsTempChart = new Chart(ctxAnalyticsTemp, {
      type: 'line',
      data: { labels: chartLabels.hour, datasets: [{ label: 'Temperature (°C)', data: tempData.hour, borderColor: '#ef4444', tension: 0.3, fill: false, pointRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxDual = document.getElementById('analyticsDualChart');
  if (ctxDual) {
    analyticsDualChart = new Chart(ctxDual, {
      type: 'line',
      data: { labels: chartLabels.hour, datasets: [{ label: 'Humidity (%)', data: humData.hour, borderColor: '#3b82f6', tension: 0.3 }, { label: 'Soil Moisture (%)', data: soilData.hour, borderColor: '#10b981', tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxCo2 = document.getElementById('analyticsCo2Chart');
  if (ctxCo2) {
    analyticsCo2Chart = new Chart(ctxCo2, {
      type: 'line',
      data: { labels: chartLabels.hour, datasets: [{ label: 'CO₂ (ppm)', data: co2Data.hour, borderColor: '#8b5cf6', tension: 0.3, fill: true, backgroundColor: 'rgba(139,92,246,0.05)' }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxActivity = document.getElementById('deviceActivityChart');
  if (ctxActivity) {
    deviceActivityChart = new Chart(ctxActivity, {
      type: 'bar',
      data: { labels: ['Fan', 'Pump', 'Heater'], datasets: [{ label: 'Actions', data: [0, 0, 0], backgroundColor: ['#3b82f6', '#10b981', '#ef4444'], borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
}

function setupChartControls() {
  document.querySelectorAll('.chart-time-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.chart-time-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentChartRange = this.getAttribute('data-range');
      updateChartRange(currentChartRange);
    });
  });
}

function updateChartRange(range) {
  if (tempChart) {
    tempChart.data.labels = chartLabels[range];
    tempChart.data.datasets[0].data = tempData[range];
    tempChart.update();
  }
  if (humChart) {
    humChart.data.labels = chartLabels[range];
    humChart.data.datasets[0].data = humData[range];
    humChart.update();
  }
  if (analyticsTempChart) {
    analyticsTempChart.data.labels = chartLabels[range];
    analyticsTempChart.data.datasets[0].data = tempData[range];
    analyticsTempChart.update();
  }
  if (analyticsDualChart) {
    analyticsDualChart.data.labels = chartLabels[range];
    analyticsDualChart.data.datasets[0].data = humData[range];
    analyticsDualChart.data.datasets[1].data = soilData[range];
    analyticsDualChart.update();
  }
  if (analyticsCo2Chart) {
    analyticsCo2Chart.data.labels = chartLabels[range];
    analyticsCo2Chart.data.datasets[0].data = co2Data[range];
    analyticsCo2Chart.update();
  }
}

// ============ DEVICE CONTROL ============
function setupDeviceButtons() {
  document.querySelectorAll('.quick-btn, .ctrl-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const device = this.getAttribute('data-device');
      const cmd = this.getAttribute('data-cmd');
      if (device && cmd) sendDeviceCmd(device, cmd);
    });
  });
}

window.sendDeviceCmd = function(device, cmd) {
  if (cmd === 'AUTO') {
    deviceStates[device] = 'AUTO';
    addHistory(`${device.toUpperCase()} set to AUTO`, "Manual");
    showToast(`${device} → AUTO mode`);
  } else {
    deviceStates[device] = cmd;
    addHistory(`${device.toUpperCase()} turned ${cmd}`, "Manual");
    showToast(`${device} turned ${cmd}`);
  }
  updateUI();
  updateDeviceStatusColors();
};

function updateDeviceStatusColors() {
  const devices = ['fan', 'pump', 'heat'];
  devices.forEach(device => {
    const status = deviceStates[device];
    const elements = [
      document.getElementById(`dash${device.charAt(0).toUpperCase() + device.slice(1)}Status`),
      document.getElementById(`dev${device.charAt(0).toUpperCase() + device.slice(1)}Status`)
    ];
    elements.forEach(el => {
      if (el) {
        el.textContent = status;
        el.className = status === 'ON' ? 'status-on' : (status === 'AUTO' ? 'status-auto' : 'status-off');
      }
    });
  });
}

// ============ UI UPDATE ============
function updateUI() {
  document.getElementById('kpiTemp').innerHTML = sensorData.temp.toFixed(1) + '°C';
  document.getElementById('kpiHum').innerHTML = Math.round(sensorData.hum) + '%';
  document.getElementById('kpiSoil').innerHTML = Math.round(sensorData.soil) + '%';
  document.getElementById('kpiCo2').innerHTML = Math.round(sensorData.co2) + 'ppm';
  
  updateDeviceStatusColors();
  updateStatistics();
}

function updateSimulation() {
  sensorData.temp = Math.min(42, Math.max(12, sensorData.temp + (Math.random() - 0.5) * 0.45));
  sensorData.hum = Math.min(92, Math.max(30, sensorData.hum + (Math.random() - 0.5) * 0.8));
  sensorData.soil = Math.min(85, Math.max(18, sensorData.soil + (Math.random() - 0.45) * 0.6));
  sensorData.co2 = Math.min(1100, Math.max(360, sensorData.co2 + (Math.random() - 0.5) * 5));
  
  updateUI();
  checkAutoRules();
  
  // Update chart data for current range
  if (currentChartRange === 'hour') {
    tempData.hour.push(sensorData.temp);
    humData.hour.push(sensorData.hum);
    soilData.hour.push(sensorData.soil);
    co2Data.hour.push(sensorData.co2);
    if (tempData.hour.length > 12) tempData.hour.shift();
    if (humData.hour.length > 12) humData.hour.shift();
    if (soilData.hour.length > 12) soilData.hour.shift();
    if (co2Data.hour.length > 12) co2Data.hour.shift();
    updateChartRange('hour');
  }
}

function checkAutoRules() {
  if (!autoMode) return;
  
  if (sensorData.temp > thresholds.tempHigh && deviceStates.fan !== 'ON' && deviceStates.fan !== 'AUTO') {
    deviceStates.fan = 'ON';
    addHistory("Fan turned ON (auto)", "Auto");
    addAlert("High Temperature", `Temp ${sensorData.temp.toFixed(1)}°C > ${thresholds.tempHigh}°C`);
    updateUI();
  } else if (sensorData.temp < thresholds.tempLow && deviceStates.heat !== 'ON' && deviceStates.heat !== 'AUTO') {
    deviceStates.heat = 'ON';
    addHistory("Heater ON (auto)", "Auto");
    addAlert("Low Temperature", `Heater activated at ${sensorData.temp.toFixed(1)}°C`);
    updateUI();
  } else if (sensorData.temp < thresholds.tempLow + 2 && deviceStates.heat === 'ON') {
    deviceStates.heat = 'OFF';
    addHistory("Heater OFF (auto)", "Auto");
    updateUI();
  }
  
  if (sensorData.soil < thresholds.soilDry && deviceStates.pump !== 'ON' && deviceStates.pump !== 'AUTO') {
    deviceStates.pump = 'ON';
    addHistory("Pump ON (auto)", "Auto");
    addAlert("Soil Dry", `Moisture ${Math.round(sensorData.soil)}% below threshold`);
    updateUI();
  } else if (sensorData.soil > thresholds.soilDry + 18 && deviceStates.pump === 'ON') {
    deviceStates.pump = 'OFF';
    addHistory("Pump OFF (auto)", "Auto");
    updateUI();
  }
}

function updateStatistics() {
  const currentTemp = tempData[currentChartRange] || tempData.hour;
  const currentHum = humData[currentChartRange] || humData.hour;
  
  if (currentTemp.length === 0) return;
  
  const avgTemp = currentTemp.reduce((a, b) => a + b, 0) / currentTemp.length;
  const maxTemp = Math.max(...currentTemp);
  const minHum = Math.min(...currentHum);
  const autoCount = historyEvents.filter(e => e.source === 'Auto').length;
  
  document.getElementById('statAvgTemp').innerHTML = avgTemp.toFixed(1) + '°C';
  document.getElementById('statMaxTemp').innerHTML = maxTemp.toFixed(1) + '°C';
  document.getElementById('statMinHum').innerHTML = minHum.toFixed(0) + '%';
  document.getElementById('statAutoCount').innerHTML = autoCount;
  
  if (deviceActivityChart) {
    const fanCount = historyEvents.filter(e => e.action.toLowerCase().includes('fan')).length;
    const pumpCount = historyEvents.filter(e => e.action.toLowerCase().includes('pump')).length;
    const heatCount = historyEvents.filter(e => e.action.toLowerCase().includes('heater')).length;
    deviceActivityChart.data.datasets[0].data = [fanCount, pumpCount, heatCount];
    deviceActivityChart.update();
  }
}

// ============ ALERTS & HISTORY ============
function addHistory(action, source) {
  historyEvents.unshift({ time: new Date().toLocaleTimeString(), action, source });
  if (historyEvents.length > 100) historyEvents.pop();
  renderHistoryTable();
}

function addAlert(title, msg) {
  alertsArray.unshift({ id: Date.now(), title, msg, level: 'warning', time: new Date().toLocaleTimeString() });
  if (alertsArray.length > 30) alertsArray.pop();
  renderAlerts();
  updateAlertBadge();
  showToast(msg);
}

function renderAlerts() {
  const container = document.getElementById('alertsContainer');
  const recentContainer = document.getElementById('recentAlertsList');
  if (!container) return;
  
  if (alertsArray.length === 0) {
    container.innerHTML = '<div class="alert-placeholder" style="padding:40px; text-align:center;"><i class="fas fa-check-circle"></i> No alerts</div>';
    if (recentContainer) recentContainer.innerHTML = '<div class="alert-placeholder"><i class="fas fa-check-circle"></i> No active alerts</div>';
    return;
  }
  
  container.innerHTML = alertsArray.slice(0, 20).map(alert => `
    <div class="alert-item warning">
      <i class="fas fa-exclamation-triangle"></i>
      <div style="flex:1"><strong>${escapeHtml(alert.title)}</strong><br><small>${escapeHtml(alert.msg)}</small></div>
      <small>${alert.time}</small>
    </div>
  `).join('');
  
  if (recentContainer) {
    recentContainer.innerHTML = alertsArray.slice(0, 5).map(alert => `
      <div class="alert-item warning" style="padding:12px; margin-bottom:8px;">
        <i class="fas fa-exclamation-triangle"></i>
        <span style="flex:1">${escapeHtml(alert.title)}</span>
        <small>${alert.time}</small>
      </div>
    `).join('');
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  
  const search = document.getElementById('historySearch')?.value.toLowerCase() || '';
  const type = document.getElementById('historyType')?.value || 'all';
  
  let filtered = historyEvents;
  if (search) filtered = filtered.filter(e => e.action.toLowerCase().includes(search));
  if (type !== 'all') filtered = filtered.filter(e => e.action.toLowerCase().includes(type));
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:40px;">No events found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.slice(0, 50).map(entry => `
    <tr><td>${entry.time}</td><td>${escapeHtml(entry.action)}</td><td><span class="badge" style="background:var(--primary-light); color:var(--primary); padding:4px 8px; border-radius:20px; font-size:0.7rem;">${entry.source}</span></td></tr>
  `).join('');
}

function updateAlertBadge() {
  const badge = document.getElementById('alertBadge');
  if (badge) {
    badge.textContent = alertsArray.length;
    badge.style.display = alertsArray.length > 0 ? 'inline-block' : 'none';
  }
}

window.clearAllAlerts = function() {
  alertsArray = [];
  renderAlerts();
  updateAlertBadge();
  showToast("All alerts cleared");
};

// ============ SETTINGS ============
function loadSettings() {
  espIP = localStorage.getItem('espIP') || '192.168.1.100';
  camURL = localStorage.getItem('camURL') || '';
  pollInterval = parseInt(localStorage.getItem('pollInterval')) || 5;
  thresholds.tempHigh = parseFloat(localStorage.getItem('tempHigh')) || 28;
  thresholds.tempLow = parseFloat(localStorage.getItem('tempLow')) || 15;
  thresholds.soilDry = parseFloat(localStorage.getItem('soilDry')) || 40;
  
  document.getElementById('espIP').value = espIP;
  document.getElementById('camURL').value = camURL;
  document.getElementById('pollInterval').value = pollInterval;
  document.getElementById('tempHigh').value = thresholds.tempHigh;
  document.getElementById('tempLow').value = thresholds.tempLow;
  document.getElementById('soilDry').value = thresholds.soilDry;
  
  const autoBtn = document.getElementById('autoModeToggleBtn');
  if (autoBtn) {
    autoBtn.innerHTML = autoMode ? 'ACTIVE' : 'DISABLED';
    autoBtn.style.background = autoMode ? 'var(--accent)' : 'var(--gray-500)';
  }
  document.getElementById('autoBadge').innerHTML = `<i class="fas fa-robot"></i> Auto Mode: ${autoMode ? 'ON' : 'OFF'}`;
}

window.saveConnectionSettings = function() {
  espIP = document.getElementById('espIP').value;
  camURL = document.getElementById('camURL').value;
  pollInterval = parseInt(document.getElementById('pollInterval').value);
  
  localStorage.setItem('espIP', espIP);
  localStorage.setItem('camURL', camURL);
  localStorage.setItem('pollInterval', pollInterval);
  
  restartPolling();
  showToast("Settings saved");
};

window.saveThresholds = function() {
  thresholds.tempHigh = parseFloat(document.getElementById('tempHigh').value);
  thresholds.tempLow = parseFloat(document.getElementById('tempLow').value);
  thresholds.soilDry = parseFloat(document.getElementById('soilDry').value);
  
  localStorage.setItem('tempHigh', thresholds.tempHigh);
  localStorage.setItem('tempLow', thresholds.tempLow);
  localStorage.setItem('soilDry', thresholds.soilDry);
  
  showToast("Thresholds saved");
};

window.toggleAutoMode = function() {
  autoMode = !autoMode;
  const btn = document.getElementById('autoModeToggleBtn');
  const badge = document.getElementById('autoBadge');
  btn.innerHTML = autoMode ? 'ACTIVE' : 'DISABLED';
  btn.style.background = autoMode ? 'var(--accent)' : 'var(--gray-500)';
  badge.innerHTML = `<i class="fas fa-robot"></i> Auto Mode: ${autoMode ? 'ON' : 'OFF'}`;
  showToast(`Auto mode ${autoMode ? 'enabled' : 'disabled'}`);
};

// ============ CAMERA ============
window.toggleCamera = function() {
  const img = document.getElementById('camStream');
  const placeholder = document.getElementById('camPlaceholder');
  camPaused = !camPaused;
  if (camPaused) {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  } else {
    retryCamera();
  }
};

window.retryCamera = function() {
  const url = camURL || `http://${espIP}:81/stream`;
  const img = document.getElementById('camStream');
  const placeholder = document.getElementById('camPlaceholder');
  img.src = url;
  img.onload = () => { img.style.display = 'block'; placeholder.style.display = 'none'; };
  img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'flex'; };
};

// ============ EXPORT ============
function setupExportButtons() {
  document.getElementById('exportAnalyticsBtn')?.addEventListener('click', exportAnalyticsCSV);
  document.getElementById('exportHistoryBtn')?.addEventListener('click', exportHistoryCSV);
  document.getElementById('clearAlertsBtn')?.addEventListener('click', clearAllAlerts);
  document.getElementById('saveConnBtn')?.addEventListener('click', saveConnectionSettings);
  document.getElementById('saveThreshBtn')?.addEventListener('click', saveThresholds);
  document.getElementById('autoModeToggleBtn')?.addEventListener('click', toggleAutoMode);
  document.getElementById('pauseCamBtn')?.addEventListener('click', toggleCamera);
  document.getElementById('refreshCamBtn')?.addEventListener('click', retryCamera);
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
}

function exportAnalyticsCSV() {
  const currentTemp = tempData[currentChartRange] || tempData.hour;
  const currentHum = humData[currentChartRange] || humData.hour;
  const currentSoil = soilData[currentChartRange] || soilData.hour;
  const currentCo2 = co2Data[currentChartRange] || co2Data.hour;
  const currentLabels = chartLabels[currentChartRange] || chartLabels.hour;
  
  let csv = "Timestamp,Temperature,Humidity,Soil Moisture,CO₂\n";
  for (let i = 0; i < currentTemp.length; i++) {
    csv += `${currentLabels[i]},${currentTemp[i]},${currentHum[i]},${currentSoil[i]},${currentCo2[i]}\n`;
  }
  downloadCSV(csv, `analytics_${new Date().toISOString().slice(0,19)}.csv`);
}

function exportHistoryCSV() {
  let csv = "Time,Action,Source\n";
  historyEvents.forEach(e => { csv += `"${e.time}","${e.action}","${e.source}"\n`; });
  downloadCSV(csv, `history_${new Date().toISOString().slice(0,19)}.csv`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Export complete");
}

// ============ NAVIGATION ============
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${page}`).classList.add('active');
      document.getElementById('pageTitle').innerText = page.charAt(0).toUpperCase() + page.slice(1);
      if (page === 'history') renderHistoryTable();
      if (page === 'alerts') renderAlerts();
      
      // Close sidebar on mobile after click
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
  
  document.querySelectorAll('.view-all').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      document.querySelector(`.nav-link[data-page="${page}"]`).click();
    });
  });
  
  document.getElementById('historySearch')?.addEventListener('input', () => renderHistoryTable());
  document.getElementById('historyType')?.addEventListener('change', () => renderHistoryTable());
}

function setupMenuToggle() {
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  updateSimulation();
  pollTimer = setInterval(updateSimulation, pollInterval * 1000);
}

function restartPolling() {
  if (pollTimer) clearInterval(pollTimer);
  startPolling();
}

function updateDateTime() {
  const now = new Date();
  document.getElementById('currentDate').innerHTML = now.toLocaleDateString();
  document.getElementById('currentTime').innerHTML = now.toLocaleTimeString();
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  // Remove existing classes
  toast.className = 'toast';
  
  // Add type class
  toast.classList.add(type);
  
  // Set icon based on type
  let icon = '';
  switch(type) {
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-times-circle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
  }
  
  toast.innerHTML = `${icon} ${msg}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

// Make functions global
window.sendDeviceCmd = sendDeviceCmd;
window.toggleTheme = toggleTheme;
window.toggleCamera = toggleCamera;
window.retryCamera = retryCamera;
window.toggleAutoMode = toggleAutoMode;
window.saveConnectionSettings = saveConnectionSettings;
window.saveThresholds = saveThresholds;
window.clearAllAlerts = clearAllAlerts;
window.exportAnalyticsCSV = exportAnalyticsCSV;
window.exportHistoryCSV = exportHistoryCSV;
