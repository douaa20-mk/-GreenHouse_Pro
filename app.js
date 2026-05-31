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
let tempChart = null;
let humChart = null;
let analyticsTempChart = null;
let analyticsDualChart = null;
let analyticsCo2Chart = null;
let deviceActivityChart = null;

// INITIALIZATION
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
  updateUI();
  renderHistoryTable();
  renderAlerts();
  
  addHistory("System started", "System");
  addHistory("Dashboard ready", "System");
});

// ============ THEME FUNCTIONS ============
function initTheme() {
  const stored = localStorage.getItem('theme');
  const themeToggle = document.getElementById('themeToggle');
  if (stored === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

window.toggleTheme = function() {
  const cur = document.documentElement.getAttribute('data-theme');
  const newTheme = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  
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
      data: { 
        labels: chartLabels.hour, 
        datasets: [{ 
          label: 'Temperature (°C)', 
          data: tempData.hour, 
          borderColor: '#ef4444', 
          backgroundColor: 'rgba(239,68,68,0.05)', 
          tension: 0.3, 
          fill: true, 
          pointRadius: 3,
          pointHoverRadius: 6
        }] 
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
  
  const ctxHum = document.getElementById('humChartMain');
  if (ctxHum) {
    humChart = new Chart(ctxHum, {
      type: 'line',
      data: { 
        labels: chartLabels.hour, 
        datasets: [{ 
          label: 'Humidity (%)', 
          data: humData.hour, 
          borderColor: '#3b82f6', 
          backgroundColor: 'rgba(59,130,246,0.05)', 
          tension: 0.3, 
          fill: true, 
          pointRadius: 3,
          pointHoverRadius: 6
        }] 
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
  
  const ctxAnalyticsTemp = document.getElementById('analyticsTempChart');
  if (ctxAnalyticsTemp) {
    analyticsTempChart = new Chart(ctxAnalyticsTemp, {
      type: 'line',
      data: { 
        labels: chartLabels.hour, 
        datasets: [{ 
          label: 'Temperature (°C)', 
          data: tempData.hour, 
          borderColor: '#ef4444', 
          tension: 0.3, 
          fill: false, 
          pointRadius: 4
        }] 
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxDual = document.getElementById('analyticsDualChart');
  if (ctxDual) {
    analyticsDualChart = new Chart(ctxDual, {
      type: 'line',
      data: { 
        labels: chartLabels.hour, 
        datasets: [
          { label: 'Humidity (%)', data: humData.hour, borderColor: '#3b82f6', tension: 0.3, fill: false },
          { label: 'Soil Moisture (%)', data: soilData.hour, borderColor: '#10b981', tension: 0.3, fill: false }
        ] 
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxCo2 = document.getElementById('analyticsCo2Chart');
  if (ctxCo2) {
    analyticsCo2Chart = new Chart(ctxCo2, {
      type: 'line',
      data: { 
        labels: chartLabels.hour, 
        datasets: [{ 
          label: 'CO₂ (ppm)', 
          data: co2Data.hour, 
          borderColor: '#8b5cf6', 
          tension: 0.3, 
          fill: true, 
          backgroundColor: 'rgba(139,92,246,0.05)'
        }] 
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  const ctxActivity = document.getElementById('deviceActivityChart');
  if (ctxActivity) {
    deviceActivityChart = new Chart(ctxActivity, {
      type: 'bar',
      data: { 
        labels: ['Fan', 'Pump', 'Heater'], 
        datasets: [{ 
          label: 'Actions', 
          data: [0, 0, 0], 
          backgroundColor: ['#3b82f6', '#10b981', '#ef4444'], 
          borderRadius: 8 
        }] 
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
  }
}

function setupChartControls() {
  const buttons = document.querySelectorAll('.chart-time-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const range = this.getAttribute('data-range');
      currentChartRange = range;
      updateChartRange(range);
    });
  });
}

function updateChartRange(range) {
  const newLabels = chartLabels[range];
  const newTempData = tempData[range];
  const newHumData = humData[range];
  const newSoilData = soilData[range];
  const newCo2Data = co2Data[range];
  
  if (tempChart) {
    tempChart.data.labels = newLabels;
    tempChart.data.datasets[0].data = newTempData;
    tempChart.update();
  }
  
  if (humChart) {
    humChart.data.labels = newLabels;
    humChart.data.datasets[0].data = newHumData;
    humChart.update();
  }
  
  if (analyticsTempChart) {
    analyticsTempChart.data.labels = newLabels;
    analyticsTempChart.data.datasets[0].data = newTempData;
    analyticsTempChart.update();
  }
  
  if (analyticsDualChart) {
    analyticsDualChart.data.labels = newLabels;
    analyticsDualChart.data.datasets[0].data = newHumData;
    analyticsDualChart.data.datasets[1].data = newSoilData;
    analyticsDualChart.update();
  }
  
  if (analyticsCo2Chart) {
    analyticsCo2Chart.data.labels = newLabels;
    analyticsCo2Chart.data.datasets[0].data = newCo2Data;
    analyticsCo2Chart.update();
  }
}

// ============ DEVICE CONTROL FUNCTIONS ============
function setupDeviceButtons() {
  // Quick action buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const device = this.getAttribute('data-device');
      const cmd = this.getAttribute('data-cmd');
      if (device && cmd) sendDeviceCmd(device, cmd);
    });
  });
  
  // Control buttons in devices page
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const device = this.getAttribute('data-device');
      const cmd = this.getAttribute('data-cmd');
      if (device && cmd) sendDeviceCmd(device, cmd);
    });
  });
}

window.sendDeviceCmd = function(device, cmd) {
  const oldState = deviceStates[device];
  
  if (cmd === 'AUTO') {
    if (device === 'fan') deviceStates.fan = 'AUTO';
    else if (device === 'pump') deviceStates.pump = 'AUTO';
    else if (device === 'heat') deviceStates.heat = 'AUTO';
    addHistory(`${device.toUpperCase()} set to AUTO`, "Manual");
    showToast(`${device} → AUTO mode`, 'info');
  } else {
    deviceStates[device] = cmd;
    addHistory(`${device.toUpperCase()} turned ${cmd}`, "Manual");
    showToast(`${device} turned ${cmd}`, cmd === 'ON' ? 'success' : 'warning');
  }
  
  updateUI();
  updateDeviceStatusColors();
  
  // Visual feedback on button click
  const buttons = document.querySelectorAll(`[data-device="${device}"][data-cmd="${cmd}"]`);
  buttons.forEach(btn => {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 200);
  });
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

// ============ UI UPDATE FUNCTIONS ============
function updateUI() {
  // KPI Cards
  const kpiTemp = document.getElementById('kpiTemp');
  const kpiHum = document.getElementById('kpiHum');
  const kpiSoil = document.getElementById('kpiSoil');
  const kpiCo2 = document.getElementById('kpiCo2');
  
  if (kpiTemp) kpiTemp.innerHTML = sensorData.temp.toFixed(1) + '°C';
  if (kpiHum) kpiHum.innerHTML = Math.round(sensorData.hum) + '%';
  if (kpiSoil) kpiSoil.innerHTML = Math.round(sensorData.soil) + '%';
  if (kpiCo2) kpiCo2.innerHTML = Math.round(sensorData.co2) + 'ppm';
  
  updateDeviceStatusColors();
  
  // Update current range chart with new data point
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
  
  updateStatistics();
}

function updateStatistics() {
  const currentTempData = tempData[currentChartRange] || tempData.hour;
  const currentHumData = humData[currentChartRange] || humData.hour;
  
  if (currentTempData.length === 0) return;
  
  const avgTemp = currentTempData.reduce((a, b) => a + b, 0) / currentTempData.length;
  const maxTemp = Math.max(...currentTempData);
  const minHum = Math.min(...currentHumData);
  const autoCount = historyEvents.filter(e => e.source === 'Auto').length;
  
  const avgTempEl = document.getElementById('statAvgTemp');
  const maxTempEl = document.getElementById('statMaxTemp');
  const minHumEl = document.getElementById('statMinHum');
  const autoCountEl = document.getElementById('statAutoCount');
  
  if (avgTempEl) avgTempEl.innerHTML = avgTemp.toFixed(1) + '°C';
  if (maxTempEl) maxTempEl.innerHTML = maxTemp.toFixed(1) + '°C';
  if (minHumEl) minHumEl.innerHTML = minHum.toFixed(0) + '%';
  if (autoCountEl) autoCountEl.innerHTML = autoCount;
  
  if (deviceActivityChart) {
    const fanCount = historyEvents.filter(e => e.action.toLowerCase().includes('fan')).length;
    const pumpCount = historyEvents.filter(e => e.action.toLowerCase().includes('pump')).length;
    const heatCount = historyEvents.filter(e => e.action.toLowerCase().includes('heater')).length;
    deviceActivityChart.data.datasets[0].data = [fanCount, pumpCount, heatCount];
    deviceActivityChart.update();
  }
}

// ============ SIMULATION & AUTO RULES ============
function updateSimulation() {
  sensorData.temp = Math.min(42, Math.max(12, sensorData.temp + (Math.random() - 0.5) * 0.45));
  sensorData.hum = Math.min(92, Math.max(30, sensorData.hum + (Math.random() - 0.5) * 0.8));
  sensorData.soil = Math.min(85, Math.max(18, sensorData.soil + (Math.random() - 0.45) * 0.6));
  sensorData.co2 = Math.min(1100, Math.max(360, sensorData.co2 + (Math.random() - 0.5) * 5));
  
  updateUI();
  checkAutoRules();
}

function checkAutoRules() {
  if (!autoMode) return;
  
  if (sensorData.temp > thresholds.tempHigh && deviceStates.fan !== 'ON' && deviceStates.fan !== 'AUTO') {
    deviceStates.fan = 'ON';
    addHistory("Fan turned ON (auto)", "Auto");
    addAlert("High Temperature", `Temp ${sensorData.temp.toFixed(1)}°C > ${thresholds.tempHigh}°C`, "warning");
    updateUI();
  } else if (sensorData.temp < thresholds.tempLow && deviceStates.heat !== 'ON' && deviceStates.heat !== 'AUTO') {
    deviceStates.heat = 'ON';
    addHistory("Heater ON (auto)", "Auto");
    addAlert("Low Temperature", `Heater activated at ${sensorData.temp.toFixed(1)}°C`, "warning");
    updateUI();
  } else if (sensorData.temp < thresholds.tempLow + 2 && deviceStates.heat === 'ON') {
    deviceStates.heat = 'OFF';
    addHistory("Heater OFF (auto)", "Auto");
    updateUI();
  }
  
  if (sensorData.soil < thresholds.soilDry && deviceStates.pump !== 'ON' && deviceStates.pump !== 'AUTO') {
    deviceStates.pump = 'ON';
    addHistory("Pump ON (auto)", "Auto");
    addAlert("Soil Dry", `Moisture ${Math.round(sensorData.soil)}%`, "warning");
    updateUI();
  } else if (sensorData.soil > thresholds.soilDry + 18 && deviceStates.pump === 'ON') {
    deviceStates.pump = 'OFF';
    addHistory("Pump OFF (auto)", "Auto");
    updateUI();
  }
}

// ============ ALERTS & HISTORY ============
function addHistory(action, source) {
  historyEvents.unshift({ 
    time: new Date().toLocaleTimeString(), 
    action: action, 
    source: source 
  });
  if (historyEvents.length > 100) historyEvents.pop();
  renderHistoryTable();
}

function addAlert(title, msg, level) {
  alertsArray.unshift({ 
    id: Date.now(), 
    title: title, 
    msg: msg, 
    level: level, 
    time: new Date().toLocaleTimeString() 
  });
  if (alertsArray.length > 30) alertsArray.pop();
  renderAlerts();
  updateAlertBadge();
  
  // Animate badge
  const badge = document.getElementById('alertBadge');
  if (badge) {
    badge.classList.add('notify');
    setTimeout(() => badge.classList.remove('notify'), 500);
  }
  
  showToast(msg, level === 'warning' ? 'warning' : 'info');
}

function renderAlerts() {
  const container = document.getElementById('alertsContainer');
  const recentContainer = document.getElementById('recentAlertsList');
  
  if (!container) return;
  
  if (alertsArray.length === 0) {
    container.innerHTML = '<div class="alert-placeholder" style="padding:40px; text-align:center;"><i class="fas fa-check-circle"></i> No alerts</div>';
    if (recentContainer) recentContainer.innerHTML = '<div class="alert-placeholder" style="padding:20px; text-align:center;"><i class="fas fa-check-circle"></i> No active alerts</div>';
    return;
  }
  
  container.innerHTML = alertsArray.slice(0, 20).map(alert => `
    <div class="alert-item ${alert.level}">
      <i class="fas ${alert.level === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
      <div style="flex:1"><strong>${escapeHtml(alert.title)}</strong><br><small>${escapeHtml(alert.msg)}</small></div>
      <small>${alert.time}</small>
    </div>
  `).join('');
  
  if (recentContainer) {
    recentContainer.innerHTML = alertsArray.slice(0, 5).map(alert => `
      <div class="alert-item ${alert.level}" style="padding:12px; margin-bottom:8px;">
        <i class="fas ${alert.level === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span style="flex:1">${escapeHtml(alert.title)}</span>
        <small>${alert.time}</small>
      </div>
    `).join('');
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  
  const searchInput = document.getElementById('historySearch');
  const typeSelect = document.getElementById('historyType');
  
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const type = typeSelect ? typeSelect.value : 'all';
  
  let filtered = historyEvents;
  if (search) filtered = filtered.filter(e => e.action.toLowerCase().includes(search));
  if (type !== 'all') filtered = filtered.filter(e => e.action.toLowerCase().includes(type));
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:40px;">No events found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.slice(0, 50).map(entry => `
    <tr>
      <td>${entry.time}</td>
      <td>${escapeHtml(entry.action)}</td>
      <td><span class="badge" style="background:var(--primary-light); color:var(--primary); padding:4px 8px; border-radius:20px; font-size:0.7rem;">${entry.source}</span></td>
    </tr>
  `).join('');
}

function updateAlertBadge() {
  const badge = document.getElementById('alertBadge');
  if (badge) {
    const count = alertsArray.length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

window.clearAllAlerts = function() {
  alertsArray = [];
  renderAlerts();
  updateAlertBadge();
  showToast("All alerts cleared", 'info');
};

// ============ SETTINGS ============
window.saveConnectionSettings = function() {
  const ipInput = document.getElementById('espIP');
  const camInput = document.getElementById('camURL');
  const pollInput = document.getElementById('pollInterval');
  
  if (ipInput) espIP = ipInput.value;
  if (camInput) camURL = camInput.value;
  if (pollInput) pollInterval = parseInt(pollInput.value);
  
  localStorage.setItem('espIP', espIP);
  localStorage.setItem('camURL', camURL);
  localStorage.setItem('pollInterval', pollInterval);
  
  retryCamera();
  restartPolling();
  showToast("Settings saved", 'success');
};

window.saveThresholds = function() {
  const tempHighInput = document.getElementById('tempHigh');
  const tempLowInput = document.getElementById('tempLow');
  const soilDryInput = document.getElementById('soilDry');
  
  if (tempHighInput) thresholds.tempHigh = parseFloat(tempHighInput.value);
  if (tempLowInput) thresholds.tempLow = parseFloat(tempLowInput.value);
  if (soilDryInput) thresholds.soilDry = parseFloat(soilDryInput.value);
  
  localStorage.setItem('tempHigh', thresholds.tempHigh);
  localStorage.setItem('tempLow', thresholds.tempLow);
  localStorage.setItem('soilDry', thresholds.soilDry);
  
  showToast("Thresholds saved", 'success');
};

window.toggleAutoMode = function() {
  autoMode = !autoMode;
  const btn = document.getElementById('autoModeToggle');
  const badge = document.getElementById('autoBadge');
  if (btn) {
    btn.innerHTML = autoMode ? 'ACTIVE' : 'DISABLED';
    btn.style.background = autoMode ? 'var(--accent)' : 'var(--gray-500)';
  }
  if (badge) badge.innerHTML = `<i class="fas fa-robot"></i> Auto Mode: ${autoMode ? 'ON' : 'OFF'}`;
  showToast(`Auto mode ${autoMode ? 'enabled' : 'disabled'}`, 'info');
};

function loadSettings() {
  espIP = localStorage.getItem('espIP') || '192.168.1.100';
  camURL = localStorage.getItem('camURL') || '';
  pollInterval = parseInt(localStorage.getItem('pollInterval')) || 5;
  thresholds.tempHigh = parseFloat(localStorage.getItem('tempHigh')) || 28;
  thresholds.tempLow = parseFloat(localStorage.getItem('tempLow')) || 15;
  thresholds.soilDry = parseFloat(localStorage.getItem('soilDry')) || 40;
  
  const ipInput = document.getElementById('espIP');
  const camInput = document.getElementById('camURL');
  const pollInput = document.getElementById('pollInterval');
  const tempHighInput = document.getElementById('tempHigh');
  const tempLowInput = document.getElementById('tempLow');
  const soilDryInput = document.getElementById('soilDry');
  
  if (ipInput) ipInput.value = espIP;
  if (camInput) camInput.value = camURL;
  if (pollInput) pollInput.value = pollInterval;
  if (tempHighInput) tempHighInput.value = thresholds.tempHigh;
  if (tempLowInput) tempLowInput.value = thresholds.tempLow;
  if (soilDryInput) soilDryInput.value = thresholds.soilDry;
  
  retryCamera();
}

// ============ CAMERA FUNCTIONS ============
window.toggleCamera = function() {
  const img = document.getElementById('camStream');
  const placeholder = document.getElementById('camPlaceholder');
  camPaused = !camPaused;
  if (camPaused) {
    if (img) img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    showToast("Camera paused", 'info');
  } else {
    retryCamera();
  }
};

window.retryCamera = function() {
  const url = camURL || `http://${espIP}:81/stream`;
  const img = document.getElementById('camStream');
  const placeholder = document.getElementById('camPlaceholder');
  
  if (!img || !placeholder) return;
  
  img.src = url;
  img.onload = () => {
    img.style.display = 'block';
    placeholder.style.display = 'none';
  };
  img.onerror = () => {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  };
};

// ============ EXPORT FUNCTIONS ============
window.exportAnalyticsCSV = function() {
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
};

window.exportHistoryCSV = function() {
  let csv = "Time,Action,Source\n";
  historyEvents.forEach(e => {
    csv += `"${e.time}","${e.action}","${e.source}"\n`;
  });
  downloadCSV(csv, `history_${new Date().toISOString().slice(0,19)}.csv`);
};

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
  showToast("Export complete", 'success');
}

// ============ HELPER FUNCTIONS ============
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  updateSimulation();
  pollTimer = setInterval(updateSimulation, pollInterval * 1000);
}

function restartPolling() {
  if (pollTimer) clearInterval(pollTimer);
  startPolling();
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(`page-${page}`);
      if (targetPage) targetPage.classList.add('active');
      
      const titleMap = {
        dashboard: 'Dashboard',
        analytics: 'Analytics',
        devices: 'Devices',
        alerts: 'Alerts',
        history: 'History',
        settings: 'Settings'
      };
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) pageTitle.innerText = titleMap[page] || page;
      
      if (page === 'history') renderHistoryTable();
      if (page === 'alerts') renderAlerts();
    });
  });
  
  document.querySelectorAll('.view-all').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      const targetLink = document.querySelector(`.nav-link[data-page="${page}"]`);
      if (targetLink) targetLink.click();
    });
  });
  
  const historySearch = document.getElementById('historySearch');
  const historyType = document.getElementById('historyType');
  if (historySearch) historySearch.addEventListener('input', () => renderHistoryTable());
  if (historyType) historyType.addEventListener('change', () => renderHistoryTable());
}

function setupMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('currentDate');
  const timeEl = document.getElementById('currentTime');
  if (dateEl) dateEl.innerHTML = now.toLocaleDateString();
  if (timeEl) timeEl.innerHTML = now.toLocaleTimeString();
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.className = 'toast ' + type;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle')}"></i> ${msg}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}