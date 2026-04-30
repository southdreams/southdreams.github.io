function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escHtml = escHtml;

function getPackInputValues() {
  const theme = document.getElementById('packTheme')?.value.trim() || '';
  const count = parseInt(document.getElementById('packCount')?.value, 10) || 0;
  const style = document.getElementById('packStyle')?.value.trim() || '';
  const targets = Array.from(document.querySelectorAll('#newPackForm .tag-check input:checked')).map(el => el.value);
  return { theme, count, style, targets };
}
window.getPackInputValues = getPackInputValues;

function formatPromptTargets(targets) {
  if (!targets || targets.length === 0) return 'mixed assets';
  return targets.map(t => t.replace(/-/g, ' ')).join(', ');
}

function generatePackPrompt() {
  const { theme, count, style, targets } = getPackInputValues();
  if (!theme) { toast('Enter a theme first', 'error'); return ''; }
  const targetText = formatPromptTargets(targets);
  const countText = count > 0 ? `${count} image${count === 1 ? '' : 's'}` : 'a set of images';
  const styleText = style ? `${style}, ` : '';
  const prompt = `Create ${countText} of ${targetText} with a ${theme} theme. The art should be ${styleText}high-resolution, game-ready, print-ready, and sticker-friendly. Use bold textures, strong silhouettes, and a palette that works for 4K+ assets and vector-friendly layouts.`;
  const output = document.getElementById('promptSuggestion');
  if (output) output.value = prompt;
  toast('AI prompt generated', 'success');
  return prompt;
}
window.generatePackPrompt = generatePackPrompt;

async function copyPackPrompt() {
  const prompt = document.getElementById('promptSuggestion')?.value || '';
  if (!prompt) { toast('Generate a prompt first', 'error'); return; }
  try {
    await navigator.clipboard.writeText(prompt);
    toast('Prompt copied to clipboard', 'success');
  } catch (err) {
    toast('Copy failed, use manual selection', 'error');
  }
}
window.copyPackPrompt = copyPackPrompt;

function extractMetaField(text, key) {
  if (!text) return '';
  const match = text.match(new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`));
  return match ? match[1].trim() : '';
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
window.formatBytes = formatBytes;

async function loadPacks() {
  const grid = document.getElementById('packGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height:200px;grid-column:1/-1;"></div>';

  const { data: packs, error } = await db
    .from('asset_packs')
    .select('*, assets(count)')
    .order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = '<div class="empty-state">Failed to load packs. Check connection.</div>';
    toast('Failed to load packs', 'error');
    return;
  }

  AppState.packs = packs || [];
  renderPackGrid(packs || []);
  populateSheetPackSelector();
}
window.loadPacks = loadPacks;

function renderPackGrid(packs) {
  const grid = document.getElementById('packGrid');
  if (packs.length === 0) {
    grid.innerHTML = '<div class="empty-state">No packs yet. Forge your first pack above.</div>';
    return;
  }
  grid.innerHTML = packs.map(pack => {
    const count = pack.assets?.[0]?.count ?? 0;
    const theme = extractMetaField(pack.description, 'Theme');
    const tagsHTML = (pack.tags || []).map(t => `<span class="pack-tag">${escHtml(t)}</span>`).join('');
    const statusClass = pack.status === 'active' ? 't-live' : pack.status === 'building' ? 't-build' : 't-soon';
    return `
      <div class="pack-card" data-id="${pack.id}">
        <div class="pack-card-top">
          <span class="ttag ${statusClass}">${escHtml(pack.status)}</span>
          <span class="pack-asset-count">${count} asset${count !== 1 ? 's' : ''}</span>
        </div>
        <h3 class="pack-name">${escHtml(pack.name)}</h3>
        ${theme ? `<p class="pack-meta">Theme: ${escHtml(theme)}</p>` : ''}
        <p class="pack-desc">${escHtml(pack.description || '')}</p>
        <div class="pack-tags">${tagsHTML || '<span style="font-family:\'Share Tech Mono\',monospace;font-size:.6rem;color:var(--dim);">no tags</span>'}</div>
        <div class="pack-actions">
          <button class="btn btn-warm" onclick="switchToSheet('${pack.id}')">SHEET VIEW</button>
          <button class="btn btn-ghost" onclick="triggerExport('${pack.id}')">EXPORT</button>
          <button class="btn btn-ghost" onclick="archivePack('${pack.id}','${escHtml(pack.name)}')">ARCHIVE</button>
        </div>
      </div>`;
  }).join('');
}

async function createPack() {
  const name = document.getElementById('packName').value.trim();
  const desc = document.getElementById('packDesc').value.trim();
  const { theme, count, style, targets } = getPackInputValues();
  const tags = Array.from(document.querySelectorAll('#newPackForm .tag-check input:checked')).map(el => el.value);

  if (!name) { toast('Pack name is required', 'error'); return; }
  if (!theme) { toast('Theme is required', 'error'); return; }

  const prompt = document.getElementById('promptSuggestion').value.trim() || generatePackPrompt();
  const metaLines = [
    `Theme: ${theme}`,
    count ? `Quantity: ${count}` : '',
    style ? `Style: ${style}` : '',
    targets.length ? `Targets: ${formatPromptTargets(targets)}` : '',
    prompt ? `AI prompt: ${prompt}` : '',
  ].filter(Boolean);
  const finalDesc = [metaLines.join(' | '), desc].filter(Boolean).join('\n\n');

  const btn = document.getElementById('forgePack');
  btn.textContent = 'FORGING...';
  btn.disabled = true;

  const { error } = await db.from('asset_packs').insert({ name, description: finalDesc, tags, status: 'building' });

  btn.textContent = 'FORGE PACK';
  btn.disabled = false;

  if (error) { toast('Failed to create pack: ' + error.message, 'error'); return; }

  document.getElementById('packName').value = '';
  document.getElementById('packDesc').value = '';
  document.getElementById('packTheme').value = '';
  document.getElementById('packCount').value = '';
  document.getElementById('packStyle').value = '';
  document.getElementById('promptSuggestion').value = '';
  document.querySelectorAll('#newPackForm .tag-check input').forEach(el => el.checked = false);

  toast('Pack forged: ' + name, 'success');
  loadPacks();
  refreshStats();
}
window.createPack = createPack;

async function archivePack(packId, packName) {
  if (!confirm('Archive pack "' + packName + '"? It will no longer appear as active.')) return;
  const { error } = await db.from('asset_packs').update({ status: 'archived' }).eq('id', packId);
  if (error) { toast('Archive failed', 'error'); return; }
  toast('Pack archived', 'success');
  loadPacks();
}
window.archivePack = archivePack;

function switchToSheet(packId) {
  AppState.activePack = packId;
  const tab = document.querySelector('[data-panel="sheet"]');
  if (tab) tab.click();
}
window.switchToSheet = switchToSheet;

function populateSheetPackSelector() {
  const sel = document.getElementById('sheetPackSelect');
  if (!sel) return;
  const packs = AppState.packs.filter(p => p.status !== 'archived');
  sel.innerHTML = '<option value="">-- Select a pack to view --</option>' +
    packs.map(p => {
      const count = p.assets?.[0]?.count ?? 0;
      return `<option value="${p.id}">${escHtml(p.name)} (${count} assets)</option>`;
    }).join('');
  if (AppState.activePack) {
    sel.value = AppState.activePack;
    renderSheetView(AppState.activePack);
  }
}
window.populateSheetPackSelector = populateSheetPackSelector;

async function renderSheetView(packId) {
  if (!packId) return;
  AppState.activePack = packId;
  const grid = document.getElementById('sheetGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height:400px;grid-column:1/-1;"></div>';

  const { data: assets, error } = await db
    .from('assets')
    .select('*')
    .eq('pack_id', packId)
    .order('filename', { ascending: true });

  if (error) {
    grid.innerHTML = '<div class="empty-state">Failed to load assets.</div>';
    return;
  }
  if (!assets || assets.length === 0) {
    grid.innerHTML = '<div class="empty-state">No assets in this pack yet. Add assets via the worker pipeline or API.</div>';
    return;
  }

  grid.innerHTML = assets.map(asset => {
    const safeAsset = JSON.stringify(asset).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    return `
      <div class="sheet-cell" onclick="openAssetDrawer('${asset.id}', this)">
        ${asset.preview_url
          ? `<img src="${escHtml(asset.preview_url)}" alt="${escHtml(asset.filename)}" loading="lazy"/>`
          : `<div class="sheet-cell-placeholder">${escHtml(asset.type || 'NO PREVIEW')}</div>`
        }
        <div class="sheet-cell-info">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(asset.filename)}</div>
          <div>${escHtml(asset.dimensions || '—')} · ${formatBytes(asset.file_size)}</div>
        </div>
        <script type="application/json" class="asset-data">${safeAsset.replace(/<\/script>/g, '<\\/script>')}<\/script>
      </div>`;
  }).join('');
}
window.renderSheetView = renderSheetView;

function openAssetDrawer(assetId, cellEl) {
  const drawer = document.getElementById('assetDrawer');
  let asset = {};
  try {
    const scriptEl = cellEl.querySelector('.asset-data');
    if (scriptEl) asset = JSON.parse(scriptEl.textContent);
  } catch(e) {}

  drawer.innerHTML = `
    <button class="drawer-close" onclick="closeAssetDrawer()">X CLOSE</button>
    ${asset.preview_url ? `<div class="drawer-preview"><img src="${escHtml(asset.preview_url)}" style="width:100%;border:1px solid var(--aged);display:block;"/></div>` : ''}
    <div class="drawer-meta">
      <p class="field-label">FILENAME</p>
      <p>${escHtml(asset.filename || '—')}</p>
      <p class="field-label" style="margin-top:.8rem;">TYPE</p>
      <p>${escHtml(asset.type || '—')}</p>
      <p class="field-label" style="margin-top:.8rem;">DIMENSIONS</p>
      <p>${escHtml(asset.dimensions || '—')}</p>
      <p class="field-label" style="margin-top:.8rem;">FILE SIZE</p>
      <p>${formatBytes(asset.file_size)}</p>
      <p class="field-label" style="margin-top:.8rem;">PREVIEW URL</p>
      <p style="word-break:break-all;font-size:.65rem;color:var(--dim);">${escHtml(asset.preview_url || '—')}</p>
      <p class="field-label" style="margin-top:.8rem;">ADDED</p>
      <p>${asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '—'}</p>
    </div>`;
  drawer.classList.add('open');
}
window.openAssetDrawer = openAssetDrawer;

function closeAssetDrawer() {
  document.getElementById('assetDrawer').classList.remove('open');
}
window.closeAssetDrawer = closeAssetDrawer;
