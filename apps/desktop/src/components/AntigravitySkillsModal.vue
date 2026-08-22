<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import MarkdownView from './MarkdownView.vue';

const props = defineProps<{
  workspacePath?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'run-skill', skillName: string): void;
}>();

type TabType = 'skills' | 'mcp' | 'rules';
const activeTab = ref<TabType>('skills');

const searchQuery = ref('');
const skills = ref<Array<{ id: string; name: string; description: string; path: string; source: string }>>([]);
const mcpServers = ref<Array<{ name: string; tools: string[]; isConfigured: boolean }>>([]);
const rules = ref<Array<{ name: string; description: string; path: string; source: string }>>([]);

const isLoading = ref(false);
const selectedSkill = ref<{ id: string; name: string; description: string; path: string; content?: string } | null>(null);
const isLoadingContent = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    const [skillsRes, mcpRes, rulesRes] = await Promise.all([
      (window as any).desktopApi?.agent?.listSkills?.(props.workspacePath),
      (window as any).desktopApi?.agent?.listMcpServers?.(),
      (window as any).desktopApi?.agent?.listRules?.(props.workspacePath),
    ]);
    if (Array.isArray(skillsRes)) skills.value = skillsRes;
    if (Array.isArray(mcpRes)) mcpServers.value = mcpRes;
    if (Array.isArray(rulesRes)) rules.value = rulesRes;
    if (skills.value.length > 0 && !selectedSkill.value) {
      void viewSkill(skills.value[0]);
    }
  } catch (err) {
    console.warn('Failed to load customizations:', err);
  } finally {
    isLoading.value = false;
  }
};

const viewSkill = async (sk: { id: string; name: string; description: string; path: string }) => {
  selectedSkill.value = { ...sk };
  isLoadingContent.value = true;
  try {
    const text = await (window as any).desktopApi?.agent?.readSkill?.(sk.path);
    if (selectedSkill.value && selectedSkill.value.id === sk.id) {
      selectedSkill.value.content = text || '';
    }
  } catch (err) {
    if (selectedSkill.value) selectedSkill.value.content = 'Không thể tải nội dung SKILL.md';
  } finally {
    isLoadingContent.value = false;
  }
};

const filteredSkills = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return skills.value;
  return skills.value.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
});

const filteredMcp = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return mcpServers.value;
  return mcpServers.value.filter(m => m.name.toLowerCase().includes(q) || m.tools.some(t => t.toLowerCase().includes(q)));
});

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none" @click.self="emit('close')">
    <div class="w-full max-w-4xl bg-[#1e1e1e] border border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[82vh]">
      <!-- Header -->
      <div class="h-12 px-4 bg-[#252526] border-b border-[#333333] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <i class="codicon codicon-extensions text-cyan-400 text-lg" />
          <h2 class="text-sm font-bold text-zinc-100 uppercase tracking-wide">Antigravity 2.0 · Skills & Customizations</h2>
        </div>

        <div class="flex items-center gap-3">
          <!-- Search input -->
          <div class="relative flex items-center">
            <i class="codicon codicon-search absolute left-2 text-zinc-500 text-xs" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search skills, MCP, rules..."
              class="w-52 pl-7 pr-3 py-1 text-xs bg-[#1e1e1e] border border-[#3e3e42] rounded-md text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#007acc]"
            />
          </div>

          <button
            class="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-colors text-xs cursor-pointer"
            @click="emit('close')"
          >
            ✕ Đóng
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="h-10 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center px-4 gap-2 shrink-0">
        <button
          class="h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'skills' ? 'border-[#007acc] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'"
          @click="activeTab = 'skills'"
        >
          <i class="codicon codicon-sparkle text-amber-400" />
          <span>Skills Catalog ({{ skills.length }})</span>
        </button>

        <button
          class="h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'mcp' ? 'border-[#007acc] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'"
          @click="activeTab = 'mcp'"
        >
          <i class="codicon codicon-server-process text-emerald-400" />
          <span>Model Context Protocol ({{ mcpServers.length }})</span>
        </button>

        <button
          class="h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'rules' ? 'border-[#007acc] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'"
          @click="activeTab = 'rules'"
        >
          <i class="codicon codicon-checklist text-cyan-400" />
          <span>Rules & Workflows ({{ rules.length }})</span>
        </button>
      </div>

      <!-- Body Content -->
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <!-- 1. SKILLS TAB -->
        <template v-if="activeTab === 'skills'">
          <!-- Left list -->
          <div class="w-2/5 border-r border-[#2d2d2d] overflow-y-auto p-2 space-y-1 bg-[#181818]">
            <div
              v-for="sk in filteredSkills"
              :key="sk.id"
              class="p-2.5 rounded-lg border text-left cursor-pointer transition-colors group"
              :class="selectedSkill?.id === sk.id ? 'border-[#007acc] bg-[#094771]/30 text-white' : 'border-[#2d2d2d] bg-[#1e1e1e] text-zinc-300 hover:border-[#3e3e42]'"
              @click="viewSkill(sk)"
            >
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <i class="codicon codicon-file-code text-cyan-400 text-xs" />
                  <h4 class="font-semibold text-xs truncate">{{ sk.name }}</h4>
                </div>
                <span
                  class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0"
                  :class="sk.source === 'builtin' ? 'bg-cyan-950 text-cyan-300' : sk.source === 'workspace' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'"
                >
                  {{ sk.source }}
                </span>
              </div>
              <p class="text-[11px] text-zinc-400 line-clamp-2">{{ sk.description }}</p>
            </div>
          </div>

          <!-- Right detail pane -->
          <div class="flex-1 flex flex-col min-h-0 bg-[#1e1e1e] p-4 overflow-y-auto">
            <div v-if="selectedSkill" class="space-y-4">
              <div class="flex items-center justify-between border-b border-[#333333] pb-3">
                <div>
                  <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i class="codicon codicon-sparkle text-amber-400" />
                    <span>{{ selectedSkill.name }}</span>
                  </h3>
                  <p class="text-xs text-zinc-400 mt-0.5">{{ selectedSkill.description }}</p>
                </div>
                <button
                  class="px-3 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                  @click="emit('run-skill', selectedSkill.id); emit('close');"
                >
                  <i class="codicon codicon-play" />
                  <span>Kích hoạt Skill</span>
                </button>
              </div>

              <div>
                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">File Path</label>
                <code class="text-[11px] font-mono text-zinc-300 bg-[#252526] p-1.5 rounded block truncate">{{ selectedSkill.path }}</code>
              </div>

              <div>
                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">SKILL.md Instructions</label>
                <div v-if="isLoadingContent" class="text-xs text-zinc-400 p-4">Đang tải nội dung...</div>
                <div v-else class="max-h-96 overflow-y-auto rounded-lg border border-[#2d2d2d] bg-[#141414] p-3 text-xs text-zinc-200">
                  <MarkdownView :content="selectedSkill.content" />
                </div>
              </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <i class="codicon codicon-sparkle text-3xl text-zinc-600" />
              <p class="text-xs">Chọn một kỹ năng từ danh mục bên trái để xem hướng dẫn chi tiết.</p>
            </div>
          </div>
        </template>

        <!-- 2. MCP TAB -->
        <template v-else-if="activeTab === 'mcp'">
          <div class="flex-1 p-4 overflow-y-auto space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="srv in filteredMcp"
                :key="srv.name"
                class="p-3 rounded-xl bg-[#252526] border border-[#3e3e42] flex flex-col gap-2"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i class="codicon codicon-server-process text-emerald-400" />
                    <h3 class="font-bold text-xs text-zinc-100">{{ srv.name }}</h3>
                  </div>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-300 font-mono font-semibold">
                    {{ srv.tools.length }} tools
                  </span>
                </div>

                <p class="text-[11px] text-zinc-400">Model Context Protocol Server cung cấp các công cụ mở rộng cho Agent.</p>

                <div class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tool in srv.tools"
                    :key="tool"
                    class="px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#333333] text-[10px] font-mono text-zinc-300"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 3. RULES TAB -->
        <template v-else-if="activeTab === 'rules'">
          <div class="flex-1 p-4 overflow-y-auto space-y-3">
            <div v-if="rules.length === 0" class="text-xs text-zinc-500 p-8 text-center bg-[#252526] rounded-xl border border-[#333333]">
              Chưa cấu hình rules riêng trong thư mục `.gemini/rules`.
            </div>
            <div
              v-for="rl in rules"
              :key="rl.name"
              class="p-3 rounded-xl bg-[#252526] border border-[#3e3e42] flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <i class="codicon codicon-checklist text-cyan-400" />
                <div>
                  <h4 class="font-bold text-xs text-zinc-100">{{ rl.name }}</h4>
                  <p class="text-[11px] text-zinc-400 font-mono">{{ rl.path }}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold uppercase font-mono">
                {{ rl.source }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
