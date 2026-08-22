<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { renderMarkdown } from '../utils/markdown';

const props = withDefaults(
  defineProps<{
    content?: string;
    stripPlanMarker?: boolean;
    isUser?: boolean;
    dense?: boolean;
  }>(),
  {
    content: '',
    stripPlanMarker: false,
    isUser: false,
    dense: false,
  }
);

const containerRef = ref<HTMLElement | null>(null);

const renderedHtml = computed(() => {
  return renderMarkdown(props.content, {
    stripPlanMarker: props.stripPlanMarker,
  });
});

let mermaidInstance: any = null;
let mermaidCounter = 0;

const getMermaid = async () => {
  if (mermaidInstance) return mermaidInstance;
  try {
    const mod = await import('mermaid');
    const m = mod.default || mod;
    m.initialize({
      startOnLoad: false,
      theme: 'dark',
      darkMode: true,
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      themeVariables: {
        darkMode: true,
        background: '#0b0f17',
        mainBkg: '#1e293b',
        primaryColor: '#0284c7',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#38bdf8',
        lineColor: '#94a3b8',
        secondaryColor: '#334155',
        tertiaryColor: '#0f172a',
      },
    });
    mermaidInstance = m;
    return mermaidInstance;
  } catch (err) {
    console.warn('Mermaid failed to load:', err);
    return null;
  }
};

const renderMermaidDiagrams = async () => {
  if (!containerRef.value) return;
  const diagramContainers = containerRef.value.querySelectorAll<HTMLElement>(
    '.mermaid-diagram-container:not([data-rendered="true"])'
  );

  if (diagramContainers.length === 0) return;

  const mermaid = await getMermaid();
  if (!mermaid) {
    diagramContainers.forEach((el) => {
      el.innerHTML = '<div class="text-xs text-amber-400 py-1 flex items-center gap-1.5"><i class="codicon codicon-warning"></i><span>Không thể tải thư viện dựng sơ đồ Mermaid.</span></div>';
    });
    return;
  }

  for (const container of Array.from(diagramContainers)) {
    const encoded = container.getAttribute('data-code');
    if (!encoded) continue;

    const rawCode = decodeURIComponent(encoded);
    const id = `mermaid-svg-${Date.now()}-${++mermaidCounter}`;

    try {
      const { svg } = await mermaid.render(id, rawCode);
      container.innerHTML = svg;
      container.setAttribute('data-rendered', 'true');
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
      }
    } catch (renderError: any) {
      console.warn('Mermaid render error:', renderError);
      container.innerHTML = `<div class="p-3 text-xs bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 space-y-1 text-left w-full">
        <div class="flex items-center gap-1.5 font-semibold text-rose-400">
          <i class="codicon codicon-error text-xs"></i>
          <span>Lỗi cú pháp sơ đồ Mermaid</span>
        </div>
        <div class="text-[11px] font-mono text-rose-200/90 whitespace-pre-wrap">${renderError?.message || 'Không thể dựng sơ đồ từ mã nguồn.'}</div>
      </div>`;
      container.setAttribute('data-rendered', 'error');
    }
  }
};

watch(
  () => renderedHtml.value,
  () => {
    nextTick(() => {
      renderMermaidDiagrams();
    });
  }
);

onMounted(() => {
  nextTick(() => {
    renderMermaidDiagrams();
  });
});

const handleClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  // 1. Handle Copy Code Block Button Click
  const copyBtn = target.closest('.copy-code-btn') as HTMLButtonElement | null;
  if (copyBtn) {
    event.preventDefault();
    event.stopPropagation();
    const encoded = copyBtn.getAttribute('data-code');
    if (encoded) {
      const codeText = decodeURIComponent(encoded);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(codeText);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = codeText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        const label = copyBtn.querySelector('.copy-label');
        const icon = copyBtn.querySelector('.codicon');
        const origText = label?.textContent || 'Copy';

        if (label) label.textContent = 'Đã chép!';
        if (icon) {
          icon.className = 'codicon codicon-check text-emerald-400 text-[11px]';
        }
        copyBtn.classList.add('bg-emerald-950/80', 'text-emerald-300', 'border-emerald-700');

        setTimeout(() => {
          if (label) label.textContent = origText;
          if (icon) {
            icon.className = 'codicon codicon-copy text-[11px]';
          }
          copyBtn.classList.remove('bg-emerald-950/80', 'text-emerald-300', 'border-emerald-700');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code to clipboard:', err);
      }
    }
    return;
  }

  // 2. Handle Mermaid Toggle Source Code
  const toggleSourceBtn = target.closest('.view-mermaid-source-btn') as HTMLButtonElement | null;
  if (toggleSourceBtn) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = toggleSourceBtn.closest('.mermaid-block-wrapper');
    const sourceEl = wrapper?.querySelector('.mermaid-source-code');
    if (sourceEl) {
      const isHidden = sourceEl.classList.contains('hidden');
      if (isHidden) {
        sourceEl.classList.remove('hidden');
        toggleSourceBtn.classList.add('bg-cyan-950/80', 'text-cyan-300', 'border-cyan-700');
      } else {
        sourceEl.classList.add('hidden');
        toggleSourceBtn.classList.remove('bg-cyan-950/80', 'text-cyan-300', 'border-cyan-700');
      }
    }
    return;
  }

  // 3. Handle External Links
  const link = target.closest('a') as HTMLAnchorElement | null;
  if (link && link.href) {
    const href = link.getAttribute('href') || link.href;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      event.preventDefault();
      event.stopPropagation();
      const desktopApi = (window as any).desktopApi;
      if (desktopApi?.openExternal) {
        desktopApi.openExternal(href);
      } else {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  }
};
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-body"
    :class="[
      isUser ? 'markdown-user' : 'markdown-agent',
      dense ? 'markdown-dense' : '',
    ]"
    @click="handleClick"
    v-html="renderedHtml"
  />
</template>

<style scoped>
.markdown-body {
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.625;
}

:deep(.markdown-h1) {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc !important;
  margin-top: 1.1rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
}

:deep(.markdown-h2) {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9 !important;
  margin-top: 0.95rem;
  margin-bottom: 0.4rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
}

:deep(.markdown-h3) {
  font-size: 0.85rem;
  font-weight: 700;
  color: #67e8f9 !important;
  margin-top: 0.8rem;
  margin-bottom: 0.3rem;
}

:deep(.markdown-h4),
:deep(.markdown-h5),
:deep(.markdown-h6) {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1 !important;
  margin-top: 0.6rem;
  margin-bottom: 0.25rem;
}

:deep(.markdown-p) {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
  color: inherit;
}

:deep(.markdown-inline-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.82em;
  background-color: rgba(30, 41, 59, 0.85);
  color: #a5f3fc !important;
  border: 1px solid rgba(71, 85, 105, 0.6);
  padding: 0.15em 0.4em;
  border-radius: 0.375rem;
}

:deep(.code-block-wrapper),
:deep(.mermaid-block-wrapper) {
  background-color: #0b0f17;
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 0.75rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:deep(.code-block-wrapper pre),
:deep(.mermaid-source-code) {
  margin: 0;
  padding: 0.85rem 1rem;
  background-color: transparent;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.5;
  overflow-x: auto;
}

:deep(.copy-code-btn),
:deep(.view-mermaid-source-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(71, 85, 105, 0.8);
  background-color: #1e293b;
  color: #cbd5e1;
  border-radius: 0.375rem;
  padding: 0.2rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

:deep(.copy-code-btn:hover),
:deep(.view-mermaid-source-btn:hover) {
  background-color: #334155;
  color: #ffffff;
  border-color: #64748b;
}

:deep(.markdown-ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-top: 0.4rem;
  margin-bottom: 0.4rem;
}

:deep(.markdown-ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-top: 0.4rem;
  margin-bottom: 0.4rem;
}

:deep(.markdown-li) {
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
  padding-left: 0.15rem;
}

:deep(.markdown-task-item) {
  padding-left: 0;
}

:deep(.task-list-checkbox) {
  accent-color: #06b6d4;
  width: 0.85rem;
  height: 0.85rem;
}

/* GitHub Alert styling */
:deep(.markdown-alert) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:deep(.markdown-blockquote) {
  border-left: 3px solid #06b6d4;
  background-color: rgba(8, 51, 68, 0.25);
  padding: 0.5rem 0.75rem;
  margin-top: 0.6rem;
  margin-bottom: 0.6rem;
  border-radius: 0 0.5rem 0.5rem 0;
  color: #cbd5e1 !important;
  font-style: italic;
}

:deep(.markdown-hr) {
  border: none;
  border-top: 1px solid rgba(51, 65, 85, 0.7);
  margin-top: 0.9rem;
  margin-bottom: 0.9rem;
}

:deep(.markdown-link) {
  color: #38bdf8 !important;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 500;
}

:deep(.markdown-link:hover) {
  color: #7dd3fc !important;
}

:deep(.table-wrapper) {
  overflow-x: auto;
  border: 1px solid rgba(51, 65, 85, 0.7);
  border-radius: 0.5rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

:deep(.markdown-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

:deep(.markdown-table th) {
  background-color: rgba(15, 23, 42, 0.9);
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  color: #f1f5f9;
  border-bottom: 1px solid rgba(51, 65, 85, 0.8);
}

:deep(.markdown-table td) {
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
  color: #e2e8f0;
}

:deep(.markdown-table tr:nth-child(even) td) {
  background-color: rgba(15, 23, 42, 0.35);
}

:deep(strong) {
  font-weight: 700;
  color: #ffffff !important;
}

:deep(em) {
  font-style: italic;
  color: #e2e8f0;
}

/* User Bubble variations */
.markdown-user :deep(.markdown-p) {
  color: #ffffff;
}

.markdown-user :deep(.markdown-inline-code) {
  background-color: rgba(30, 58, 138, 0.6);
  color: #bfdbfe !important;
  border-color: rgba(96, 165, 250, 0.5);
}
</style>
