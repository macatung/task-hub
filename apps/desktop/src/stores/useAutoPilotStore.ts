import { ref, computed } from 'vue';
import {
  AutoPilotRunner,
  AUTO_PILOT_STEPS,
  type AutoPilotStage,
  type AutoPilotStepRecord,
  type AutoPilotTaskTarget,
  type AutoPilotResult,
  type AutoPilotConfig,
} from '../utils/autoPilotRunner';
import type { SafetyInterceptEvent } from '../utils/safetyGuardrails';
import type { VerificationEvidence } from '../utils/testEvidence';
import type { AgentHandoffPayload } from '../utils/diffHandoff';

// Global reactive singleton for Auto-Pilot state
const isRunning = ref(false);
const currentStage = ref<AutoPilotStage>('idle');
const activeTask = ref<AutoPilotTaskTarget | null>(null);
const steps = ref<AutoPilotStepRecord[]>(
  AUTO_PILOT_STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    status: 'pending',
  }))
);
const activeSafetyAlert = ref<SafetyInterceptEvent | null>(null);
const lastResult = ref<AutoPilotResult | null>(null);
const lastEvidence = ref<VerificationEvidence | null>(null);
const lastHandoff = ref<AgentHandoffPayload | null>(null);
const terminalLogs = ref<string[]>([]);
const errorMessage = ref<string | null>(null);

let runnerInstance: AutoPilotRunner | null = null;

export function useAutoPilotStore() {
  const currentStepIndex = computed(() => {
    const idx = AUTO_PILOT_STEPS.findIndex((s) => s.id === currentStage.value);
    return idx >= 0 ? idx : 0;
  });

  const progressPercent = computed(() => {
    if (currentStage.value === 'completed') return 100;
    if (currentStage.value === 'idle') return 0;
    const completedCount = steps.value.filter((s) => s.status === 'completed').length;
    return Math.round((completedCount / AUTO_PILOT_STEPS.length) * 100);
  });

  const isWaitingInput = computed(() => currentStage.value === 'waiting_input' && activeSafetyAlert.value !== null);

  const startAutoPilot = async (
    task: AutoPilotTaskTarget,
    config: Partial<AutoPilotConfig> = {}
  ): Promise<AutoPilotResult> => {
    if (isRunning.value) {
      throw new Error('An Auto-Pilot task is already executing.');
    }

    isRunning.value = true;
    activeTask.value = task;
    errorMessage.value = null;
    terminalLogs.value = [];
    activeSafetyAlert.value = null;
    lastResult.value = null;

    // Reset steps
    steps.value = AUTO_PILOT_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
    }));

    runnerInstance = new AutoPilotRunner({
      ...config,
      onStageChange: (stage) => {
        currentStage.value = stage;
      },
      onStepChange: (step) => {
        const idx = steps.value.findIndex((s) => s.id === step.id);
        if (idx !== -1) {
          steps.value[idx] = { ...step };
        }
      },
      onLog: ({ text }) => {
        terminalLogs.value.push(text);
      },
      onSafetyAlert: (alert) => {
        activeSafetyAlert.value = alert;
      },
      onEvidence: (evidence) => {
        lastEvidence.value = evidence;
      },
      onHandoff: (handoff) => {
        lastHandoff.value = handoff;
      },
    });

    try {
      const result = await runnerInstance.start(task);
      lastResult.value = result;
      if (!result.success && result.error) {
        errorMessage.value = result.error;
      }
      return result;
    } finally {
      isRunning.value = false;
      if (currentStage.value !== 'completed' && currentStage.value !== 'failed' && currentStage.value !== 'cancelled') {
        currentStage.value = lastResult.value?.success ? 'completed' : 'failed';
      }
    }
  };

  const cancelAutoPilot = async () => {
    if (runnerInstance) {
      await runnerInstance.cancel();
      currentStage.value = 'cancelled';
      isRunning.value = false;
    }
  };

  const approveSafetyAlert = (eventId?: string) => {
    if (runnerInstance) {
      runnerInstance.approveSafetyAlert(eventId);
      activeSafetyAlert.value = null;
    }
  };

  const rejectSafetyAlert = (eventId?: string, reason?: string) => {
    if (runnerInstance) {
      runnerInstance.rejectSafetyAlert(eventId, reason);
      activeSafetyAlert.value = null;
    }
  };

  const reset = () => {
    isRunning.value = false;
    currentStage.value = 'idle';
    activeTask.value = null;
    activeSafetyAlert.value = null;
    lastResult.value = null;
    lastEvidence.value = null;
    lastHandoff.value = null;
    errorMessage.value = null;
    terminalLogs.value = [];
    steps.value = AUTO_PILOT_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
    }));
  };

  return {
    isRunning,
    currentStage,
    activeTask,
    steps,
    currentStepIndex,
    progressPercent,
    activeSafetyAlert,
    isWaitingInput,
    lastResult,
    lastEvidence,
    lastHandoff,
    terminalLogs,
    errorMessage,
    startAutoPilot,
    cancelAutoPilot,
    approveSafetyAlert,
    rejectSafetyAlert,
    reset,
  };
}
