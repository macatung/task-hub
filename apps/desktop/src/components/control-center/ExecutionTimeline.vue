<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ExecutionStreamEvent, GroupedExecutionStreamEvent } from '../../utils/executionStream';
import { eventMatchesFilter, groupExecutionStreamEvents } from '../../utils/executionStream';

const props = withDefaults(defineProps<{
  events: ExecutionStreamEvent[];
  running?: boolean;
  currentStep?: string;
  selectedWorker?: string | null;
}>(), { running: false, selectedWorker: null });

const emit = defineEmits<{ select: [event: ExecutionStreamEvent]; jumpLatest: [] }>();
const filter = ref<'all' | 'steps' | 'tools' | 'output' | 'evidence' | 'errors'>('all');
const followLive = ref(true);
const groupDuplicates = ref(true);
const expanded = ref<Record<string, boolean>>({});
const container = ref<HTMLElement | null>(null);

const visibleEvents = computed(() => props.events.filter((event) =>
  eventMatchesFilter(event, filter.value) &&
  (!props.selectedWorker || event.actor?.id === props.selectedWorker || event.actor?.sessionId === props.selectedWorker),
));

const groupedVisibleEvents = computed(() =>
  groupExecutionStreamEvents(visibleEvents.value, {
    collapseDuplicates: groupDuplicates.value,
    groupSteps: groupDuplicates.value,
  })
);

const eventTone = (event: ExecutionStreamEvent) => {
  if (event.type === 'error' || event.type === 'step.failed' || event.status === 'failed') return 'is-error';
  if (event.type === 'step.completed' || event.type === 'run.completed' || event.type === 'evidence' || event.type === 'handoff') return 'is-success';
  if (event.type === 'tool.started' || event.type === 'thought') return 'is-muted';
  return event.type.includes('started') ? 'is-active' : '';
};

const iconFor = (event: ExecutionStreamEvent) => {
  if (event.type.includes('failed') || event.type === 'error') return '×';
  if (event.type.includes('completed') || event.type === 'evidence' || event.type === 'handoff') return '✓';
  if (event.type.startsWith('tool.')) return '⌘';
  if (event.type === 'thought') return '…';
  return '•';
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDuration = (ms?: number) => {
  if (!ms || ms < 500) return '';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return `${mins}m ${remSec}s`;
};

const shortActor = (event: ExecutionStreamEvent) => event.actor?.role || event.actor?.provider || event.source.toUpperCase();
const shouldExpand = (group: GroupedExecutionStreamEvent) =>
  expanded.value[group.groupKey] || expanded.value[group.event.id] || group.stepId === props.currentStep || group.event.type === 'error' || group.event.type === 'step.failed';

const toggle = (group: GroupedExecutionStreamEvent) => {
  const current = shouldExpand(group);
  expanded.value[group.groupKey] = !current;
  expanded.value[group.event.id] = !current;
};

const scrollLatest = async () => {
  await nextTick();
  if (container.value) container.value.scrollTop = container.value.scrollHeight;
  emit('jumpLatest');
};

watch(() => props.events.length, () => { if (followLive.value) void scrollLatest(); });
</script>

<template>
  <section class="execution-timeline" data-testid="execution-timeline">
    <header class="execution-timeline__toolbar">
      <div class="execution-timeline__title">
        <span class="execution-live-dot" :class="{ 'is-live': running }"></span>
        <span>Execution stream</span>
        <span class="execution-count">{{ groupedVisibleEvents.length }}</span>
      </div>
      <div class="execution-timeline__actions">
        <label class="execution-filter">
          <span class="sr-only">Filter</span>
          <select v-model="filter">
            <option value="all">All</option>
            <option value="steps">Steps</option>
            <option value="tools">Tools</option>
            <option value="output">Output</option>
            <option value="evidence">Evidence</option>
            <option value="errors">Errors</option>
          </select>
        </label>
        <button
          type="button"
          class="execution-tool-button"
          :class="{ 'is-active': groupDuplicates }"
          :title="groupDuplicates ? 'Đang gộp các bước trùng nhau' : 'Hiển thị chi tiết từng sự kiện'"
          @click="groupDuplicates = !groupDuplicates"
        >
          {{ groupDuplicates ? 'Grouped' : 'Ungrouped' }}
        </button>
        <button
          type="button"
          class="execution-tool-button"
          :class="{ 'is-active': followLive }"
          @click="followLive = !followLive"
        >
          {{ followLive ? 'Following' : 'Follow live' }}
        </button>
        <button type="button" class="execution-tool-button" @click="scrollLatest">Latest</button>
      </div>
    </header>
    <div ref="container" class="execution-timeline__body">
      <div v-if="!groupedVisibleEvents.length" class="execution-empty">
        <span>{{ running ? 'Đang chờ event execution…' : 'Chưa có normalized event cho run này.' }}</span>
      </div>
      <article
        v-for="group in groupedVisibleEvents"
        :key="group.groupKey"
        class="execution-event"
        :class="eventTone(group.event)"
      >
        <div class="execution-event__rail">
          <span class="execution-event__icon">{{ iconFor(group.event) }}</span>
        </div>
        <button type="button" class="execution-event__main" @click="emit('select', group.event)">
          <div class="execution-event__meta">
            <span>{{ formatTime(group.startedAt) }}</span>
            <span v-if="group.durationMs" class="execution-duration-badge">{{ formatDuration(group.durationMs) }}</span>
            <span>{{ shortActor(group.event) }}</span>
            <span v-if="group.stepId" class="execution-chip">{{ group.stepId }}</span>
            <span v-if="group.repeatCount > 1" class="execution-repeat-badge" :title="'Gộp ' + group.repeatCount + ' sự kiện liên tiếp'">{{ group.repeatCount }}×</span>
            <span v-if="group.event.source" class="execution-source">{{ group.event.source }}</span>
          </div>
          <div class="execution-event__summary">{{ group.event.summary }}</div>
          <div v-if="group.event.detail && shouldExpand(group)" class="execution-event__detail">{{ group.event.detail }}</div>
          <div v-if="shouldExpand(group) && group.events.length > 1" class="execution-sub-events">
            <div v-for="(sub, subIdx) in group.events" :key="sub.id || subIdx" class="execution-sub-event">
              <span class="truncate">{{ sub.summary }}</span>
              <span class="execution-sub-event__time">{{ formatTime(sub.occurredAt) }}</span>
            </div>
          </div>
        </button>
        <button
          v-if="group.event.detail || group.event.payload || group.events.length > 1"
          type="button"
          class="execution-event__expand"
          :aria-expanded="shouldExpand(group)"
          @click="toggle(group)"
        >
          {{ shouldExpand(group) ? '⌃' : '⌄' }}
        </button>
      </article>
    </div>
  </section>
</template>
