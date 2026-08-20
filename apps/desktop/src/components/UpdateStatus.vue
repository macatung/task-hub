<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

type UpdateState = { status: string; version?: string; percent?: number; message?: string };
const state = ref<UpdateState>({ status: 'idle' });
let removeListener: (() => void) | undefined;

const check = async () => {
  state.value = await window.desktopApi?.updater?.check?.() || state.value;
};
const install = () => window.desktopApi?.updater?.install?.();
const dismiss = () => window.desktopApi?.updater?.dismiss?.();

onMounted(async () => {
  state.value = await window.desktopApi?.updater?.getState?.() || state.value;
  removeListener = window.desktopApi?.updater?.onState?.((next: UpdateState) => { state.value = next; });
});
onUnmounted(() => removeListener?.());
</script>

<template>
  <div v-if="state.status === 'checking' || state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded' || state.status === 'not-available' || state.status === 'error'" class="update-panel no-drag">
    <div class="flex items-center gap-2">
      <span v-if="state.status === 'downloading' || state.status === 'available'">⬇️</span>
      <span v-else-if="state.status === 'downloaded'">✅</span>
      <span v-else-if="state.status === 'not-available'">ℹ️</span>
      <span v-else-if="state.status === 'error'">⚠️</span>
      <span v-else>🔄</span>
      <span class="flex-1">{{ state.message }}</span>
      <button v-if="state.status === 'downloaded'" class="update-button primary" @click="install">Khởi động lại và cập nhật</button>
      <button v-else-if="state.status === 'error'" class="update-button" @click="check">Thử lại</button>
      <button v-if="state.status === 'downloaded' || state.status === 'error' || state.status === 'not-available'" class="update-button" @click="dismiss">Đóng</button>
    </div>
    <div v-if="state.status === 'downloading'" class="mt-1 h-1 rounded bg-slate-800 overflow-hidden">
      <div class="h-full bg-emerald-400 transition-all" :style="{ width: `${state.percent || 0}%` }" />
    </div>
  </div>
</template>

<style scoped>
.update-panel { width: min(34rem, calc(100vw - 2rem)); margin-bottom: .5rem; padding: .6rem .75rem; border: 1px solid rgb(51 65 85); border-radius: .8rem; background: rgb(2 6 23 / .96); color: rgb(226 232 240); font: 11px/1.35 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 15px 35px rgb(0 0 0 / .35); }
.update-button { border: 1px solid rgb(71 85 105); border-radius: .5rem; padding: .3rem .5rem; color: rgb(203 213 225); white-space: nowrap; cursor: pointer; }
.update-button:hover { background: rgb(30 41 59); }
.update-button.primary { border-color: rgb(16 185 129); background: rgb(16 185 129); color: rgb(2 6 23); font-weight: 700; }
.no-drag { -webkit-app-region: no-drag; }
</style>
