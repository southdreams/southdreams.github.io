# 📷 Photo Cleaner — Dirty Road Creations

A free, privacy-first tool for cleaning up duplicate, blurry, and blank photos from your device. Runs entirely in your browser — no uploads, no accounts, no cloud.

---

## ✨ Features

- **Duplicate detection** — finds photos that are the same file
- **Blur detection** — flags low-sharpness images automatically
- **Blank / dark photo detection** — catches accidental black screens and solid-color shots
- **One-by-one review** — swipe or tap through each flagged photo and decide
- **Gallery view** — see all flagged photos in a grid and batch-mark them
- **Nothing is ever deleted automatically** — you stay in control

---

## 📲 How to Install (Mobile — Recommended)

Photo Cleaner is a **Progressive Web App (PWA)**. That means you can install it on your phone like a real app — no app store required.

**On iPhone (Safari):**
1. Open the app URL in Safari
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — it'll appear on your home screen like a regular app

**On Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the **⋮ menu** (three dots, top right)
3. Tap **Add to Home Screen** or look for an **Install App** banner
4. Tap **Install**

---

## 💻 How to Use (Desktop)

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
2. Drag and drop photos onto the scan area, or click to pick a folder
3. Wait for the scan to finish — it runs entirely on your device
4. Review flagged photos by category or tap **Review All Flagged Photos**
5. Use the **Done** screen to see which files to delete, and copy the filenames if needed

---

## ⌨️ Keyboard Shortcuts (Desktop)

| Key | Action |
|-----|--------|
| `→` or `K` | Keep photo |
| `←` or `D` | Mark for deletion |

---

## 📁 Running Locally

No build step, no npm install. Just open the file:

```bash
# Option 1 — open directly
open index.html

# Option 2 — local server (needed for PWA features like service worker)
python3 -m http.server 8080
# then visit http://localhost:8080
```

> The service worker (offline support + PWA install) only activates when served over HTTP or HTTPS, not from a `file://` URL. For basic use, opening `index.html` directly is fine.

---

## 🔒 Privacy

Everything runs locally in your browser. No photos, filenames, or metadata ever leave your device. There is no backend, no analytics, and no account required.

---

## 🗂 File Structure

```
dirty-road-photo-cleaner/
├── index.html       — app shell and all four screens
├── app.js           — scan logic, review flow, gallery, state
├── style.css        — dark western theme, responsive layout
├── sw.js            — service worker for offline/PWA support
├── manifest.json    — PWA metadata (name, icons, theme)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🛠 Built By

**Dirty Road Creations** — maker tools for real people.  
[buymeacoffee.com/southdreams](https://www.buymeacoffee.com/southdreams) · [fiverr.com/southdreams_hq](https://www.fiverr.com/southdreams_hq)
