/**
 * ANSI Escape Sequence Parser & HTML Renderer
 * Converts raw terminal output and AI agent stream events into clean, safe, styled HTML and plain text.
 */

const ANSI_COLOR_MAP: Record<number, string> = {
  // Standard foreground colors
  30: '#64748b', // Black / Gray
  31: '#f87171', // Red
  32: '#4ade80', // Green
  33: '#facc15', // Yellow
  34: '#60a5fa', // Blue
  35: '#c084fc', // Magenta
  36: '#22d3ee', // Cyan
  37: '#e2e8f0', // White / Light Slate

  // Bright / High-Intensity foreground colors
  90: '#94a3b8', // Bright Black / Slate
  91: '#fca5a5', // Bright Red
  92: '#86efac', // Bright Green
  93: '#fde047', // Bright Yellow
  94: '#93c5fd', // Bright Blue
  95: '#d8b4fe', // Bright Magenta
  96: '#67e8f9', // Bright Cyan
  97: '#ffffff', // Bright White
};

const ANSI_BG_MAP: Record<number, string> = {
  40: '#0f172a',
  41: '#7f1d1d',
  42: '#14532d',
  43: '#713f12',
  44: '#1e3a8a',
  45: '#581c87',
  46: '#164e63',
  47: '#334155',
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes raw terminal text by handling cursor overwrites (\r),
 * clearing screens, and stripping all ECMA-48 control sequences (including DECSCUSR \x1b[0 q).
 */
export function normalizeTerminalText(raw: string): string {
  if (!raw) return '';

  // Standardize newlines
  let text = raw.replace(/\r\n/g, '\n');

  // Strip OSC sequences: \x1b]...\x07 or \x1b]...\x1b\\
  text = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');

  // Strip non-standard SGR / keyboard protocol sequences like \x1b[>4;2m, \x1b[?1049h, etc.
  text = text.replace(/\x1b\[[<>=?][0-9;]*[a-zA-Z]/g, '');

  // Strip all non-SGR ECMA-48 CSI sequences (such as \x1b[0 q, \x1b[?2026h, \x1b[?25l, \x1b[1;44H, \x1b[2K)
  text = text.replace(/\x1b\[[0-?]*[ -/]*[@-ln-~]/g, '');

  // Strip any raw leaked terminal artifact fragments like [>4;2m or [0 q
  text = text.replace(/\[[>][0-9;]*m/g, '');

  // Remove charset designation sequences: \x1b(0, \x1b(B, etc.
  text = text.replace(/\x1b\([0-2B]/g, '');

  // Remove non-printable control characters (except \n, \r, \t, \x1b)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F]/g, '');

  // Handle standalone \r (line overwrites from spinners / progress bars)
  const lines = text.split('\n');
  const processedLines: string[] = [];

  for (const line of lines) {
    if (line.includes('\r')) {
      const parts = line.split('\r');
      const last = parts.filter((p) => p.trim().length > 0).pop() ?? parts[parts.length - 1] ?? '';
      processedLines.push(last);
    } else {
      processedLines.push(line);
    }
  }

  return processedLines.join('\n');
}

/**
 * Converts raw terminal stream output to styled HTML.
 */
export function ansiToHtml(raw: string): string {
  if (!raw) return '';

  const normalized = normalizeTerminalText(raw);

  let html = '';
  let activeSpanCount = 0;

  // Regex to match ANSI SGR codes: \x1b[...m
  const sgrRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = sgrRegex.exec(normalized)) !== null) {
    const textChunk = normalized.slice(lastIndex, match.index);
    if (textChunk) {
      html += escapeHtml(textChunk);
    }
    lastIndex = sgrRegex.lastIndex;

    const rawCodes = match[1];
    const codes = rawCodes ? rawCodes.split(';').map((n) => parseInt(n, 10)) : [0];

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];

      if (code === 0) {
        // Reset all styles
        while (activeSpanCount > 0) {
          html += '</span>';
          activeSpanCount--;
        }
      } else if (code === 1) {
        html += '<span style="font-weight: 700;">';
        activeSpanCount++;
      } else if (code === 2) {
        html += '<span style="opacity: 0.65;">';
        activeSpanCount++;
      } else if (code === 3) {
        html += '<span style="font-style: italic;">';
        activeSpanCount++;
      } else if (code === 4) {
        html += '<span style="text-decoration: underline;">';
        activeSpanCount++;
      } else if (code === 9) {
        html += '<span style="text-decoration: line-through;">';
        activeSpanCount++;
      } else if (ANSI_COLOR_MAP[code]) {
        html += `<span style="color: ${ANSI_COLOR_MAP[code]};">`;
        activeSpanCount++;
      } else if (ANSI_BG_MAP[code]) {
        html += `<span style="background-color: ${ANSI_BG_MAP[code]}; padding: 0 2px; border-radius: 2px;">`;
        activeSpanCount++;
      } else if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        // 256 colors: 38;5;n
        const colorIndex = codes[i + 2];
        i += 2;
        const hue = (colorIndex * 37) % 360;
        html += `<span style="color: hsl(${hue}, 75%, 65%);">`;
        activeSpanCount++;
      } else if (code === 38 && codes[i + 1] === 2 && codes[i + 2] !== undefined && codes[i + 3] !== undefined && codes[i + 4] !== undefined) {
        // 24-bit RGB: 38;2;r;g;b
        const r = codes[i + 2];
        const g = codes[i + 3];
        const b = codes[i + 4];
        i += 4;
        html += `<span style="color: rgb(${r}, ${g}, ${b});">`;
        activeSpanCount++;
      } else if (code === 39) {
        // Reset foreground color
        if (activeSpanCount > 0) {
          html += '</span>';
          activeSpanCount--;
        }
      }
    }
  }

  const remaining = normalized.slice(lastIndex);
  if (remaining) {
    html += escapeHtml(remaining);
  }

  while (activeSpanCount > 0) {
    html += '</span>';
    activeSpanCount--;
  }

  return html;
}

/**
 * Strips all ANSI codes to return clean plain text for copying or file export.
 */
export function stripAnsiToPlainText(raw: string): string {
  if (!raw) return '';
  const text = normalizeTerminalText(raw);
  return text.replace(/\x1b\[[0-9;]*m/g, '').trim();
}
