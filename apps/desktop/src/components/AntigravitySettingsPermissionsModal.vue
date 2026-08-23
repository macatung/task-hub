<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

interface AgentPermissions {
  toolExecutionPolicy: 'always-proceed' | 'request-review' | 'strict' | 'proceed-in-sandbox';
  sandboxMode: boolean;
  fileAccessPolicy: 'allow' | 'ask' | 'deny';
  internetAccessPolicy: 'allow' | 'ask' | 'deny';
  artifactReviewMode: 'always-proceed' | 'agent-decides' | 'asks-for-review';
  notificationsEnabled: boolean;
  theme: 'dark' | 'midnight' | 'cyber' | 'light';
  browserAllowlist: string[];
  commandAllowlist: string[];
  commandDenylist: string[];
}

const permissions = ref<AgentPermissions>({
  toolExecutionPolicy: 'request-review',
  sandboxMode: false,
  fileAccessPolicy: 'allow',
  internetAccessPolicy: 'allow',
  artifactReviewMode: 'agent-decides',
  notificationsEnabled: true,
  theme: 'dark',
  browserAllowlist: [],
  commandAllowlist: [],
  commandDenylist: [],
});

const isSaving = ref(false);
const saveSuccess = ref(false);

const loadPermissions = async () => {
  try {
    const res = await (window as any).desktopApi?.agent?.getPermissions?.();
    if (res) permissions.value = { ...permissions.value, ...res };
  } catch (err) {
    console.warn('Failed to load permissions:', err);
  }
};

const handleSave = async () => {
  isSaving.value = true;
  saveSuccess.value = false;
  try {
    await (window as any).desktopApi?.agent?.savePermissions?.(permissions.value);
    saveSuccess.value = true;
    setTimeout(() => { saveSuccess.value = false; }, 2000);
  } catch (err) {
    console.warn('Failed to save permissions:', err);
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  void loadPermissions();
});
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none" @click.self="emit('close')">
    <div class="w-full max-w-2xl bg-[#1e1e1e] border border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="h-12 px-4 bg-[#252526] border-b border-[#333333] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <i class="codicon codicon-settings-gear text-cyan-400 text-lg" />
          <h2 class="text-sm font-bold text-zinc-100 uppercase tracking-wide">Antigravity 2.0 · Settings & Permissions</h2>
        </div>

        <button
          class="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-colors text-xs cursor-pointer"
          @click="emit('close')"
        >
          ✕ Close
        </button>
      </div>

      <!-- Settings Form Body -->
      <div class="flex-1 p-5 overflow-y-auto space-y-5 bg-[#1e1e1e]">
        <!-- 1. Tool Execution Policy -->
        <div class="p-3.5 bg-[#252526] rounded-xl border border-[#3e3e42] space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-zinc-200">Tool Execution Policy</label>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#333333] text-cyan-300">{{ permissions.toolExecutionPolicy }}</span>
          </div>
          <p class="text-[11px] text-zinc-400">Control whether terminal commands require user approval before execution.</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              v-for="p in [
                { id: 'always-proceed', label: 'Always Proceed', desc: 'Auto-run tools' },
                { id: 'request-review', label: 'Request Review', desc: 'Ask on risky actions' },
                { id: 'strict', label: 'Strict', desc: 'Approval required' },
                { id: 'proceed-in-sandbox', label: 'Sandbox Only', desc: 'Isolated sandbox' }
              ] as const"
              :key="p.id"
              class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
              :class="permissions.toolExecutionPolicy === p.id ? 'border-[#007acc] bg-[#094771]/40 text-white font-semibold' : 'border-[#3e3e42] bg-[#1e1e1e] text-zinc-400 hover:text-zinc-200'"
              @click="permissions.toolExecutionPolicy = p.id"
            >
              <p class="text-xs">{{ p.label }}</p>
              <p class="text-[9px] text-zinc-500 font-mono">{{ p.desc }}</p>
            </button>
          </div>
        </div>

        <!-- 2. Sandbox & File Access -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Non-Workspace File Access -->
          <div class="p-3.5 bg-[#252526] rounded-xl border border-[#3e3e42] space-y-2">
            <label class="text-xs font-bold text-zinc-200 block">Non-Workspace File Access</label>
            <p class="text-[11px] text-zinc-400">Allow reading/writing files outside current workspace root.</p>
            <div class="flex rounded-lg border border-[#3e3e42] p-1 bg-[#1e1e1e] gap-1">
              <button
                v-for="mode in ['allow', 'ask', 'deny'] as const"
                :key="mode"
                class="flex-1 py-1 text-xs rounded capitalize font-semibold cursor-pointer transition-colors"
                :class="permissions.fileAccessPolicy === mode ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:text-white'"
                @click="permissions.fileAccessPolicy = mode"
              >
                {{ mode }}
              </button>
            </div>
          </div>

          <!-- Internet Access Policy -->
          <div class="p-3.5 bg-[#252526] rounded-xl border border-[#3e3e42] space-y-2">
            <label class="text-xs font-bold text-zinc-200 block">Internet Access Policy</label>
            <p class="text-[11px] text-zinc-400">Control network access permissions (HTTP requests / web browser tools).</p>
            <div class="flex rounded-lg border border-[#3e3e42] p-1 bg-[#1e1e1e] gap-1">
              <button
                v-for="mode in ['allow', 'ask', 'deny'] as const"
                :key="mode"
                class="flex-1 py-1 text-xs rounded capitalize font-semibold cursor-pointer transition-colors"
                :class="permissions.internetAccessPolicy === mode ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:text-white'"
                @click="permissions.internetAccessPolicy = mode"
              >
                {{ mode }}
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Artifact Review Mode -->
        <div class="p-3.5 bg-[#252526] rounded-xl border border-[#3e3e42] space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-zinc-200">Artifact Review Mode</label>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#333333] text-cyan-300">{{ permissions.artifactReviewMode }}</span>
          </div>
          <p class="text-[11px] text-zinc-400">Configure how Agent presents and requests feedback for generated artifacts.</p>
          <div class="grid grid-cols-3 gap-2 pt-1">
            <button
              v-for="m in [
                { id: 'agent-decides', label: 'Agent Decides', desc: 'Context-dependent' },
                { id: 'asks-for-review', label: 'Ask for Review', desc: 'Always request review' },
                { id: 'always-proceed', label: 'Always Proceed', desc: 'Auto-approve' }
              ] as const"
              :key="m.id"
              class="p-2 rounded-lg border text-left cursor-pointer transition-colors"
              :class="permissions.artifactReviewMode === m.id ? 'border-[#007acc] bg-[#094771]/40 text-white font-semibold' : 'border-[#3e3e42] bg-[#1e1e1e] text-zinc-400 hover:text-zinc-200'"
              @click="permissions.artifactReviewMode = m.id"
            >
              <p class="text-xs">{{ m.label }}</p>
              <p class="text-[9px] text-zinc-500 font-mono">{{ m.desc }}</p>
            </button>
          </div>
        </div>

        <!-- 4. Notifications & Theme -->
        <div class="flex items-center justify-between p-3.5 bg-[#252526] rounded-xl border border-[#3e3e42]">
          <div>
            <h4 class="text-xs font-bold text-zinc-200">Task Completion Notifications</h4>
            <p class="text-[11px] text-zinc-400">Send desktop notifications when Agent finishes execution or encounters errors.</p>
          </div>
          <input
            v-model="permissions.notificationsEnabled"
            type="checkbox"
            class="w-4 h-4 accent-[#007acc] cursor-pointer"
          />
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="h-14 px-4 bg-[#252526] border-t border-[#333333] flex items-center justify-between shrink-0">
        <span v-if="saveSuccess" class="text-xs text-emerald-400 font-semibold flex items-center gap-1">
          <i class="codicon codicon-check" /> Configuration saved successfully!
        </span>
        <span v-else class="text-xs text-zinc-500">Changes apply immediately across all sessions.</span>

        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg bg-[#333333] hover:bg-[#3e3e42] text-zinc-300 text-xs font-semibold cursor-pointer"
            @click="emit('close')"
          >
            Close
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            :disabled="isSaving"
            @click="handleSave"
          >
            <i v-if="isSaving" class="codicon codicon-loading animate-spin" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
