<script setup lang="ts">
import { computed } from "vue";
import type { FlowStateTone, FlowStepId } from "../../utils/flowState";

const props = withDefaults(
  defineProps<{
    currentStep: FlowStepId;
    state: FlowStateTone;
    details?: string;
    compact?: boolean;
    label?: string;
  }>(),
  { compact: false },
);

const steps: Array<{ id: FlowStepId; label: string; shortLabel: string }> = [
  { id: "ready", label: "Sẵn sàng", shortLabel: "Sẵn sàng" },
  { id: "preflight", label: "Kiểm tra trước chạy", shortLabel: "Kiểm tra" },
  { id: "running", label: "CAO đang chạy", shortLabel: "CAO" },
  { id: "review", label: "Review", shortLabel: "Review" },
  { id: "handoff", label: "Handoff", shortLabel: "Handoff" },
];

const currentIndex = computed(() => Math.max(0, steps.findIndex((step) => step.id === props.currentStep)));
const stepStatus = (index: number) => {
  if (index < currentIndex.value) return "complete";
  if (index > currentIndex.value) return "upcoming";
  return props.state;
};

const liveLabel = computed(() => props.label || steps[currentIndex.value]?.label || "Flow");
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
        v-for="(step, index) in steps"
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
