function formatCreatorTargets(value) {
  const mapping = {
    'stickers': 'sticker art',
    'pod': 'print-on-demand artwork',
    'game-assets': 'game-ready assets',
    'vector-art': 'vector-friendly art',
    'social': 'social media graphics',
    'icons': 'iconography and UI elements'
  };
  return mapping[value] || value.replace(/-/g, ' ');
}

function generateCreatorPrompt() {
  const theme = document.getElementById('creatorTheme').value.trim();
  const count = parseInt(document.getElementById('creatorCount').value, 10) || 1;
  const targets = document.getElementById('creatorTargets').value;
  const style = document.getElementById('creatorStyle').value.trim();
  if (!theme) {
    alert('Please enter a theme or concept first.');
    return;
  }

  const countText = count === 1 ? 'a single high-resolution image' : `${count} high-resolution images`;
  const styleText = style ? ` in a ${style} style` : '';
  const targetText = formatCreatorTargets(targets);
  const prompt = `Create ${countText} of ${targetText} featuring ${theme}${styleText}. Make the art game-ready and print-ready, with strong composition, bold shapes, and clean details suitable for 4K output or vector conversion.`;

  const output = document.getElementById('creatorPrompt');
  output.textContent = prompt;
}

async function copyCreatorPrompt() {
  const prompt = document.getElementById('creatorPrompt').textContent.trim();
  if (!prompt) {
    alert('Generate a prompt first.');
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
    alert('Prompt copied to clipboard.');
  } catch (err) {
    alert('Copy failed. Please select and copy manually.');
  }
}
