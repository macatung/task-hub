import { ref, computed } from 'vue';
import {
  AutoPilotRunner,
  AUTO_PILOT_STEPS,
  ROLE_METADATA,
  type AutoPilotStage,
  type AutoPilotStepRecord,
  type AutoPilotTaskTarget,
  type AutoPilotResult,
  type AutoPilotConfig,
  type ArchitectHandoff,
  type ImplementerHandoff,
  type TestEngineerHandoff,
  type AuditorHandoff,
} from '../utils/autoPilotRunner';
import type {
  AgentRoleType,
  AgentStageExecution,
  InterAgentContextPackage,
} from '../types/desktop';
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
const stageExecutions = ref<AgentStageExecution[]>([
  { role: 'architect', title: ROLE_METADATA.architect.title, avatar: ROLE_METADATA.architect.avatar, badge: ROLE_METADATA.architect.badge, model: ROLE_METADATA.architect.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
  { role: 'implementer', title: ROLE_METADATA.implementer.title, avatar: ROLE_METADATA.implementer.avatar, badge: ROLE_METADATA.implementer.badge, model: ROLE_METADATA.implementer.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
  { role: 'tester', title: ROLE_METADATA.tester.title, avatar: ROLE_METADATA.tester.avatar, badge: ROLE_METADATA.tester.badge, model: ROLE_METADATA.tester.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
  { role: 'auditor', title: ROLE_METADATA.auditor.title, avatar: ROLE_METADATA.auditor.avatar, badge: ROLE_METADATA.auditor.badge, model: ROLE_METADATA.auditor.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
]);
const contextPackages = ref<InterAgentContextPackage[]>([]);
const architectHandoff = ref<ArchitectHandoff | null>(null);
const implementerHandoff = ref<ImplementerHandoff | null>(null);
const testHandoff = ref<TestEngineerHandoff | null>(null);
const auditorHandoff = ref<AuditorHandoff | null>(null);
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
    contextPackages.value = [];
    architectHandoff.value = null;
    implementerHandoff.value = null;
    testHandoff.value = null;
    auditorHandoff.value = null;

    // Reset steps
    steps.value = AUTO_PILOT_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
    }));

    // Reset stage executions
    stageExecutions.value = [
      { role: 'architect', title: ROLE_METADATA.architect.title, avatar: ROLE_METADATA.architect.avatar, badge: ROLE_METADATA.architect.badge, model: config.roleModels?.architect || config.model || ROLE_METADATA.architect.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'implementer', title: ROLE_METADATA.implementer.title, avatar: ROLE_METADATA.implementer.avatar, badge: ROLE_METADATA.implementer.badge, model: config.roleModels?.implementer || config.model || ROLE_METADATA.implementer.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'tester', title: ROLE_METADATA.tester.title, avatar: ROLE_METADATA.tester.avatar, badge: ROLE_METADATA.tester.badge, model: config.roleModels?.tester || config.model || ROLE_METADATA.tester.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'auditor', title: ROLE_METADATA.auditor.title, avatar: ROLE_METADATA.auditor.avatar, badge: ROLE_METADATA.auditor.badge, model: config.roleModels?.auditor || config.model || ROLE_METADATA.auditor.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
    ];

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
      onRoleStageChange: (stageExecution) => {
        const idx = stageExecutions.value.findIndex((s) => s.role === stageExecution.role);
        if (idx !== -1) {
          stageExecutions.value[idx] = { ...stageExecution };
        } else {
          stageExecutions.value.push({ ...stageExecution });
        }
      },
      onContextHandoff: (pkg) => {
        contextPackages.value.push({ ...pkg });
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
      if (result.architectHandoff) architectHandoff.value = result.architectHandoff;
      if (result.implementerHandoff) implementerHandoff.value = result.implementerHandoff;
      if (result.testHandoff) testHandoff.value = result.testHandoff;
      if (result.auditorHandoff) auditorHandoff.value = result.auditorHandoff;
      if (result.stageExecutions) stageExecutions.value = result.stageExecutions;
      if (result.contextPackages) contextPackages.value = result.contextPackages;

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
    contextPackages.value = [];
    architectHandoff.value = null;
    implementerHandoff.value = null;
    testHandoff.value = null;
    auditorHandoff.value = null;
    steps.value = AUTO_PILOT_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
    }));
    stageExecutions.value = [
      { role: 'architect', title: ROLE_METADATA.architect.title, avatar: ROLE_METADATA.architect.avatar, badge: ROLE_METADATA.architect.badge, model: ROLE_METADATA.architect.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'implementer', title: ROLE_METADATA.implementer.title, avatar: ROLE_METADATA.implementer.avatar, badge: ROLE_METADATA.implementer.badge, model: ROLE_METADATA.implementer.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'tester', title: ROLE_METADATA.tester.title, avatar: ROLE_METADATA.tester.avatar, badge: ROLE_METADATA.tester.badge, model: ROLE_METADATA.tester.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
      { role: 'auditor', title: ROLE_METADATA.auditor.title, avatar: ROLE_METADATA.auditor.avatar, badge: ROLE_METADATA.auditor.badge, model: ROLE_METADATA.auditor.defaultModel, status: 'pending', terminalLogs: [], toolCalls: [] },
    ];
  };

  return {
    isRunning,
    currentStage,
    activeTask,
    steps,
    stageExecutions,
    contextPackages,
    architectHandoff,
    implementerHandoff,
    testHandoff,
    auditorHandoff,
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
