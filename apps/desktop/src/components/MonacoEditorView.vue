<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as monaco from 'monaco-editor';

const props = withDefaults(
  defineProps<{
    mode?: 'editor' | 'diff';
    content?: string;
    originalContent?: string;
    modifiedContent?: string;
    language?: string;
    filename?: string;
    readOnly?: boolean;
    renderSideBySide?: boolean;
  }>(),
  {
    mode: 'diff',
    content: '',
    originalContent: '',
    modifiedContent: '',
    language: 'typescript',
    filename: '',
    readOnly: true,
    renderSideBySide: true,
  }
);

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const isSideBySide = ref(props.renderSideBySide);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
let diffEditorInstance: monaco.editor.IStandaloneDiffEditor | null = null;
let originalModel: monaco.editor.ITextModel | null = null;
let modifiedModel: monaco.editor.ITextModel | null = null;
let resizeObserver: ResizeObserver | null = null;

const detectLanguage = (nameOrLang?: string): string => {
  if (!nameOrLang) return 'plaintext';
  const ext = nameOrLang.split('.').pop()?.toLowerCase() || nameOrLang.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'typescript':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'javascript':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'vue':
      return 'html';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'php':
      return 'php';
    case 'py':
    case 'python':
      return 'python';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    default:
      return 'plaintext';
  }
};

const initMonaco = () => {
  if (!containerRef.value) return;
  disposeEditor();

  const lang = detectLanguage(props.filename || props.language);

  if (props.mode === 'diff') {
    diffEditorInstance = monaco.editor.createDiffEditor(containerRef.value, {
      theme: 'vs-dark',
      readOnly: props.readOnly,
      renderSideBySide: isSideBySide.value,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      fontSize: 12,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontLigatures: true,
      minimap: { enabled: true },
      lineNumbers: 'on',
      renderIndicators: true,
      originalEditable: false,
      diffWordWrap: 'off',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
    });

    originalModel = monaco.editor.createModel(props.originalContent || '', lang);
    modifiedModel = monaco.editor.createModel(props.modifiedContent || '', lang);

    diffEditorInstance.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
  } else {
    editorInstance = monaco.editor.create(containerRef.value, {
      value: props.content || props.modifiedContent || '',
      language: lang,
      theme: 'vs-dark',
      readOnly: props.readOnly,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      fontSize: 12,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontLigatures: true,
      minimap: { enabled: true },
      lineNumbers: 'on',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      tabSize: 2,
    });

    editorInstance.onDidChangeModelContent(() => {
      if (editorInstance) {
        emit('change', editorInstance.getValue());
      }
    });
  }

  // Observe container resize for responsive redraw
  resizeObserver = new ResizeObserver(() => {
    diffEditorInstance?.layout();
    editorInstance?.layout();
  });
  resizeObserver.observe(containerRef.value);
};

const disposeEditor = () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (originalModel) {
    originalModel.dispose();
    originalModel = null;
  }
  if (modifiedModel) {
    modifiedModel.dispose();
    modifiedModel = null;
  }
  if (diffEditorInstance) {
    diffEditorInstance.dispose();
    diffEditorInstance = null;
  }
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
};

const toggleSideBySide = () => {
  isSideBySide.value = !isSideBySide.value;
  if (diffEditorInstance) {
    diffEditorInstance.updateOptions({
      renderSideBySide: isSideBySide.value,
    });
  }
};

watch(
  () => [props.originalContent, props.modifiedContent, props.content, props.language, props.filename, props.mode],
  () => {
    nextTick(() => {
      initMonaco();
    });
  }
);

onMounted(() => {
  nextTick(() => {
    initMonaco();
  });
});

onBeforeUnmount(() => {
  disposeEditor();
});
</script>

<template>
  <div class="monaco-wrapper flex flex-col w-full h-full bg-[#1e1e1e] text-zinc-300 font-sans select-none overflow-hidden">
    <!-- Header ToolBar -->
    <div class="h-8 px-3 bg-[#252526] border-b border-[#333333] flex items-center justify-between text-xs shrink-0 select-none">
      <div class="flex items-center gap-2">
        <span class="text-sky-400 font-mono text-[11px] font-semibold flex items-center gap-1.5">
          <i class="codicon" :class="mode === 'diff' ? 'codicon-diff text-cyan-400' : 'codicon-file-code text-blue-400'" />
          <span>{{ filename || 'Untitled' }}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#333333] text-zinc-400 font-mono flex items-center gap-1">
          <i class="codicon codicon-symbol-misc text-[11px]" />
          <span>{{ detectLanguage(filename || language) }}</span>
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="mode === 'diff'"
          class="px-2 py-0.5 rounded bg-[#333333] hover:bg-[#3e3e42] text-[10px] text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 border border-[#3e3e42]"
          :title="isSideBySide ? 'Chuyển sang chế độ xem Diff Inline' : 'Chuyển sang chế độ xem Diff Side-by-Side'"
          @click="toggleSideBySide"
        >
          <i class="codicon" :class="isSideBySide ? 'codicon-split-vertical' : 'codicon-split-horizontal'" />
          <span>{{ isSideBySide ? 'Inline Diff' : 'Side-by-Side' }}</span>
        </button>
        <span v-if="readOnly" class="text-[10px] text-zinc-400 font-mono uppercase flex items-center gap-1 bg-[#2b2b2b] px-1.5 py-0.2 rounded">
          <i class="codicon codicon-lock text-[11px]" />
          <span>Read-Only</span>
        </span>
      </div>
    </div>

    <!-- Monaco Mount Point -->
    <div ref="containerRef" class="monaco-container flex-1 w-full min-h-0 bg-[#1e1e1e]" />
  </div>
</template>

<style scoped>
.monaco-wrapper {
  position: relative;
}
.monaco-container {
  width: 100%;
  height: 100%;
}
</style>
