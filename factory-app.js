const SUPABASE_URL = 'https://ekwruqvjpnbjmzsrgecr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrd3J1cXZqcG5iam16c3JnZWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTk3MjMsImV4cCI6MjA5MTczNTcyM30.ES-wmzDD4vruk4MU9K88w7VDpZ2Cr-qN9k5-Lx4bK4w';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db;

window.AppState = {
  activePack: null,
  packs: [],
  workers: [],
  exports: [],
  workerPollInterval: null,
  exportPollInterval: null,
};

window.FORMAT_SPECS = [
  { id: 'pod-png',      label: 'Print on Demand',    format: 'PNG',  dpi: 300, notes: 'sRGB, no transparency, 300 DPI' },
  { id: 'godot-sheet',  label: 'Godot Sprite Sheet', format: 'PNG',  dpi: 72,  notes: '2048x2048 max, power-of-2 dims' },
  { id: 'unity-sheet',  label: 'Unity Sprite Sheet', format: 'PNG',  dpi: 72,  notes: 'Multiple atlas formats supported' },
  { id: 'web-webp',     label: 'Web (WebP)',          format: 'WebP', dpi: 72,  notes: 'Max 1920px wide, quality 85' },
  { id: 'social-jpg',   label: 'Social Media',        format: 'JPG',  dpi: 72,  notes: '1080x1080 or 1080x1920' },
  { id: 'print-tiff',   label: 'Print (TIFF)',         format: 'TIFF', dpi: 300, notes: 'CMYK, lossless compression' },
];

function initTabs() {
  const tabs = document.querySelectorAll('.ftab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelName = tab.dataset.panel;
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + panelName).classList.add('active');
      handlePanelSwitch(panelName);
    });
  });
}

function handlePanelSwitch(panelName) {
  clearInterval(AppState.workerPollInterval);
  clearInterval(AppState.exportPollInterval);

  if (panelName === 'packs') {
    loadPacks();
  } else if (panelName === 'sheet') {
    populateSheetPackSelector();
    if (AppState.activePack) renderSheetView(AppState.activePack);
  } else if (panelName === 'workers') {
    detectOfflineWorkers().then(() => loadWorkers());
    AppState.workerPollInterval = setInterval(() => {
      detectOfflineWorkers().then(() => loadWorkers());
    }, 15000);
  } else if (panelName === 'exports') {
    initExportPanel();
    loadExportJobs();
    AppState.exportPollInterval = setInterval(loadExportJobs, 10000);
  }
}

async function refreshStats() {
  try {
    const [packsRes, assetsRes, workersRes, exportsRes] = await Promise.all([
      db.from('asset_packs').select('id', { count: 'exact', head: true }),
      db.from('assets').select('id', { count: 'exact', head: true }),
      db.from('workers').select('id', { count: 'exact', head: true }).eq('status', 'online'),
      db.from('export_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    ]);
    const el = id => document.getElementById(id);
    if (el('statPacks'))   el('statPacks').textContent   = packsRes.count   ?? 0;
    if (el('statAssets'))  el('statAssets').textContent  = assetsRes.count  ?? 0;
    if (el('statWorkers')) el('statWorkers').textContent = workersRes.count ?? 0;
    if (el('statExports')) el('statExports').textContent = exportsRes.count ?? 0;
  } catch (err) {
    console.error('Stats refresh failed:', err);
  }
}
window.refreshStats = refreshStats;

function toast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = '// ' + message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
window.toast = toast;

function timeAgo(isoString) {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}
window.timeAgo = timeAgo;

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.07 });
  els.forEach(el => obs.observe(el));
}

function initMusicPlayer() {
  const audio = document.getElementById('audioPlayer');
  const btn = document.getElementById('playBtn');
  const fill = document.getElementById('progressFill');
  const title = document.getElementById('musicTitle');
  if (!audio) return;

  audio.addEventListener('loadedmetadata', () => {
    title.textContent = '♪ Tours — Enthusiast (CC License)';
  });
  audio.addEventListener('error', () => {
    title.textContent = '♪ Drop your MP3 link to activate player';
  });
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });

  window.togglePlay = function() {
    if (audio.paused) {
      audio.play().then(() => { btn.textContent = '⏸'; }).catch(() => {
        title.textContent = '♪ Click play to start music';
      });
    } else {
      audio.pause();
      btn.textContent = '▶';
    }
  };
  window.setVol = function(v) { audio.volume = v; };
  window.seekMusic = function(e) {
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initReveal();
  initMusicPlayer();
  loadPacks();
  refreshStats();
  setInterval(refreshStats, 60000);
});
