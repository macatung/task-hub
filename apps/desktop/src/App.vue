<script setup lang="ts">
import { ref } from 'vue';
import ControlCenter from './views/ControlCenter.vue';
import SimpleTaskHubView from './views/SimpleTaskHubView.vue';
import WelcomePairingView from './views/WelcomePairingView.vue';
import ActionFeedbackToast from './components/ActionFeedbackToast.vue';
import { useTaskSync, type DesktopCredential } from './composables/useTaskSync';

const sync = useTaskSync();

// App Mode: 'simple' (default for non-tech) or 'developer'
const storedMode = (typeof localStorage !== 'undefined' && localStorage.getItem('task_hub_desktop_mode')) as 'simple' | 'developer' | null;
const appMode = ref<'simple' | 'developer'>(storedMode === 'developer' ? 'developer' : 'simple');

// Offline / skipped pairing state
const hasSkippedPairing = ref(typeof localStorage !== 'undefined' && localStorage.getItem('task_hub_desktop_offline_ok') === 'true');

const setMode = (mode: 'simple' | 'developer') => {
  appMode.value = mode;
  try {
    localStorage.setItem('task_hub_desktop_mode', mode);
  } catch {}
};

const onConnected = async (credential: DesktopCredential) => {
  await sync.setCredential(credential);
};

const onSkipOffline = () => {
  hasSkippedPairing.value = true;
  try {
    localStorage.setItem('task_hub_desktop_offline_ok', 'true');
  } catch {}
};
</script>

<template>
  <!-- 1. Onboarding Pairing if not connected and not skipped -->
  <WelcomePairingView
    v-if="!sync.credential.value && !hasSkippedPairing"
    @connected="onConnected"
    @skip-offline="onSkipOffline"
  />

  <!-- 2. Simple Mode (Office & To-Do) -->
  <SimpleTaskHubView
    v-else-if="appMode === 'simple'"
    @switch-mode="setMode"
  />

  <!-- 3. Developer Mode (Agent Orchestration & Control Center) -->
  <div v-else class="relative h-screen w-screen overflow-hidden">
    <!-- Quick Switch Back to Simple Mode Floating Pill -->
    <div class="fixed top-2 right-28 z-50">
      <button
        @click="setMode('simple')"
        class="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950/80 border border-slate-700/80 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 text-xs font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all"
        title="Chuyển về Giao diện To-Do Văn phòng"
      >
        <span>📋</span>
        <span>Giao diện Văn phòng</span>
      </button>
    </div>
    <ControlCenter />
  </div>

  <ActionFeedbackToast />
</template>
