<script setup lang="ts">
import DangerousCommandBanner from '../DangerousCommandBanner.vue';
import type { SafetyInterceptEvent } from '../../utils/safetyGuardrails';

defineProps<{
  alert: SafetyInterceptEvent | null;
}>();

defineEmits<{
  (e: 'approve', eventId: string): void;
  (e: 'reject', eventId: string): void;
}>();
</script>

<template>
  <DangerousCommandBanner
    :alert="alert"
    @approve="(id) => $emit('approve', id)"
    @reject="(id) => $emit('reject', id)"
  />
</template>
