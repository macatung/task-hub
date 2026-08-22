import { Marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';

const DISCOVERY_PLAN_REGEX = /<task-hub-discovery-plan>[\s\S]*?<\/task-hub-discovery-plan>/gi;

export const cleanDiscoveryPlanContent = (input?: string): string => {
  if (!input) return '';
  return input.replace(DISCOVERY_PLAN_REGEX, '').trim();
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

const ALERT_CONFIG: Record<AlertType, { title: string; icon: string; borderClass: string; textClass: string; bgClass: string }> = {
  NOTE: {
    title: 'Lưu ý',
    icon: 'info',
    borderClass: 'border-cyan-500',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-950/30',
  },
  TIP: {
    title: 'Mẹo hữu ích',
    icon: 'lightbulb',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-950/30',
  },
  IMPORTANT: {
    title: 'Quan trọng',
    icon: 'bell',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-950/30',
  },
  WARNING: {
    title: 'Cảnh báo',
    icon: 'warning',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-950/30',
  },
  CAUTION: {
    title: 'Cẩn trọng',
    icon: 'error',
    borderClass: 'border-rose-500',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-950/30',
  },
};

const formatDiffContent = (code: string): string => {
  const lines = code.split('\n');
  return lines
    .map((line) => {
      const escaped = escapeHtml(line);
      if (line.startsWith('+++') || line.startsWith('---')) {
        return `<span class="diff-line diff-meta text-slate-400 font-bold block px-1 -mx-1">${escaped}</span>`;
      }
      if (line.startsWith('+')) {
        return `<span class="diff-line diff-add text-emerald-400 bg-emerald-950/40 block px-1 -mx-1 rounded-sm">${escaped}</span>`;
      }
      if (line.startsWith('-')) {
        return `<span class="diff-line diff-del text-rose-400 bg-rose-950/40 block px-1 -mx-1 rounded-sm">${escaped}</span>`;
      }
      if (line.startsWith('@@')) {
        return `<span class="diff-line diff-chunk text-cyan-400/90 block px-1 -mx-1 italic font-semibold">${escaped}</span>`;
      }
      return `<span class="diff-line diff-ctx text-slate-300 block px-1 -mx-1">${escaped}</span>`;
    })
    .join('\n');
};

const markedInstance = new Marked();

markedInstance.use({
  gfm: true,
  breaks: true,
  renderer: {
    code(this: any, { text, lang }: Tokens.Code): string {
      const rawCode = text ?? '';
      const cleanLang = (lang || '').trim().split(/\s+/)[0].toLowerCase() || 'text';
      const displayLang = cleanLang.toUpperCase();
      const encodedCode = encodeURIComponent(rawCode);
      const escapedCode = escapeHtml(rawCode);

      // 1. Mermaid diagram code block
      if (cleanLang === 'mermaid') {
        return `<div class="mermaid-block-wrapper my-3 rounded-xl border border-slate-800 bg-[#0b0f17] overflow-hidden" data-raw-mermaid="${encodedCode}">
  <div class="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 select-none">
    <span class="font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
      <i class="codicon codicon-symbol-structure text-xs"></i>
      <span>SƠ ĐỒ MERMAID</span>
    </span>
    <div class="flex items-center gap-1.5">
      <button type="button" class="view-mermaid-source-btn text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer">
        <span>Mã nguồn</span>
      </button>
      <button type="button" class="copy-code-btn text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer flex items-center gap-1" data-code="${encodedCode}">
        <i class="codicon codicon-copy text-[11px]"></i>
        <span class="copy-label">Copy</span>
      </button>
    </div>
  </div>
  <div class="mermaid-diagram-container p-4 flex justify-center items-center overflow-x-auto text-slate-200" data-code="${encodedCode}">
    <div class="mermaid-loading flex items-center gap-2 text-xs text-slate-400 py-2">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>Đang dựng sơ đồ...</span>
    </div>
  </div>
  <pre class="mermaid-source-code hidden p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed border-t border-slate-800"><code>${escapedCode}</code></pre>
</div>`;
      }

      // 2. Diff code block
      if (cleanLang === 'diff') {
        const diffHtml = formatDiffContent(rawCode);
        return `<div class="code-block-wrapper diff-block-wrapper my-3 rounded-xl border border-slate-800 bg-[#0d1117] overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 select-none">
    <span class="font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
      <i class="codicon codicon-diff text-xs"></i>
      <span>DIFF</span>
    </span>
    <button type="button" class="copy-code-btn text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer flex items-center gap-1" data-code="${encodedCode}">
      <i class="codicon codicon-copy text-[11px]"></i>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre class="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed"><code>${diffHtml}</code></pre>
</div>`;
      }

      // 3. Standard code block
      return `<div class="code-block-wrapper my-3 rounded-xl border border-slate-800 bg-[#0d1117] overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 select-none">
    <span class="font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
      <i class="codicon codicon-code text-xs"></i>
      <span>${escapeHtml(displayLang)}</span>
    </span>
    <button type="button" class="copy-code-btn text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer flex items-center gap-1" data-code="${encodedCode}">
      <i class="codicon codicon-copy text-[11px]"></i>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre class="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed"><code>${escapedCode}</code></pre>
</div>`;
    },

    heading(this: any, { tokens, depth }: Tokens.Heading): string {
      const text = this.parser.parseInline(tokens);
      switch (depth) {
        case 1:
          return `<h1 class="markdown-h1 text-base font-bold text-slate-100 mt-4 mb-2 pb-1 border-b border-slate-800 flex items-center gap-2">${text}</h1>`;
        case 2:
          return `<h2 class="markdown-h2 text-sm font-bold text-slate-100 mt-3.5 mb-1.5 pb-0.5 border-b border-slate-800/60">${text}</h2>`;
        case 3:
          return `<h3 class="markdown-h3 text-xs font-bold text-cyan-300 mt-3 mb-1">${text}</h3>`;
        case 4:
          return `<h4 class="markdown-h4 text-xs font-semibold text-slate-200 mt-2 mb-1">${text}</h4>`;
        case 5:
          return `<h5 class="markdown-h5 text-xs font-semibold text-slate-300 mt-2 mb-1">${text}</h5>`;
        case 6:
        default:
          return `<h6 class="markdown-h6 text-[11px] font-semibold text-slate-400 mt-1 mb-1 uppercase tracking-wider">${text}</h6>`;
      }
    },

    table(this: any, token: Tokens.Table): string {
      let header = '';
      let cellHeader = '';
      for (let j = 0; j < token.header.length; j++) {
        cellHeader += this.tablecell(token.header[j]);
      }
      header += this.tablerow({ text: cellHeader });

      let body = '';
      for (let j = 0; j < token.rows.length; j++) {
        const row = token.rows[j];
        let cell = '';
        for (let k = 0; k < row.length; k++) {
          cell += this.tablecell(row[k]);
        }
        body += this.tablerow({ text: cell });
      }

      return `<div class="table-wrapper my-3 overflow-x-auto rounded-lg border border-slate-800">
  <table class="markdown-table min-w-full text-xs divide-y divide-slate-800">
    <thead class="bg-slate-900/80 text-slate-300">${header}</thead>
    <tbody class="divide-y divide-slate-800/60 bg-slate-950/60 text-slate-200">${body}</tbody>
  </table>
</div>`;
    },

    tablecell(this: any, token: Tokens.TableCell): string {
      const content = this.parser.parseInline(token.tokens);
      const alignClass = token.align === 'center' ? 'text-center' : token.align === 'right' ? 'text-right' : 'text-left';
      if (token.header) {
        return `<th class="px-3 py-2 font-semibold text-slate-200 ${alignClass}">${content}</th>`;
      }
      return `<td class="px-3 py-2 ${alignClass}">${content}</td>`;
    },

    blockquote(this: any, { tokens }: Tokens.Blockquote): string {
      const body = this.parser.parse(tokens);

      // Check for GitHub Alerts: > [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
      const alertMatch = body.match(/^\s*<p[^>]*>(?:<strong>)?\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<\/strong>)?(?:\s*<br\s*\/?>)?\s*([\s\S]*?)<\/p>([\s\S]*)$/i);
      if (alertMatch) {
        const rawType = alertMatch[1].toUpperCase() as AlertType;
        const config = ALERT_CONFIG[rawType] || ALERT_CONFIG.NOTE;
        const firstLine = alertMatch[2] ? alertMatch[2].trim() : '';
        const remainder = alertMatch[3] ? alertMatch[3].trim() : '';
        const alertBody = (firstLine ? `<p class="markdown-p leading-relaxed">${firstLine}</p>` : '') + remainder;

        return `<div class="markdown-alert markdown-alert-${rawType.toLowerCase()} my-3 rounded-lg border-l-4 ${config.borderClass} ${config.bgClass} p-3 text-xs leading-relaxed">
  <div class="alert-header flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] mb-1.5 ${config.textClass}">
    <i class="codicon codicon-${config.icon} text-xs"></i>
    <span>${config.title}</span>
  </div>
  <div class="alert-content space-y-1 text-slate-200">${alertBody}</div>
</div>`;
      }

      return `<blockquote class="markdown-blockquote border-l-3 border-cyan-500 bg-cyan-950/20 px-3 py-2 my-2.5 rounded-r-lg text-slate-300 italic text-xs leading-relaxed">${body}</blockquote>`;
    },

    hr(): string {
      return `<hr class="markdown-hr my-3.5 border-t border-slate-800" />`;
    },

    link(this: any, { href, title, tokens }: Tokens.Link): string {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}" class="markdown-link text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },

    paragraph(this: any, { tokens }: Tokens.Paragraph): string {
      const text = this.parser.parseInline(tokens);
      return `<p class="markdown-p leading-relaxed my-1.5">${text}</p>`;
    },

    codespan({ text }: Tokens.Codespan): string {
      return `<code class="markdown-inline-code px-1.5 py-0.5 rounded font-mono text-[11px] bg-slate-800/90 text-cyan-200 border border-slate-700/60">${escapeHtml(text)}</code>`;
    },

    list(this: any, token: Tokens.List): string {
      let body = '';
      for (let i = 0; i < token.items.length; i++) {
        body += this.listitem(token.items[i]);
      }
      if (token.ordered) {
        const startAttr = token.start && token.start !== 1 ? ` start="${token.start}"` : '';
        return `<ol class="markdown-ol list-decimal pl-5 my-2 space-y-1 text-slate-200 text-xs"${startAttr}>${body}</ol>`;
      }
      return `<ul class="markdown-ul list-disc pl-5 my-2 space-y-1 text-slate-200 text-xs">${body}</ul>`;
    },

    listitem(this: any, item: Tokens.ListItem): string {
      const rawText = this.parser.parse(item.tokens, false);
      if (item.task) {
        const cleanText = rawText.replace(/^\s*<input[^>]*>\s*/i, '');
        const checkedAttr = item.checked ? 'checked' : '';
        const textStyle = item.checked ? 'line-through text-slate-400 opacity-80' : 'text-slate-200';
        return `<li class="markdown-li markdown-task-item flex items-start gap-2 list-none -ml-4 my-1.5">
  <input type="checkbox" class="task-list-checkbox mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 cursor-default" ${checkedAttr} disabled />
  <span class="task-list-text leading-relaxed ${textStyle}">${cleanText}</span>
</li>`;
      }
      return `<li class="markdown-li leading-relaxed">${rawText}</li>`;
    },
  },
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'pre', 'code', 'button', 'i', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'hr', 'a', 'strong', 'em', 'del', 'b', 'br',
    'input', 'details', 'summary', 'section', 'article',
    'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'marker', 'defs', 'use', 'clippath', 'style',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'href', 'target', 'rel', 'title', 'type',
    'data-code', 'data-raw-mermaid', 'disabled', 'checked', 'start', 'align',
    'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', 'transform',
    'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'rx', 'ry', 'points',
    'marker-end', 'marker-start', 'marker-mid', 'open', 'style', 'aria-hidden',
  ],
  ALLOW_DATA_ATTR: true,
};

const sanitizeHtml = (html: string): string => {
  if (typeof window !== 'undefined' && (window as any).DOMPurify?.sanitize) {
    return (window as any).DOMPurify.sanitize(html, PURIFY_CONFIG);
  }
  if (typeof DOMPurify?.sanitize === 'function' && DOMPurify.isSupported) {
    return DOMPurify.sanitize(html, PURIFY_CONFIG);
  }
  // Fallback sanitizer for environments where DOM is not attached (e.g. Node/test)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
};

export const renderMarkdown = (markdown?: string, options?: { stripPlanMarker?: boolean }): string => {
  if (!markdown || !markdown.trim()) return '';
  let content = markdown;
  if (options?.stripPlanMarker) {
    content = cleanDiscoveryPlanContent(content);
  }
  if (!content.trim()) return '';

  const rawHtml = markedInstance.parse(content) as string;
  return sanitizeHtml(rawHtml);
};
