function initExportPanel() {
  populateExportPackSelect();
  populateExportFormatSelect();
  renderFormatSpecsTable();
}
window.initExportPanel = initExportPanel;

function populateExportPackSelect() {
  const sel = document.getElementById('exportPackSelect');
  if (!sel) return;
  const packs = AppState.packs.filter(p => p.status !== 'archived');
  sel.innerHTML = '<option value="">-- Select pack --</option>' +
    packs.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
}
window.populateExportPackSelect = populateExportPackSelect;

function populateExportFormatSelect() {
  const sel = document.getElementById('exportFormatSelect');
  if (!sel) return;
  sel.innerHTML = FORMAT_SPECS.map(spec =>
    `<option value="${spec.id}">${spec.label} (${spec.format}, ${spec.dpi}dpi)</option>`
  ).join('');
}

function renderFormatSpecsTable() {
  const container = document.getElementById('formatSpecsTable');
  if (!container) return;
  container.innerHTML = `
    <table class="format-table">
      <thead>
        <tr>
          <th>Use Case</th>
          <th>Format</th>
          <th>DPI</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${FORMAT_SPECS.map(s => `
          <tr>
            <td style="color:var(--text);">${escHtml(s.label)}</td>
            <td><span class="ttag t-build">${s.format}</span></td>
            <td style="color:var(--warm);">${s.dpi}</td>
            <td>${escHtml(s.notes)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function createExportJob() {
  const packId = document.getElementById('exportPackSelect').value;
  const format = document.getElementById('exportFormatSelect').value;
  if (!packId) { toast('Select a pack to export', 'error'); return; }
  if (!format)  { toast('Select an export format', 'error'); return; }

  const btn = document.getElementById('queueExportBtn');
  btn.textContent = 'QUEUING...';
  btn.disabled = true;

  const { error } = await db.from('export_jobs').insert({ pack_id: packId, format, status: 'queued' });

  btn.textContent = 'QUEUE EXPORT';
  btn.disabled = false;

  if (error) { toast('Export queue failed: ' + error.message, 'error'); return; }
  toast('Export job queued', 'success');
  loadExportJobs();
  refreshStats();
}
window.createExportJob = createExportJob;

async function loadExportJobs() {
  const { data: jobs, error } = await db
    .from('export_jobs')
    .select('*, asset_packs(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { toast('Failed to load export jobs', 'error'); return; }
  AppState.exports = jobs || [];
  renderExportQueue(jobs || []);
}
window.loadExportJobs = loadExportJobs;

function renderExportQueue(jobs) {
  const queue = document.getElementById('exportQueue');
  if (!queue) return;
  if (jobs.length === 0) {
    queue.innerHTML = '<div class="empty-state">No export jobs yet. Queue one above.</div>';
    return;
  }
  queue.innerHTML = jobs.map(job => {
    const spec = FORMAT_SPECS.find(s => s.id === job.format) || { label: job.format, format: '?' };
    const statusClass = job.status === 'running' ? 'running' : job.status === 'done' ? 'done' : (job.status === 'failed' || job.status === 'cancelled') ? 'failed' : '';
    const tagClass = job.status === 'done' ? 't-live' : job.status === 'running' ? 't-build' : job.status === 'failed' ? 't-error' : 't-soon';
    const packName = job.asset_packs?.name || 'Unknown Pack';
    const downloadBtn = (job.status === 'done' && job.output_url)
      ? `<a href="${escHtml(job.output_url)}" class="btn btn-warm" style="padding:.4rem .9rem;font-size:.6rem;" target="_blank">DOWNLOAD</a>` : '';
    const cancelBtn = (job.status === 'queued' || job.status === 'running')
      ? `<button class="btn btn-ghost" onclick="cancelExportJob('${job.id}')">CANCEL</button>` : '';
    const retryBtn = (job.status === 'failed' || job.status === 'cancelled')
      ? `<button class="btn btn-ghost" onclick="retryExportJob('${job.id}')">RETRY</button>` : '';
    return `
      <div class="export-job ${statusClass}">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:var(--warm);">${escHtml(packName)}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:.65rem;color:var(--dim);">${escHtml(spec.label)} — ${timeAgo(job.created_at)}</div>
        </div>
        <span class="ttag ${tagClass}">${job.status}</span>
        <div class="export-job-actions">${downloadBtn}${cancelBtn}${retryBtn}</div>
      </div>`;
  }).join('');
}

async function cancelExportJob(jobId) {
  const { error } = await db.from('export_jobs').update({ status: 'cancelled' }).eq('id', jobId);
  if (error) { toast('Cancel failed', 'error'); return; }
  toast('Export job cancelled', 'success');
  loadExportJobs();
}
window.cancelExportJob = cancelExportJob;

async function retryExportJob(jobId) {
  const { error } = await db.from('export_jobs').update({ status: 'queued' }).eq('id', jobId);
  if (error) { toast('Retry failed', 'error'); return; }
  toast('Job re-queued', 'success');
  loadExportJobs();
}
window.retryExportJob = retryExportJob;

function triggerExport(packId) {
  const tab = document.querySelector('[data-panel="exports"]');
  if (tab) {
    tab.click();
    setTimeout(() => {
      const sel = document.getElementById('exportPackSelect');
      if (sel) sel.value = packId;
    }, 150);
  }
}
window.triggerExport = triggerExport;
