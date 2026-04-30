function field(id) {
  return document.getElementById(id).value.trim();
}

function buildPrompt() {
  const branch = field("branch") || "South Dreams";
  const theme = field("theme") || "a meaningful custom design";
  const target = field("target") || "print-on-demand artwork";
  const style = field("style") || "gritty, emotional, high-contrast";
  const words = field("words");
  const notes = field("notes");
  const wordLine = words ? `Include the exact words: "${words}".` : "Do not include text unless it improves the design.";
  const noteLine = notes ? `Customer notes: ${notes}` : "Keep the concept focused, readable, and product-ready.";

  return [
    `Create one ${branch} image concept for ${target}.`,
    `Theme: ${theme}.`,
    `Style: ${style}.`,
    wordLine,
    "Use the South Dreams visual world: raw but caring, rust and bone tones, strong contrast, handmade energy, and a design that can work on a real product mockup.",
    "Make the composition centered, clean, and usable for print-on-demand. Avoid clutter, tiny unreadable details, fake watermarks, and generic stock-photo energy.",
    noteLine
  ].join("\n");
}

function improvePrompt() {
  const prompt = buildPrompt();
  document.getElementById("promptOutput").textContent = prompt;
}

function escapeSvg(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortText(value, fallback, limit) {
  const text = value || fallback;
  return text.length > limit ? text.slice(0, limit - 1).trim() + "..." : text;
}

function splitLines(value, maxLength, maxLines) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines - 1) break;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function tspans(lines, x, startY, size, gap) {
  return lines.map((line, index) => {
    const y = startY + index * gap;
    return `<tspan x="${x}" y="${y}">${escapeSvg(line)}</tspan>`;
  }).join("");
}

function createStarterImage() {
  const branch = field("branch") || "South Dreams";
  const theme = shortText(field("theme"), "Custom Soft Rebel Concept", 54);
  const words = shortText(field("words"), "Still here. Still soft. Still rebel.", 48);
  const style = shortText(field("style"), "Rust / bone / handmade", 30);
  const prompt = buildPrompt();
  document.getElementById("promptOutput").textContent = `${prompt}\n\nStarter image created below.`;
  const themeLines = splitLines(theme, 18, 3);
  const wordLines = splitLines(words, 28, 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="68%">
      <stop offset="0%" stop-color="#321811"/>
      <stop offset="55%" stop-color="#140d0a"/>
      <stop offset="100%" stop-color="#070504"/>
    </radialGradient>
    <filter id="rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="12"/>
      <feDisplacementMap in="SourceGraphic" scale="7"/>
    </filter>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <path d="M600 170 L970 600 L600 1030 L230 600 Z" fill="none" stroke="#7b1a1a" stroke-width="4" opacity=".72"/>
  <circle cx="600" cy="600" r="250" fill="none" stroke="#c0392b" stroke-width="12" opacity=".9"/>
  <circle cx="600" cy="600" r="214" fill="none" stroke="#d9c9a3" stroke-width="2" opacity=".4"/>
  <text x="600" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#e74c3c" letter-spacing="10">${escapeSvg(branch.toUpperCase())}</text>
  <text text-anchor="middle" font-family="Georgia, serif" font-size="58" font-weight="700" fill="#d9c9a3" filter="url(#rough)">${tspans(themeLines, 600, 500, 58, 66)}</text>
  <text text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#e74c3c">${tspans(wordLines, 600, 680, 38, 48)}</text>
  <text x="600" y="770" text-anchor="middle" font-family="monospace" font-size="24" fill="#a89070" letter-spacing="5">${escapeSvg(style.toUpperCase())}</text>
  <text x="600" y="870" text-anchor="middle" font-family="monospace" font-size="22" fill="#71634e" letter-spacing="6">SOUTH DREAMS / FREE STARTER IMAGE</text>
</svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = document.getElementById("generatedImage");
  const empty = document.getElementById("emptyState");
  const download = document.getElementById("downloadLink");

  image.src = dataUrl;
  image.style.display = "block";
  empty.style.display = "none";
  download.href = dataUrl;
  download.style.display = "inline";
}

async function copyPrompt() {
  const prompt = document.getElementById("promptOutput").textContent.trim();
  if (!prompt || prompt.includes("Fill out the form")) {
    improvePrompt();
  }
  try {
    await navigator.clipboard.writeText(document.getElementById("promptOutput").textContent.trim());
  } catch (error) {
    return;
  }
}

document.getElementById("promptBtn").addEventListener("click", improvePrompt);
document.getElementById("imageBtn").addEventListener("click", createStarterImage);
document.getElementById("promptOutput").addEventListener("click", copyPrompt);
