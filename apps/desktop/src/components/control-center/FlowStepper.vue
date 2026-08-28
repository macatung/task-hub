<script setup lang="ts">
import { computed } from "vue";
import type { FlowStateTone, FlowStepId } from "../../utils/flowState";

const props = withDefaults(
  defineProps<{
    currentStep: FlowStepId | string;
    state: FlowStateTone;
    details?: string;
    compact?: boolean;
    label?: string;
    mode?: "cao" | "multi_agent";
    steps?: Array<{ id: string; label: string; shortLabel: string }>;
  }>(),
  { compact: false, mode: "cao" },
);

const defaultCaoSteps: Array<{ id: FlowStepId | string; label: string; shortLabel: string }> = [
  { id: "ready", label: "Sẵn sàng", shortLabel: "Sẵn sàng" },
  { id: "preflight", label: "Kiểm tra trước chạy", shortLabel: "Kiểm tra" },
  { id: "running", label: "CAO đang chạy", shortLabel: "CAO" },
  { id: "review", label: "Review", shortLabel: "Review" },
  { id: "handoff", label: "Handoff", shortLabel: "Handoff" },
];

const multiAgentSteps: Array<{ id: string; label: string; shortLabel: string }> = [
  { id: "architect", label: "1. Architect", shortLabel: "Architect" },
  { id: "implementer", label: "2. Implementer", shortLabel: "Implementer" },
  { id: "tester", label: "3. Tester", shortLabel: "Tester" },
  { id: "auditor", label: "4. Auditor", shortLabel: "Auditor" },
];

const activeSteps = computed(() => {
  if (props.steps && props.steps.length > 0) return props.steps;
  if (props.mode === "multi_agent") return multiAgentSteps;
  return defaultCaoSteps;
});

const currentIndex = computed(() => Math.max(0, activeSteps.value.findIndex((step) => step.id === props.currentStep)));
const stepStatus = (index: number) => {
  if (index < currentIndex.value) return "complete";
  if (index > currentIndex.value) return "upcoming";
  return props.state;
};

const liveLabel = computed(() => props.label || activeSteps.value[currentIndex.value]?.label || "Flow");
</script>

<template>
  <nav
    class="cc-flow-stepper"
    :class="{ 'cc-flow-stepper--compact': compact }"
    aria-label="CAO execution flow"
    aria-live="polite"
  >
    <ol class="cc-flow-stepper__track">
      <li
        v-for="(step, index) in activeSteps"
        :key="step.id"
        class="cc-flow-stepper__item"
        :class="`cc-flow-stepper__item--${stepStatus(index)}`"
        :aria-current="index === currentIndex ? 'step' : undefined"
      >
        <span class="cc-flow-stepper__node" aria-hidden="true">
          <i v-if="stepStatus(index) === 'complete'" class="codicon codicon-check"></i>
          <span v-else>{{ index + 1 }}</span>
        </span>
        <span class="cc-flow-stepper__copy">
          <span class="cc-flow-stepper__label cc-flow-stepper__label--full">{{ step.label }}</span>
          <span class="cc-flow-stepper__label cc-flow-stepper__label--short">{{ step.shortLabel }}</span>
          <span v-if="index === currentIndex" class="cc-flow-stepper__state">{{ liveLabel }}</span>
        </span>
      </li>
    </ol>
    <p v-if="details" class="cc-flow-stepper__details">{{ details }}</p>
  </nav>
</template>
