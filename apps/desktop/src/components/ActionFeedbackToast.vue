<script setup lang="ts">
import { useActionFeedback, type ActionFeedbackItem } from '../composables/useActionFeedback';

const { activeFeedbacks, dismiss } = useActionFeedback();

const getTypeBadge = (type: ActionFeedbackItem['type']) => {
  switch (type) {
    case 'loading':
      return {
        icon: '⟳',
        spin: true,
        border: 'border-blue-500/60',
        bg: 'bg-slate-900/95',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        accent: 'text-blue-400',
      };
    case 'success':
      return {
        icon: '✓',
        spin: false,
        border: 'border-emerald-500/60',
        bg: 'bg-slate-900/95',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        accent: 'text-emerald-400',
      };
    case 'warning':
      return {
        icon: '!',
        spin: false,
        border: 'border-amber-500/60',
        bg: 'bg-slate-900/95',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        accent: 'text-amber-400',
      };
    case 'error':
      return {
        icon: '✕',
        spin: false,
        border: 'border-rose-500/60',
        bg: 'bg-slate-900/95',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        accent: 'text-rose-400',
      };
    default:
      return {
        icon: 'ℹ',
        spin: false,
        border: 'border-slate-700',
        bg: 'bg-slate-900/95',
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        accent: 'text-slate-300',
      };
  }
};
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-[999] flex flex-col gap-2.5 max-w-md w-full px-2"
    aria-live="polite"
  >
    <transition-group
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-3 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform translate-y-2 opacity-0 scale-95"
    >
      <div
        v-for="item in activeFeedbacks"
        :key="item.id"
        class="pointer-events-auto rounded-xl border p-3 shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all text-xs"
        :class="[getTypeBadge(item.type).bg, getTypeBadge(item.type).border]"
        role="status"
      >
        <!-- Icon Badge -->
        <div
          class="w-6 h-6 rounded-lg grid place-items-center font-bold text-xs shrink-0 border"
          :class="[getTypeBadge(item.type).badge]"
        >
          <span :class="getTypeBadge(item.type).spin ? 'animate-spin inline-block' : ''">
            {{ getTypeBadge(item.type).icon }}
          </span>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h5 class="font-bold text-[12px] text-zinc-100 truncate">
              {{ item.title }}
            </h5>
            <span class="text-[10px] font-mono text-zinc-400 shrink-0">
              {{ item.timestamp }}
            </span>
          </div>

          <p v-if="item.message" class="text-[11px] text-zinc-300 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
            {{ item.message }}
          </p>

          <!-- Optional Progress Bar -->
          <div
            v-if="typeof item.progress === 'number'"
            class="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"
          >
            <div
              class="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
              :style="{ width: `${Math.min(100, Math.max(0, item.progress))}%` }"
            ></div>
          </div>
        </div>

        <!-- Dismiss button -->
        <button
          @click="dismiss(item.id)"
          class="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
          title="Đóng thông báo"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  contain: layout style;
}
</style>
