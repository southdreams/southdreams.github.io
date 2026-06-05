'use strict';

// ── STATE ──────────────────────────────────────────────
const state = {
  allFiles: [],
  imageFiles: [],          // images only (used for accurate counts)
  duplicates: [],
  blurry: [],
  blank: [],
  reviewing: [],
  reviewIndex: 0,
  reviewType: '',
  kept: 0,
  deleted: 0,
  labeled: 0,
  markedForDeletion: new Set()
};

// ── DOM REFS ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  home:    $('screen-home'),
  review:  $('screen-review'),
  gallery: $('screen-gallery'),
  done:    $('screen-done')
};

// ── SCREEN NAVIGATION ─────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, duration = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── FORMAT HELPERS ────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── BLUR / BLANK DETECTION ────────────────────────────
function analyzeImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 200 / Math.max(img.width, img.height));
      canvas.width  = Math.floor(img.width  * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0, sumSq = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        sum += lum; sumSq += lum * lum; count++;
      }
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      URL.revokeObjectURL(url);
      resolve({ mean, variance });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ mean: 0, variance: 0 }); };
    img.src = url;
  });
}

// ── SCAN FILES ────────────────────────────────────────
async function scanFiles(files) {
  const overlay = $('scanning-overlay');
  const scanMsg = $('scan-msg');
  overlay.classList.add('show');

  state.allFiles   = Array.from(files);
  state.duplicates = [];
  state.blurry     = [];
  state.blank      = [];
  state.markedForDeletion = new Set();
  state.kept = 0;
  state.deleted = 0;

  const imageFiles = state.allFiles.filter(f => f.type.startsWith('image/'));
  const videoFiles = state.allFiles.filter(f => f.type.startsWith('video/'));
  state.imageFiles = imageFiles;

  // ── Duplicates: group by size, then confirm by sampling pixel data ──
  scanMsg.textContent = 'Checking for duplicates…';
  const sizeMap = {};
  imageFiles.forEach(f => {
    const key = f.size;
    if (!sizeMap[key]) sizeMap[key] = [];
    sizeMap[key].push(f);
  });

  // For size-collision groups, verify with a quick hash of the first pixel row
  for (const group of Object.values(sizeMap)) {
    if (group.length < 2) continue;
    // Use a lightweight canvas sample to avoid false-positive size collisions
    const hashes = await Promise.all(group.map(f => quickHash(f)));
    const hashCount = {};
    hashes.forEach((h, i) => {
      if (!hashCount[h]) hashCount[h] = [];
      hashCount[h].push(group[i]);
    });
    Object.values(hashCount).forEach(dupeGroup => {
      if (dupeGroup.length > 1) dupeGroup.slice(1).forEach(f => state.duplicates.push(f));
    });
  }

  // ── Blur / blank analysis ──
  let i = 0;
  for (const f of imageFiles) {
    i++;
    scanMsg.textContent = `Analyzing ${i} of ${imageFiles.length}…`;
    const { variance } = await analyzeImage(f);
    // Skip if already flagged as duplicate (avoid double-counting)
    const alreadyDupe = state.duplicates.includes(f);
    if (!alreadyDupe) {
      if (variance < 150)      state.blank.push(f);
      else if (variance < 600) state.blurry.push(f);
    }
  }

  overlay.classList.remove('show');

  const totalFlagged = state.duplicates.length + state.blurry.length + state.blank.length;

  $('total-count').textContent   = (imageFiles.length + videoFiles.length).toLocaleString();
  $('flagged-count').textContent = totalFlagged.toLocaleString();
  $('dup-count').textContent     = state.duplicates.length;
  $('blur-count').textContent    = state.blurry.length;
  $('blank-count').textContent   = state.blank.length;

  ['dup-count','blur-count','blank-count'].forEach(id => {
    $(id).classList.toggle('zero', parseInt($(id).textContent) === 0);
  });

  ['btn-dup','btn-blur','btn-blank'].forEach(id => $(id).disabled = false);

  const reviewAllBtn = $('btn-review-all');
  if (totalFlagged > 0) {
    reviewAllBtn.style.display = 'flex';
    reviewAllBtn.querySelector('.cat-sub').textContent = `${totalFlagged} photos to look over`;
  } else {
    reviewAllBtn.style.display = 'none';
  }

  toast(`💀 Done — ${imageFiles.length + videoFiles.length} files checked`);
}

// ── QUICK IMAGE HASH (first 20px row sample) ──────────
function quickHash(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(20, img.width);
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, 1);
      const data = ctx.getImageData(0, 0, canvas.width, 1).data;
      URL.revokeObjectURL(url);
      // Simple checksum of pixel bytes
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = (hash * 31 + data[i]) >>> 0;
      }
      resolve(hash.toString(16));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve('err-' + Math.random()); };
    img.src = url;
  });
}

// ── ONE-BY-ONE REVIEW ─────────────────────────────────
function startReview(type) {
  const map = { duplicate: state.duplicates, blurry: state.blurry, blank: state.blank };
  const list = map[type];
  if (!list || list.length === 0) { toast('Nothing to review here!'); return; }
  state.reviewing   = list;
  state.reviewIndex = 0;
  state.reviewType  = type;
  showScreen('review');
  const titles = { duplicate: '🗂 Duplicate Photos', blurry: '👁 Blurry Photos', blank: '⬛ Blank / Dark Photos' };
  $('review-title').textContent = titles[type];
  showReviewItem();
}

function showReviewItem() {
  const list  = state.reviewing;
  const index = state.reviewIndex;
  const total = list.length;
  if (index >= total) {
    showScreen('home');
    toast('✓ Category done — back to the roundup');
    return;
  }

  const file = list[index];
  const pct  = Math.round((index / total) * 100);
  $('progress-fill').style.width = pct + '%';
  $('progress-text').textContent = `${index + 1} of ${total}`;

  const preview   = $('photo-preview');
  const noPreview = $('no-preview');
  if (file.type.startsWith('image/')) {
    // Revoke previous blob URL if any
    if (preview.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
    const url = URL.createObjectURL(file);
    preview.dataset.blobUrl = url;
    preview.src = url;
    preview.style.display = 'block';
    noPreview.style.display = 'none';
  } else {
    preview.style.display = 'none';
    noPreview.style.display = 'flex';
    noPreview.textContent = '🎥';
  }

  const badge = $('flag-badge');
  badge.textContent = state.reviewType;
  badge.className   = 'flag-badge flag-' + state.reviewType;

  $('meta-name').textContent = file.name;
  $('meta-size').textContent = fmtSize(file.size);
  $('meta-date').textContent = fmtDate(file.lastModified);
  $('label-input').value = '';
}

function keepPhoto() {
  const label = $('label-input').value.trim();
  toast(label ? `✓ Saved with tag: "${label}"` : '✓ Keeper');
  state.kept++;
  state.reviewIndex++;
  showReviewItem();
}

function deletePhoto() {
  state.markedForDeletion.add(state.reviewing[state.reviewIndex]);
  state.deleted++;
  toast('💀 Added to the hit list');
  state.reviewIndex++;
  showReviewItem();
}

// ── SWIPE SUPPORT ON REVIEW SCREEN ───────────────────
(function initSwipe() {
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 60;
  const ANGLE_LIMIT = 45;

  const reviewScreen = $('screen-review');

  reviewScreen.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  reviewScreen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Ignore if vertical swipe dominates
    if (Math.abs(dy) > Math.abs(dx) * Math.tan(ANGLE_LIMIT * Math.PI / 180)) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    // Don't trigger swipe on input fields
    if (e.target.closest('input, button')) return;

    if (dx > 0) {
      keepPhoto();    // swipe right = keep
    } else {
      deletePhoto();  // swipe left  = delete
    }
  }, { passive: true });
})();

// ── GALLERY SCREEN ────────────────────────────────────
function openGallery() {
  const seen = new Set();
  const allFlagged = [];
  const addWithType = (arr, type) => arr.forEach(f => {
    if (!seen.has(f.name)) { seen.add(f.name); allFlagged.push({ file: f, type }); }
  });
  addWithType(state.duplicates, 'duplicate');
  addWithType(state.blurry,     'blurry');
  addWithType(state.blank,      'blank');

  if (allFlagged.length === 0) { toast('Nothing flagged to show!'); return; }

  const grid = $('gallery-grid');
  grid.innerHTML = '';

  $('gallery-total').textContent = allFlagged.length;
  updateGalleryCounter();

  allFlagged.forEach(({ file, type }) => {
    const cell = document.createElement('div');
    cell.className = 'gallery-cell';
    cell.dataset.name = file.name;

    if (state.markedForDeletion.has(file)) cell.classList.add('marked');

    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      img.alt = file.name;
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = '<span style="font-size:28px;">🎥</span>';
    }

    const badge = document.createElement('span');
    badge.className = `gallery-badge flag-${type}`;
    badge.textContent = type;
    thumb.appendChild(badge);

    const xmark = document.createElement('div');
    xmark.className = 'gallery-xmark';
    xmark.textContent = '✕';
    thumb.appendChild(xmark);

    cell.appendChild(thumb);

    const name = document.createElement('div');
    name.className = 'gallery-name';
    name.textContent = file.name;
    cell.appendChild(name);

    cell.addEventListener('click', () => {
      const marked = cell.classList.toggle('marked');
      if (marked) {
        state.markedForDeletion.add(file);
      } else {
        state.markedForDeletion.delete(file);
      }
      updateGalleryCounter();
    });

    grid.appendChild(cell);
  });

  showScreen('gallery');
}

function updateGalleryCounter() {
  const count = state.markedForDeletion.size;
  $('gallery-marked-count').textContent = count;
  const btn = $('btn-gallery-done');
  btn.textContent = count > 0
    ? `🗑 Confirm ${count} for deletion`
    : 'Done — nothing marked';
}

// ── SELECT ALL IN GALLERY ─────────────────────────────
function gallerySelectAll() {
  const cells = $('gallery-grid').querySelectorAll('.gallery-cell');
  const allMarked = [...cells].every(c => c.classList.contains('marked'));

  // Toggle: if all marked, unmark all; otherwise mark all
  cells.forEach(cell => {
    const name = cell.dataset.name;
    // Find the file object for this cell
    const allFlagged = [...state.duplicates, ...state.blurry, ...state.blank];
    const file = allFlagged.find(f => f.name === name);
    if (!file) return;

    if (allMarked) {
      cell.classList.remove('marked');
      state.markedForDeletion.delete(file);
    } else {
      cell.classList.add('marked');
      state.markedForDeletion.add(file);
    }
  });
  updateGalleryCounter();
}

function galleryDone() {
  state.deleted = state.markedForDeletion.size;
  showDone();
}

// ── DONE SCREEN ───────────────────────────────────────
function showDone() {
  // Use scanned image count for accuracy, not raw allFiles (which may include videos not analyzed)
  const scanned = state.imageFiles.length;
  $('done-kept').textContent    = Math.max(0, scanned - state.markedForDeletion.size).toString();
  $('done-deleted').textContent = state.markedForDeletion.size.toString();

  const listEl = $('deletion-list');
  listEl.innerHTML = '';

  if (state.markedForDeletion.size > 0) {
    $('deletion-section').style.display = 'block';

    // Build the list
    state.markedForDeletion.forEach(f => {
      const li = document.createElement('li');
      li.className = 'deletion-item';
      if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        const url = URL.createObjectURL(f);
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        img.className = 'deletion-thumb';
        li.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size:20px; flex-shrink:0;';
        icon.textContent = '🎥';
        li.appendChild(icon);
      }
      const info = document.createElement('div');
      info.className = 'deletion-info';
      const fname = document.createElement('span');
      fname.className = 'deletion-fname';
      fname.textContent = f.name;
      const fsize = document.createElement('span');
      fsize.className = 'deletion-fsize';
      fsize.textContent = fmtSize(f.size);
      info.appendChild(fname);
      info.appendChild(fsize);
      li.appendChild(info);
      listEl.appendChild(li);
    });

    // Copy-to-clipboard button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-list';
    copyBtn.textContent = '📋 Copy filenames to clipboard';
    copyBtn.addEventListener('click', () => {
      const names = [...state.markedForDeletion].map(f => f.name).join('\n');
      navigator.clipboard.writeText(names).then(() => {
        toast('✓ Filenames copied!');
      }).catch(() => {
        // Fallback for browsers without clipboard API
        const ta = document.createElement('textarea');
        ta.value = names;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('✓ Filenames copied!');
      });
    });
    listEl.appendChild(copyBtn);

    const note = document.createElement('p');
    note.className = 'deletion-note';
    note.textContent = 'Open your Gallery or Files app and finish the job. We never delete a single thing ourselves — that trigger is yours to pull.';
    listEl.appendChild(note);
  } else {
    $('deletion-section').style.display = 'none';
  }

  showScreen('done');
}

// ── RESET ─────────────────────────────────────────────
function resetApp() {
  Object.assign(state, {
    allFiles: [], imageFiles: [], duplicates: [], blurry: [], blank: [],
    reviewing: [], reviewIndex: 0, reviewType: '',
    kept: 0, deleted: 0, labeled: 0,
    markedForDeletion: new Set()
  });
  ['total-count','flagged-count','dup-count','blur-count','blank-count']
    .forEach(id => $(id).textContent = '0');
  ['dup-count','blur-count','blank-count'].forEach(id => $(id).classList.add('zero'));
  ['btn-dup','btn-blur','btn-blank'].forEach(id => $(id).disabled = true);
  $('btn-review-all').style.display = 'none';
  // Reset file input so re-selecting same files triggers change event
  $('file-input').value = '';
  showScreen('home');
}

// ── EVENT LISTENERS ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Scan area — click and keyboard activation
  const scanArea = $('scan-area');
  scanArea.addEventListener('click', () => $('file-input').click());
  scanArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file-input').click(); }
  });
  $('file-input').addEventListener('change', e => {
    if (e.target.files.length > 0) scanFiles(e.target.files);
  });

  // Drag & drop
  scanArea.addEventListener('dragover',  e => { e.preventDefault(); scanArea.style.borderColor = 'var(--rust)'; });
  scanArea.addEventListener('dragleave', ()  => { scanArea.style.borderColor = ''; });
  scanArea.addEventListener('drop', e => {
    e.preventDefault(); scanArea.style.borderColor = '';
    if (e.dataTransfer.files.length > 0) scanFiles(e.dataTransfer.files);
  });

  // Home buttons
  $('btn-dup').addEventListener('click',        () => startReview('duplicate'));
  $('btn-blur').addEventListener('click',       () => startReview('blurry'));
  $('btn-blank').addEventListener('click',      () => startReview('blank'));
  $('btn-review-all').addEventListener('click', openGallery);

  // One-by-one review
  $('btn-keep').addEventListener('click',   keepPhoto);
  $('btn-delete').addEventListener('click', deletePhoto);
  $('btn-back').addEventListener('click',   () => showScreen('home'));

  // Keyboard shortcuts on review screen
  document.addEventListener('keydown', e => {
    if (!screens.review.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'k') keepPhoto();
    if (e.key === 'ArrowLeft'  || e.key === 'd') deletePhoto();
  });

  // Gallery
  $('btn-gallery-back').addEventListener('click', () => showScreen('home'));
  $('btn-gallery-done').addEventListener('click', galleryDone);
  $('btn-select-all').addEventListener('click', gallerySelectAll);

  // Done
  $('btn-reset').addEventListener('click', resetApp);

  // PWA install
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('install-btn').style.display = 'block';
  });
  $('install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') toast('✓ App installed!');
    deferredPrompt = null;
    $('install-btn').style.display = 'none';
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
