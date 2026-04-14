const WORKER_TYPES = {
  android: { label: 'Android Device', icon: '[ANDROID]' },
  wsl2:    { label: 'WSL2 Process',   icon: '[LINUX]'   },
  desktop: { label: 'Desktop',        icon: '[DESKTOP]' },
};

async function loadWorkers() {
  const { data: workers, error } = await db
    .from('workers')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) { toast('Failed to load workers', 'error'); return; }
  AppState.workers = workers || [];
  renderWorkerGrid(workers || []);
  renderWorkerLog(workers || []);
}
window.loadWorkers = loadWorkers;

function renderWorkerGrid(workers) {
  const grid = document.getElementById('workersGrid');
  if (!grid) return;
  if (workers.length === 0) {
    grid.innerHTML = '<div class="empty-state">No workers registered. Add one above.</div>';
    return;
  }
  grid.innerHTML = workers.map(w => {
    const dotClass = w.status === 'online' ? 'wdot-online' : w.status === 'idle' ? 'wdot-idle' : 'wdot-offline';
    const typeInfo = WORKER_TYPES[w.type] || { label: w.type, icon: '[?]' };
    const statusTagClass = w.status === 'online' ? 't-live' : w.status === 'idle' ? 't-build' : 't-soon';
    return `
      <div class="worker-card">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
          <span class="worker-status-dot ${dotClass}"></span>
          <span class="worker-name">${escHtml(w.name)}</span>
        </div>
        <div class="worker-type">${typeInfo.icon} ${typeInfo.label}</div>
        <div class="worker-last-seen">Last seen: ${timeAgo(w.last_seen)}</div>
        <div style="margin-top:.5rem;"><span class="ttag ${statusTagClass}">${w.status}</span></div>
        <div class="worker-actions">
          <button class="btn btn-warm" onclick="pingWorker('${w.id}')">PING</button>
          <button class="btn btn-ghost" onclick="removeWorker('${w.id}','${escHtml(w.name)}')">REMOVE</button>
        </div>
      </div>`;
  }).join('');
}

function renderWorkerLog(workers) {
  const body = document.getElementById('workerLogBody');
  if (!body) return;
  if (workers.length === 0) {
    body.innerHTML = '<span class="tc">// no workers registered</span>';
    return;
  }
  const lines = workers.slice(0, 20).map(w => {
    const color = w.status === 'online' ? 'tgreen' : w.status === 'idle' ? 'tg' : 'tr';
    const typeInfo = WORKER_TYPES[w.type] || { label: w.type };
    return `<span class="tc">[${timeAgo(w.last_seen)}]</span> <span class="${color}">${escHtml(w.name)}</span> <span class="tc">— ${typeInfo.label} — </span><span class="${color}">${w.status}</span>`;
  });
  body.innerHTML = lines.join('<br/>');
}

async function registerWorker() {
  const name = document.getElementById('workerName').value.trim();
  const type = document.getElementById('workerType').value;
  if (!name) { toast('Worker name required', 'error'); return; }

  const btn = document.getElementById('registerWorkerBtn');
  btn.textContent = 'REGISTERING...';
  btn.disabled = true;

  const { error } = await db.from('workers').insert({
    name, type, status: 'offline', last_seen: new Date().toISOString()
  });

  btn.textContent = 'REGISTER WORKER';
  btn.disabled = false;

  if (error) { toast('Register failed: ' + error.message, 'error'); return; }
  document.getElementById('workerName').value = '';
  toast('Worker registered: ' + name, 'success');
  loadWorkers();
  refreshStats();
}
window.registerWorker = registerWorker;

async function pingWorker(workerId) {
  const { error } = await db.from('workers').update({
    status: 'online', last_seen: new Date().toISOString()
  }).eq('id', workerId);
  if (error) { toast('Ping failed', 'error'); return; }
  toast('Pong — worker marked online', 'success');
  loadWorkers();
  refreshStats();
}
window.pingWorker = pingWorker;

async function removeWorker(workerId, workerName) {
  if (!confirm('Remove worker "' + workerName + '"?')) return;
  const { error } = await db.from('workers').delete().eq('id', workerId);
  if (error) { toast('Remove failed', 'error'); return; }
  toast('Worker removed', 'success');
  loadWorkers();
  refreshStats();
}
window.removeWorker = removeWorker;

async function detectOfflineWorkers() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await db.from('workers')
    .update({ status: 'offline' })
    .eq('status', 'online')
    .lt('last_seen', fiveMinutesAgo);
}
window.detectOfflineWorkers = detectOfflineWorkers;
