<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionStreamEvent } from '../../utils/executionStream';

const props = defineProps<{ event: ExecutionStreamEvent | null; rawTerminal?: string }>();
const emit = defineEmits<{ close: []; copy: [] }>();
const payloadText = computed(() => props.event?.payload ? JSON.stringify(props.event.payload, null, 2) : '');
const copy = async () => {
  const text = [props.event?.summary, props.event?.detail, payloadText.value, props.rawTerminal].filter(Boolean).join('\n\n');
  try { await navigator.clipboard.writeText(text); emit('copy'); } catch { /* clipboard can be unavailable in tests */ }
};
</script>

<template>
  <aside v-if="event" class="execution-detail-drawer" data-testid="execution-detail-drawer" aria-label="Execution details">
    <header class="execution-detail-drawer__header"><div><div class="execution-detail-drawer__eyebrow">{{ event.source }} · {{ event.type }}</div><h3>{{ event.summary }}</h3></div><button type="button" class="execution-close" aria-label="Close details" @click="emit('close')">×</button></header>
    <div class="execution-detail-drawer__body">
      <dl class="execution-detail-grid"><div><dt>Time</dt><dd>{{ event.occurredAt }}</dd></div><div><dt>Step</dt><dd>{{ event.stepId || '—' }}</dd></div><div><dt>Actor</dt><dd>{{ event.actor?.role || event.actor?.provider || '—' }}</dd></div><div><dt>Status</dt><dd>{{ event.status || '—' }}</dd></div></dl>
      <section v-if="event.detail"><h4>Detail</h4><pre>{{ event.detail }}</pre></section>
      <section v-if="payloadText"><h4>Payload</h4><pre>{{ payloadText }}</pre></section>
      <section v-if="rawTerminal"><h4>Raw terminal</h4><pre>{{ rawTerminal }}</pre></section>
    </div>
    <footer><button type="button" class="execution-tool-button" @click="copy">Copy details</button><button type="button" class="execution-tool-button" @click="emit('close')">Close</button></footer>
  </aside>
</template>
