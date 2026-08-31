<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CaoWorkflowStepStatus } from '../../services/caoBridgeService';

interface EpicTaskGroup { id?: number; taskKey?: string; title: string; dependencies?: string[]; steps: CaoWorkflowStepStatus[]; status?: string; }
const props = defineProps<{ tasks: EpicTaskGroup[]; currentStep?: string; selectedTaskId?: number }>();
const emit = defineEmits<{ select: [task: EpicTaskGroup] }>();
const open = ref<Record<string, boolean>>({});
const normalized = computed(() => props.tasks.map((task) => ({ ...task, key: String(task.id || task.taskKey || task.title), completed: task.steps.filter((step) => step.state === 'completed').length, current: task.steps.find((step) => step.state === 'running' || step.id === props.currentStep)?.id, failed: task.steps.find((step) => ['failed', 'blocked'].includes(step.state)) })));
const isOpen = (task: any) => open.value[task.key] ?? Boolean(task.current || task.failed || task.id === props.selectedTaskId);
const toggle = (task: any) => { open.value[task.key] = !isOpen(task); emit('select', task); };
const tone = (state?: string) => ['failed', 'blocked'].includes(state || '') ? 'is-error' : state === 'completed' ? 'is-success' : state === 'running' ? 'is-active' : '';
</script>

<template>
  <section class="epic-task-accordion" data-testid="epic-task-accordion">
    <header><span>Epic execution</span><span>{{ normalized.filter((task) => task.completed === task.steps.length && task.steps.length).length }}/{{ normalized.length }} tasks</span></header>
    <article v-for="task in normalized" :key="task.key" class="epic-task" :class="tone(task.failed?.state || task.status)">
      <button type="button" class="epic-task__summary" :aria-expanded="isOpen(task)" @click="toggle(task)"><span class="epic-task__state">{{ task.failed ? '×' : task.completed === task.steps.length && task.steps.length ? '✓' : task.current ? '●' : '○' }}</span><span class="epic-task__copy"><strong>{{ task.taskKey || `#${task.id}` }} · {{ task.title }}</strong><small>{{ task.current || (task.failed ? task.failed.id : `${task.completed}/${task.steps.length} steps`) }}</small></span><span v-if="task.dependencies?.length" class="epic-task__deps">Depends on {{ task.dependencies.join(', ') }}</span><span>{{ isOpen(task) ? '⌃' : '⌄' }}</span></button>
      <div v-if="isOpen(task)" class="epic-task__steps"><div v-for="step in task.steps" :key="step.id" class="epic-task__step" :class="tone(step.state)"><span>{{ step.state === 'completed' ? '✓' : step.state === 'failed' ? '×' : step.state === 'running' ? '●' : '○' }}</span><span>{{ step.label || step.id }}</span><em>{{ step.state }}</em></div><p v-if="task.failed?.error">{{ task.failed.error }}</p></div>
    </article>
  </section>
</template>
