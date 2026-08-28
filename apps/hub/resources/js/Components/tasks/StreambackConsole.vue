<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';
import StatusBadge from '@/Components/ui/StatusBadge.vue';

export type AgentRoleType = 'architect' | 'implementer' | 'tester' | 'auditor';

export interface AgentRunEventItem {
  id?: number | string;
  event_id?: string;
  event_type: string;
  status?: string;
  payload?: any;
  occurred_at?: string;
}

export interface VerificationEvidenceItem {
  id?: number;
  evidence_type: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | string;
  command?: string | null;
  summary?: string | null;
  artifact_url?: string | null;
  commit_sha?: string | null;
  metadata?: any;
  created_at?: string;
}

export interface AgentRunLogItem {
  id?: number;
  sequence?: number;
  stream?: 'stdout' | 'stderr' | 'system' | string;
  content: string;
  role?: AgentRoleType;
  occurred_at?: string;
}

export interface AgentRunFullItem {
  id: number;
  task_id?: number | null;
  run_type?: string;
  provider: string;
  execution_mode?: string;
  runner_id?: number | null;
  status: string;
  branch?: string | null;
  commit_sha?: string | null;
  pull_request_url?: string | null;
  summary?: string | null;
  failure_reason?: string | null;
  metadata?: {
    model?: string;
    mode?: string;
    target_runner?: { id: number; name: string; hostname?: string };
    context?: any;
    role_models?: Record<AgentRoleType, string>;
    stage_executions?: Record<AgentRoleType, any>;
    stageExecutions?: Record<AgentRoleType, any>;
    plan?: any;
    discovery_plan?: any;
    handoff?: {
      summary?: string;
      changed_files?: string[];
      auto_review?: any;
      commit_sha?: string;
      tests?: any[];
      [key: string]: any;
    };
    auto_review?: any;
    epic_sequence?: {
      local_cao?: boolean;
      children?: any[];
      [key: string]: any;
    };
    [key: string]: any;
  } | null;
  evidence?: VerificationEvidenceItem[];
  events?: AgentRunEventItem[];
  logs?: AgentRunLogItem[];
  runner?: { id: number; name: string; hostname?: string; os_platform?: string } | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface TaskItemProps {
  id: number;
  issue_key?: string;
  title: string;
  status: string;
  issue_type?: string;
  description?: string | null;
  priority?: string;
}

export interface ToolCallItem {
  id: number | string;
  tool: string;
  role?: AgentRoleType;
  status: 'running' | 'success' | 'failed' | 'completed';
  params?: any;
  output?: string;
  durationMs?: number;
  time?: string;
}

export interface MultiAgentPhaseItem {
  id: number;
  role: AgentRoleType;
  title: string;
  subtitle: string;
  avatar: string;
  badge: string;
  badgeClass: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  logs: AgentRunLogItem[];
  toolCalls: ToolCallItem[];
  evidence: VerificationEvidenceItem[];
  artifacts: {
    plan?: any;
    changedFiles?: string[];
    testResults?: {
      passed: number;
      failed: number;
      total: number;
      summary?: string;
      command?: string;
    };
    handoffSummary?: string | null;
    autoReview?: any;
    prUrl?: string | null;
    commitSha?: string | null;
    epicChildren?: any[];
  };
}

const props = withDefaults(defineProps<{
  task: TaskItemProps;
  activeRun: AgentRunFullItem | null;
  isDarkMode?: boolean;
}>(), {
  isDarkMode: true,
});

const emit = defineEmits<{
  (e: 'approved', task: TaskItemProps): void;
  (e: 'rejected', task: TaskItemProps): void;
  (e: 'refresh'): void;
}>();

const runDetails = ref<AgentRunFullItem | null>(null);
const logs = ref<AgentRunLogItem[]>([]);
const autoScroll = ref(true);
const terminalContainer = ref<HTMLElement | null>(null);
const isApproving = ref(false);
const isRejecting = ref(false);
const isCancelling = ref(false);
const isPausing = ref(false);
const isResuming = ref(false);
const isActionFeedback = ref('');
const copiedLogs = ref(false);
const copiedPhaseLogs = ref<Record<string, boolean>>({});
const activeToolAccordion = ref<number | string | null>(null);

// Accordion toggle states per role phase
const expandedPhases = ref<Record<AgentRoleType, boolean>>({
  architect: true,
  implementer: true,
  tester: true,
  auditor: true,
});

const expandedLogs = ref<Record<AgentRoleType, boolean>>({
  architect: false,
  implementer: true,
  tester: false,
  auditor: false,
});

const expandedTools = ref<Record<AgentRoleType, boolean>>({
  architect: false,
  implementer: false,
  tester: false,
  auditor: false,
});

const expandedArtifacts = ref<Record<AgentRoleType, boolean>>({
  architect: true,
  implementer: true,
  tester: true,
  auditor: true,
});

const showGlobalConsole = ref(false);

const handoffFiles = computed<string[]>(() => {
  const run = runDetails.value || props.activeRun;
  const files = run?.metadata?.handoff?.changed_files;
  return Array.isArray(files) ? files.filter((file): file is string => typeof file === 'string' && file.trim().length > 0) : [];
});

const autoReview = computed(() => {
  const run = runDetails.value || props.activeRun;
  return run?.metadata?.handoff?.auto_review || run?.metadata?.auto_review || null;
});

const isEpicAggregate = computed(() => {
  const run = runDetails.value || props.activeRun;
  return props.task?.issue_type === 'epic'
    && run?.run_type === 'epic'
    && run?.metadata?.epic_sequence?.local_cao === true;
});

const epicChildren = computed(() => {
  const run = runDetails.value || props.activeRun;
  return Array.isArray(run?.metadata?.epic_sequence?.children)
    ? run.metadata.epic_sequence.children
    : [];
});

let sseSource: EventSource | null = null;
let pollInterval: number | null = null;

// Tool Calls Extraction from events/logs
const toolCalls = computed<ToolCallItem[]>(() => {
  const run = runDetails.value || props.activeRun;
  if (!run?.events) return [];
  const list: ToolCallItem[] = [];

  run.events.forEach((evt, idx) => {
    if (evt.event_type.startsWith('tool_') || evt.payload?.tool || evt.event_type === 'command_executed') {
      const toolName = evt.payload?.tool || evt.payload?.command || evt.event_type.replace('tool_', '');
      list.push({
        id: idx,
        tool: toolName,
        role: evt.payload?.role,
        status: evt.status === 'failed' ? 'failed' : 'success',
        params: evt.payload?.params || evt.payload?.args || evt.payload?.command,
        output: evt.payload?.output || evt.payload?.result,
        durationMs: evt.payload?.duration_ms,
        time: evt.occurred_at ? new Date(evt.occurred_at).toLocaleTimeString() : undefined,
      });
    }
  });

  return list;
});

// Role Classifier for Logs & Events
const classifyRoleForLog = (log: AgentRunLogItem, activeRunStatus: string): AgentRoleType => {
  if (log.role) return log.role;
  const content = log.content.toLowerCase();
  if (content.includes('[architect]') || content.includes('discovery') || content.includes('plan') || content.includes('mcp context')) {
    return 'architect';
  }
  if (content.includes('[implementer]') || content.includes('worktree') || content.includes('patch') || content.includes('code modification')) {
    return 'implementer';
  }
  if (content.includes('[test engineer]') || content.includes('[tester]') || content.includes('vitest') || content.includes('phpunit') || content.includes('test suite') || content.includes('running tests')) {
    return 'tester';
  }
  if (content.includes('[auditor]') || content.includes('[reviewer]') || content.includes('handoff') || content.includes('auto_review') || content.includes('evidence audit')) {
    return 'auditor';
  }

  // Fallback based on run status
  if (['queued', 'claimed', 'preparing'].includes(activeRunStatus)) return 'architect';
  if (['running', 'waiting_input'].includes(activeRunStatus)) return 'implementer';
  if (['testing'].includes(activeRunStatus)) return 'tester';
  if (['verified', 'needs_review', 'completed'].includes(activeRunStatus)) return 'auditor';
  return 'implementer';
};

const classifyRoleForTool = (evt: AgentRunEventItem): AgentRoleType => {
  if (evt.payload?.role) return evt.payload.role;
  const name = (evt.payload?.tool || evt.payload?.command || evt.event_type || '').toLowerCase();
  if (name.includes('plan') || name.includes('read_dir') || name.includes('context') || name.includes('mcp') || name.includes('discovery')) {
    return 'architect';
  }
  if (name.includes('write') || name.includes('replace') || name.includes('checkout') || name.includes('patch') || name.includes('git')) {
    return 'implementer';
  }
  if (name.includes('test') || name.includes('vitest') || name.includes('phpunit') || name.includes('verify')) {
    return 'tester';
  }
  if (name.includes('handoff') || name.includes('evidence') || name.includes('review') || name.includes('audit')) {
    return 'auditor';
  }
  return 'implementer';
};

// 4-Phase Multi-Agent Step Stream
const multiAgentPhases = computed<MultiAgentPhaseItem[]>(() => {
  const run = runDetails.value || props.activeRun;
  const status = run?.status || 'pending';
  const events = run?.events || [];
  const allLogs = logs.value.length ? logs.value : (run?.logs || []);
  const allEvidence = run?.evidence || props.activeRun?.evidence || [];
  const metadata: Record<string, any> = (run?.metadata || {}) as Record<string, any>;
  const stageExecutions: Record<string, any> = (metadata.stage_executions || metadata.stageExecutions || {}) as Record<string, any>;

  const hasEvent = (type: string) => events.some(e => e.event_type === type);

  // Model resolution per role
  const roleModels: Record<string, string> = (metadata.role_models || {}) as Record<string, string>;
  const defaultBaseModel = (metadata.model as string) || 'gemini-3.7-flash';

  // 1. Architect Status
  let p1Status: MultiAgentPhaseItem['status'] = stageExecutions.architect?.status || 'pending';
  if (!stageExecutions.architect?.status && run) {
    if (['running', 'waiting_input', 'testing', 'verified', 'needs_review', 'completed'].includes(status) || hasEvent('context_loaded') || hasEvent('worktree_prepared')) {
      p1Status = 'completed';
    } else if (status === 'preparing' || status === 'claimed' || status === 'queued') {
      p1Status = 'running';
    } else if (status === 'failed') {
      p1Status = (hasEvent('context_loaded') || hasEvent('worktree_prepared')) ? 'completed' : 'failed';
    }
  }

  // 2. Core Implementer Status
  let p2Status: MultiAgentPhaseItem['status'] = stageExecutions.implementer?.status || 'pending';
  if (!stageExecutions.implementer?.status && run) {
    if (['testing', 'verified', 'needs_review', 'completed'].includes(status) || hasEvent('handoff_completed') || hasEvent('testing_started')) {
      p2Status = 'completed';
    } else if (status === 'running') {
      p2Status = 'running';
    } else if (status === 'waiting_input') {
      p2Status = 'paused';
    } else if (status === 'failed') {
      p2Status = hasEvent('testing_started') ? 'completed' : (p1Status === 'completed' ? 'failed' : 'pending');
    }
  }

  // 3. Test Engineer Status
  let p3Status: MultiAgentPhaseItem['status'] = stageExecutions.tester?.status || 'pending';
  if (!stageExecutions.tester?.status && run) {
    const hasEvidence = allEvidence.length > 0 || hasEvent('verification_passed');
    if (['verified', 'needs_review', 'completed'].includes(status) && hasEvidence) {
      p3Status = 'completed';
    } else if (status === 'testing' || (status === 'running' && hasEvent('testing_started'))) {
      p3Status = 'running';
    } else if (status === 'failed') {
      p3Status = hasEvent('testing_started') ? 'failed' : 'pending';
    }
  }

  // 4. Evidence Auditor / Reviewer Status
  let p4Status: MultiAgentPhaseItem['status'] = stageExecutions.auditor?.status || 'pending';
  if (!stageExecutions.auditor?.status && run) {
    if (status === 'completed' || props.task?.status === 'done') {
      p4Status = 'completed';
    } else if (['verified', 'needs_review'].includes(status)) {
      p4Status = 'completed';
    } else if (status === 'failed' && (hasEvent('audit_started') || hasEvent('handoff_started'))) {
      p4Status = 'failed';
    }
  }

  // Partition logs by role
  const p1Logs: AgentRunLogItem[] = [];
  const p2Logs: AgentRunLogItem[] = [];
  const p3Logs: AgentRunLogItem[] = [];
  const p4Logs: AgentRunLogItem[] = [];

  allLogs.forEach(l => {
    const role = classifyRoleForLog(l, status);
    if (role === 'architect') p1Logs.push(l);
    else if (role === 'implementer') p2Logs.push(l);
    else if (role === 'tester') p3Logs.push(l);
    else if (role === 'auditor') p4Logs.push(l);
    else p2Logs.push(l);
  });

  // Partition tool calls by role
  const p1Tools: ToolCallItem[] = [];
  const p2Tools: ToolCallItem[] = [];
  const p3Tools: ToolCallItem[] = [];
  const p4Tools: ToolCallItem[] = [];

  events.forEach((evt, idx) => {
    if (evt.event_type.startsWith('tool_') || evt.payload?.tool || evt.event_type === 'command_executed') {
      const toolName = evt.payload?.tool || evt.payload?.command || evt.event_type.replace('tool_', '');
      const item: ToolCallItem = {
        id: idx,
        tool: toolName,
        role: evt.payload?.role,
        status: evt.status === 'failed' ? 'failed' : 'success',
        params: evt.payload?.params || evt.payload?.args || evt.payload?.command,
        output: evt.payload?.output || evt.payload?.result,
        durationMs: evt.payload?.duration_ms,
        time: evt.occurred_at ? new Date(evt.occurred_at).toLocaleTimeString() : undefined,
      };
      const role = classifyRoleForTool(evt);
      if (role === 'architect') p1Tools.push(item);
      else if (role === 'implementer') p2Tools.push(item);
      else if (role === 'tester') p3Tools.push(item);
      else if (role === 'auditor') p4Tools.push(item);
      else p2Tools.push(item);
    }
  });

  // Partition evidence
  const p3Evidence = allEvidence.filter(e => e.evidence_type === 'test_suite' || e.evidence_type === 'test_run' || e.evidence_type === 'vitest' || e.evidence_type === 'phpunit' || !e.evidence_type.includes('review'));
  const p4Evidence = allEvidence.filter(e => e.evidence_type === 'independent_review' || e.evidence_type === 'handoff_audit' || e.evidence_type.includes('review'));

  return [
    {
      id: 1,
      role: 'architect',
      title: '1. Architect / Planner',
      subtitle: 'Requirements survey, codebase analysis & structured plan generation',
      avatar: '📐',
      badge: 'PLANNER',
      badgeClass: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40',
      model: roleModels.architect || (defaultBaseModel.includes('pro') ? defaultBaseModel : 'gemini-3.7-pro'),
      status: p1Status,
      logs: p1Logs,
      toolCalls: p1Tools,
      evidence: [],
      artifacts: {
        plan: metadata.plan || metadata.discovery_plan || null,
      },
    },
    {
      id: 2,
      role: 'implementer',
      title: '2. Core Implementer',
      subtitle: 'Isolated Git worktree code generation, tool calls & file modification',
      avatar: '⚡',
      badge: 'DEVELOPER',
      badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
      model: roleModels.implementer || (defaultBaseModel.includes('flash') ? defaultBaseModel : 'gemini-3.7-flash'),
      status: p2Status,
      logs: p2Logs,
      toolCalls: p2Tools,
      evidence: [],
      artifacts: {
        changedFiles: handoffFiles.value,
        commitSha: run?.commit_sha || props.activeRun?.commit_sha || null,
        branch: run?.branch || null,
      },
    },
    {
      id: 3,
      role: 'tester',
      title: '3. Test Engineer',
      subtitle: 'Automated test suite execution, failure diagnosis & iterative verification',
      avatar: '🧪',
      badge: 'QA',
      badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
      model: roleModels.tester || (defaultBaseModel.includes('flash') ? defaultBaseModel : 'gemini-3.7-flash'),
      status: p3Status,
      logs: p3Logs,
      toolCalls: p3Tools,
      evidence: p3Evidence.length ? p3Evidence : allEvidence,
      artifacts: {
        testResults: {
          passed: allEvidence.filter(e => e.status === 'passed').length,
          failed: allEvidence.filter(e => e.status === 'failed').length,
          total: allEvidence.length,
          summary: allEvidence[0]?.summary || undefined,
          command: allEvidence[0]?.command || undefined,
        },
      },
    },
    {
      id: 4,
      role: 'auditor',
      title: '4. Evidence Auditor / Reviewer',
      subtitle: 'Verification evidence audit, git diff review & signed handoff packaging',
      avatar: '🔍',
      badge: 'REVIEWER',
      badgeClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40',
      model: roleModels.auditor || (defaultBaseModel.includes('pro') ? defaultBaseModel : 'gemini-3.7-pro'),
      status: p4Status,
      logs: p4Logs,
      toolCalls: p4Tools,
      evidence: p4Evidence,
      artifacts: {
        handoffSummary: metadata.handoff?.summary || run?.summary || null,
        autoReview: autoReview.value,
        prUrl: run?.pull_request_url || props.activeRun?.pull_request_url || null,
        commitSha: run?.commit_sha || props.activeRun?.commit_sha || null,
        epicChildren: epicChildren.value,
      },
    },
  ];
});

// Safety Interception Banner State
const safetyIntercept = computed(() => {
  const run = runDetails.value || props.activeRun;
  if (run?.status === 'waiting_input') {
    const safetyEvent = run.events?.find(e => ['safety_intercept', 'dangerous_command_blocked', 'human_approval_required', 'waiting_input'].includes(e.event_type));
    return {
      active: true,
      risk_level: safetyEvent?.payload?.risk_level || 'HIGH',
      reason: safetyEvent?.payload?.reason || run.failure_reason || 'Autonomous agent paused for developer authorization before running critical action.',
      command: safetyEvent?.payload?.command || safetyEvent?.payload?.action || null,
      context: safetyEvent?.payload,
    };
  }
  return null;
});

const loadRunDetails = async (runId: number) => {
  try {
    const res = await axios.get(`/api/tasks/agent-runs/${runId}`);
    if (res.data?.data) {
      runDetails.value = res.data.data;
      if (res.data.data.logs?.length) {
        logs.value = res.data.data.logs;
      }
      scrollToBottom();
    }
  } catch {}
};

const scrollToBottom = () => {
  if (!autoScroll.value) return;
  nextTick(() => {
    if (terminalContainer.value) {
      terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
    }
  });
};

const setupSse = (runId: number) => {
  if (sseSource) sseSource.close();
  try {
    sseSource = new EventSource(`/api/tasks/agent-runs/stream?run_id=${runId}`);
    
    sseSource.addEventListener('agent-run', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.run_id === runId) {
          void loadRunDetails(runId);
        }
      } catch {}
    });

    sseSource.addEventListener('agent-log', (e) => {
      try {
        const logData = JSON.parse((e as MessageEvent).data);
        if (logData.run_id === runId || !logData.run_id) {
          logs.value.push({
            id: logData.id,
            stream: logData.stream || 'stdout',
            content: logData.content,
            role: logData.role,
            occurred_at: logData.occurred_at || new Date().toISOString(),
          });
          scrollToBottom();
        }
      } catch {}
    });

    sseSource.addEventListener('agent-event', (e) => {
      try {
        const evtData = JSON.parse((e as MessageEvent).data);
        if (evtData.run_id === runId || !evtData.run_id) {
          void loadRunDetails(runId);
        }
      } catch {}
    });
  } catch {}
};

const approveSafetyOrHandoff = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run) return;

  isApproving.value = true;
  isActionFeedback.value = '';
  try {
    sound.playSuccess();
    if (run.status === 'waiting_input') {
      // Approve safety intercept to continue
      await axios.post(`/api/v1/agent-runs/${run.id}/events`, {
        event_id: crypto.randomUUID(),
        event_type: 'safety_approved',
        status: 'running',
        payload: { approved_at: new Date().toISOString() },
      });
      isActionFeedback.value = '✓ Action authorized. Agent is resuming execution...';
    } else {
      // Final task approval
      const res = await axios.post(`/api/tasks/work-items/${props.task.id}/approve`);
      if (res.data?.success) {
        isActionFeedback.value = isEpicAggregate.value
          ? '✓ Epic approved & all child tasks marked Done!'
          : '✓ Task approved & marked Done!';
        emit('approved', res.data.data);
      }
    }
    emit('refresh');
    if (run.id) void loadRunDetails(run.id);
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Approval failed.';
  } finally {
    isApproving.value = false;
  }
};

const rejectSafetyOrHandoff = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run) return;

  isRejecting.value = true;
  isActionFeedback.value = '';
  try {
    sound.playClick();
    const reason = window.prompt('Enter reason for rejection / feedback:', 'Safety command denied by reviewer.') || 'Rejected by reviewer.';
    const res = await axios.post(`/api/tasks/work-items/${props.task.id}/reject`, { reason });
    if (res.data?.success) {
      isActionFeedback.value = '✓ Task returned to changes requested.';
      emit('rejected', res.data.data);
      emit('refresh');
    }
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Rejection failed.';
  } finally {
    isRejecting.value = false;
  }
};

const pauseActiveRun = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run?.id) return;
  isPausing.value = true;
  try {
    await axios.post(`/api/v1/agent-runs/${run.id}/events`, {
      event_id: crypto.randomUUID(),
      event_type: 'paused',
      status: 'waiting_input',
      payload: { paused_at: new Date().toISOString(), reason: 'Paused by operator from Web Hub' },
    });
    isActionFeedback.value = '⏸ Execution paused by operator.';
    emit('refresh');
    void loadRunDetails(run.id);
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Failed to pause run.';
  } finally {
    isPausing.value = false;
  }
};

const resumeActiveRun = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run?.id) return;
  isResuming.value = true;
  try {
    await axios.post(`/api/v1/agent-runs/${run.id}/events`, {
      event_id: crypto.randomUUID(),
      event_type: 'resumed',
      status: 'running',
      payload: { resumed_at: new Date().toISOString() },
    });
    isActionFeedback.value = '▶ Execution resumed.';
    emit('refresh');
    void loadRunDetails(run.id);
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Failed to resume run.';
  } finally {
    isResuming.value = false;
  }
};

const cancelActiveRun = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run?.id) return;
  if (!window.confirm(`Are you sure you want to cancel Agent Run #${run.id}?`)) return;
  isCancelling.value = true;
  try {
    const res = await axios.post(`/api/tasks/agent-runs/${run.id}/cancel`);
    if (res.data?.success) {
      isActionFeedback.value = `✓ Run #${run.id} cancellation requested.`;
      emit('refresh');
      void loadRunDetails(run.id);
    }
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Failed to cancel run.';
  } finally {
    isCancelling.value = false;
  }
};

const copyAllLogs = async () => {
  const text = logs.value.map(l => `[${l.stream || 'stdout'}] ${l.content}`).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copiedLogs.value = true;
    sound.playClick();
    setTimeout(() => { copiedLogs.value = false; }, 2000);
  } catch {}
};

const copyPhaseLogs = async (phase: MultiAgentPhaseItem) => {
  const text = phase.logs.map(l => `[${l.stream || 'stdout'}] ${l.content}`).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copiedPhaseLogs.value[phase.role] = true;
    sound.playClick();
    setTimeout(() => { copiedPhaseLogs.value[phase.role] = false; }, 2000);
  } catch {}
};

watch(() => props.activeRun?.id, (newId) => {
  if (newId) {
    logs.value = props.activeRun?.logs || [];
    void loadRunDetails(newId);
    setupSse(newId);
  }
}, { immediate: true });

onMounted(() => {
  if (props.activeRun?.id) {
    void loadRunDetails(props.activeRun.id);
    setupSse(props.activeRun.id);
  }
  pollInterval = window.setInterval(() => {
    if (props.activeRun?.id && ['queued', 'claimed', 'preparing', 'running', 'waiting_input', 'testing'].includes(props.activeRun.status)) {
      void loadRunDetails(props.activeRun.id);
    }
  }, 5000);
});

onBeforeUnmount(() => {
  if (sseSource) sseSource.close();
  if (pollInterval) window.clearInterval(pollInterval);
});
</script>

<template>
  <div class="streamback-console space-y-4">
    <!-- Header: Active Run Info, Model & Execution Action Controls -->
    <div
      class="p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all"
      :class="isDarkMode ? 'bg-[#0a0f1d] border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
          <Icons name="Zap" :size="18" class="text-amber-300 animate-pulse" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="font-bold text-xs font-display truncate">
              Multi-Agent Autonomous Execution Stream
            </h4>
            <StatusBadge
              :status="activeRun?.status || 'idle'"
              variant="status"
              size="xs"
              :dark="isDarkMode"
            />
            <span
              class="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide border border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
            >
              4-Phase Pipeline
            </span>
          </div>
          <p class="font-mono text-[10px] text-slate-400 truncate mt-0.5">
            Run #{{ activeRun?.id }} · {{ activeRun?.provider?.toUpperCase() }} ({{ activeRun?.metadata?.model || 'gemini-3.7-flash' }})
            <span v-if="activeRun?.runner">· {{ activeRun.runner.name }}</span>
          </p>
        </div>
      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Pause Action -->
        <button
          v-if="['running', 'preparing', 'testing'].includes(activeRun?.status || '')"
          @click="pauseActiveRun"
          :disabled="isPausing"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          title="Pause active execution"
        >
          <Icons name="Pause" :size="11" />
          <span>{{ isPausing ? 'Pausing…' : 'Pause' }}</span>
        </button>

        <!-- Resume Action -->
        <button
          v-if="['waiting_input'].includes(activeRun?.status || '')"
          @click="resumeActiveRun"
          :disabled="isResuming"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          title="Resume execution"
        >
          <Icons name="Play" :size="11" />
          <span>{{ isResuming ? 'Resuming…' : 'Resume' }}</span>
        </button>

        <!-- Cancel Action -->
        <button
          v-if="['queued', 'claimed', 'preparing', 'running', 'waiting_input', 'testing'].includes(activeRun?.status || '')"
          @click="cancelActiveRun"
          :disabled="isCancelling"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          title="Cancel active agent execution"
        >
          <Icons name="X" :size="11" />
          <span>{{ isCancelling ? 'Stopping…' : 'Cancel' }}</span>
        </button>

        <!-- Sync Action -->
        <button
          @click="activeRun?.id && loadRunDetails(activeRun.id)"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5"
          :class="isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white' : 'border-slate-300 bg-white text-slate-700 hover:text-slate-950'"
          title="Refresh streamback logs and status"
        >
          <Icons name="Refresh" :size="12" />
          <span>Sync</span>
        </button>
      </div>
    </div>

    <!-- 1. SAFETY INTERCEPTION BANNER (waiting_input state) -->
    <div
      v-if="safetyIntercept"
      class="p-4 rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent space-y-3 animate-pulse shadow-lg"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <Icons name="Shield" :size="20" class="text-amber-400 shrink-0" />
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-xs text-amber-400 uppercase tracking-wider">
                Safety Guardrail Intercept (Action Required)
              </h4>
              <span class="px-2 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {{ safetyIntercept.risk_level }} RISK
              </span>
            </div>
            <p class="text-[11px] text-slate-200 mt-0.5 leading-relaxed">
              {{ safetyIntercept.reason }}
            </p>
          </div>
        </div>
      </div>

      <!-- Command Preview Block -->
      <pre
        v-if="safetyIntercept.command"
        class="p-2.5 rounded-xl bg-black text-amber-300 font-mono text-[10px] border border-amber-500/30 overflow-auto"
      >{{ safetyIntercept.command }}</pre>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 pt-1">
        <button
          @click="approveSafetyOrHandoff"
          :disabled="isApproving"
          class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Icons name="Check" :size="12" />
          <span>{{ isApproving ? 'Approving...' : 'Authorize & Continue Execution' }}</span>
        </button>

        <button
          @click="rejectSafetyOrHandoff"
          :disabled="isRejecting"
          class="px-4 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <Icons name="X" :size="12" />
          <span>{{ isRejecting ? 'Rejecting...' : 'Reject Action' }}</span>
        </button>
      </div>
    </div>

    <!-- 2. 4-PHASE MULTI-AGENT STEP STREAM (Step Cards & Scoped Accordions) -->
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs px-1">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold uppercase tracking-wider text-slate-400 text-[10px]">
            Multi-Agent Step Stream
          </span>
          <span class="font-mono text-[10px] text-slate-500">
            ({{ multiAgentPhases.filter(p => p.status === 'completed').length }}/4 Completed)
          </span>
        </div>
        <button
          @click="showGlobalConsole = !showGlobalConsole"
          class="text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
        >
          <Icons name="Terminal" :size="11" />
          <span>{{ showGlobalConsole ? 'Hide Raw Console' : 'View Raw Console' }}</span>
        </button>
      </div>

      <!-- Render each 4-Phase Step Card -->
      <div
        v-for="phase in multiAgentPhases"
        :key="phase.id"
        class="rounded-2xl border transition-all shadow-sm overflow-hidden"
        :class="[
          isDarkMode ? 'bg-[#090d19] border-slate-800/90' : 'bg-white border-slate-200',
          phase.status === 'running'
            ? (isDarkMode ? 'ring-1 ring-blue-500/50 border-blue-500/40' : 'ring-1 ring-blue-400 border-blue-300')
            : ''
        ]"
      >
        <!-- Phase Card Header -->
        <div
          @click="expandedPhases[phase.role] = !expandedPhases[phase.role]"
          class="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors"
          :class="isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'"
        >
          <div class="flex items-center gap-3 min-w-0">
            <!-- Avatar & Role Icon -->
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border"
              :class="[
                phase.status === 'completed'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : phase.status === 'running'
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 animate-pulse'
                  : phase.status === 'paused'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : phase.status === 'failed'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              ]"
            >
              <span>{{ phase.avatar }}</span>
            </div>

            <!-- Title & Subtitle -->
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-xs font-display text-slate-100 truncate">
                  {{ phase.title }}
                </h4>
                <span
                  class="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase border"
                  :class="phase.badgeClass"
                >
                  {{ phase.badge }}
                </span>
                <!-- Active Model Tag -->
                <span
                  class="px-2 py-0.2 rounded-full font-mono text-[9px] border"
                  :class="isDarkMode ? 'bg-slate-800/70 border-slate-700 text-cyan-300' : 'bg-slate-100 border-slate-200 text-cyan-700'"
                >
                  {{ phase.model }}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 truncate mt-0.5">
                {{ phase.subtitle }}
              </p>
            </div>
          </div>

          <!-- Status Indicator & Card Accordion Chevron -->
          <div class="flex items-center gap-2.5 shrink-0">
            <!-- Status Badge -->
            <div
              class="px-2 py-0.5 rounded-full font-mono text-[9.5px] font-bold flex items-center gap-1.5 border"
              :class="[
                phase.status === 'completed'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : phase.status === 'running'
                  ? 'bg-blue-950/60 border-blue-500/40 text-blue-300 animate-pulse'
                  : phase.status === 'paused'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : phase.status === 'failed'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              ]"
            >
              <Icons v-if="phase.status === 'completed'" name="Check" :size="10" />
              <Icons v-else-if="phase.status === 'running'" name="Loader" :size="10" class="animate-spin" />
              <Icons v-else-if="phase.status === 'paused'" name="AlertTriangle" :size="10" />
              <Icons v-else-if="phase.status === 'failed'" name="X" :size="10" />
              <span class="uppercase">{{ phase.status }}</span>
            </div>

            <!-- Accordion Chevron -->
            <Icons
              :name="expandedPhases[phase.role] ? 'ChevronUp' : 'ChevronDown'"
              :size="14"
              class="text-slate-400"
            />
          </div>
        </div>

        <!-- Expanded Phase Details -->
        <div
          v-if="expandedPhases[phase.role]"
          class="border-t p-4 space-y-3"
          :class="isDarkMode ? 'border-slate-800/80 bg-black/20' : 'border-slate-100 bg-slate-50/50'"
        >
          <!-- Artifacts / Summary Preview per Phase -->
          <!-- Phase 1 (Architect) Plan Artifact -->
          <div
            v-if="phase.role === 'architect' && (phase.artifacts.plan || phase.status === 'completed')"
            class="p-3 rounded-xl border space-y-2 text-xs"
            :class="isDarkMode ? 'bg-indigo-950/20 border-indigo-500/30 text-slate-200' : 'bg-indigo-50 border-indigo-200 text-indigo-950'"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-indigo-300 font-display flex items-center gap-1.5 text-[11px]">
                <Icons name="Layers" :size="12" />
                Structured Implementation Plan
              </span>
              <span class="font-mono text-[9px] text-indigo-300/80">Architect Spec</span>
            </div>
            <p v-if="phase.artifacts.plan?.summary" class="text-[11px] text-slate-300 leading-relaxed">
              {{ phase.artifacts.plan.summary }}
            </p>
            <div v-if="phase.artifacts.plan?.stories?.length" class="space-y-1 pt-1">
              <div
                v-for="(story, sIdx) in phase.artifacts.plan.stories"
                :key="sIdx"
                class="p-2 rounded-lg bg-black/30 border border-indigo-500/20 text-[10px] font-mono flex items-center justify-between"
              >
                <span class="text-indigo-200 truncate">{{ story.title }}</span>
                <span class="text-indigo-400 shrink-0">{{ story.story_points }} SP</span>
              </div>
            </div>
          </div>

          <!-- Phase 2 (Implementer) Changed Files / Diff Artifact -->
          <div
            v-if="phase.role === 'implementer' && (phase.artifacts.changedFiles?.length || phase.artifacts.commitSha)"
            class="p-3 rounded-xl border space-y-2 text-xs"
            :class="isDarkMode ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200' : 'bg-emerald-50 border-emerald-200 text-emerald-950'"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-emerald-300 font-display flex items-center gap-1.5 text-[11px]">
                <Icons name="Diff" :size="12" />
                Worktree Implementation Artifacts
              </span>
              <span v-if="phase.artifacts.changedFiles?.length" class="font-mono text-[9px] text-emerald-400">
                {{ phase.artifacts.changedFiles.length }} file(s) modified
              </span>
            </div>
            <ul v-if="phase.artifacts.changedFiles?.length" class="space-y-1 font-mono text-[10px] text-emerald-200 max-h-32 overflow-auto">
              <li v-for="file in phase.artifacts.changedFiles" :key="file" class="flex items-center gap-1.5">
                <span class="text-emerald-400 font-bold">+</span>
                <span class="truncate">{{ file }}</span>
              </li>
            </ul>
            <div v-if="phase.artifacts.commitSha" class="pt-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
              <Icons name="GitBranch" :size="11" />
              <span>Commit:</span>
              <code class="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">{{ phase.artifacts.commitSha.slice(0, 7) }}</code>
            </div>
          </div>

          <!-- Phase 3 (Test Engineer) Verification Results Artifact -->
          <div
            v-if="phase.role === 'tester' && (phase.evidence.length || phase.artifacts.testResults?.total)"
            class="p-3 rounded-xl border space-y-2 text-xs"
            :class="isDarkMode ? 'bg-amber-950/20 border-amber-500/30 text-slate-200' : 'bg-amber-50 border-amber-200 text-amber-950'"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-amber-300 font-display flex items-center gap-1.5 text-[11px]">
                <Icons name="CheckCircle" :size="12" />
                Automated Verification Evidence
              </span>
              <span class="font-mono text-[9px] text-amber-400 font-bold">
                {{ phase.evidence.filter(e => e.status === 'passed').length }} Passed
              </span>
            </div>

            <!-- Evidence items -->
            <div v-if="phase.evidence.length" class="space-y-1.5">
              <div
                v-for="ev in phase.evidence"
                :key="ev.id"
                class="p-2 rounded-lg border text-[10px] font-mono flex items-start justify-between gap-2"
                :class="ev.status === 'passed' ? 'bg-black/30 border-emerald-500/30 text-emerald-300' : 'bg-black/30 border-rose-500/30 text-rose-300'"
              >
                <div class="min-w-0">
                  <span class="font-bold">{{ ev.evidence_type }}</span>
                  <p v-if="ev.summary" class="text-slate-300 text-[9.5px] mt-0.5">{{ ev.summary }}</p>
                  <p v-if="ev.command" class="text-slate-400 text-[9px]">Command: {{ ev.command }}</p>
                </div>
                <span class="uppercase text-[9px] font-bold shrink-0 px-1.5 py-0.2 rounded border" :class="ev.status === 'passed' ? 'border-emerald-500/50 bg-emerald-500/20' : 'border-rose-500/50 bg-rose-500/20'">
                  {{ ev.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Phase 4 (Evidence Auditor) Review & Signed Handoff Artifact -->
          <div
            v-if="phase.role === 'auditor' && (phase.artifacts.handoffSummary || phase.artifacts.autoReview || phase.artifacts.prUrl || isEpicAggregate)"
            class="p-3 rounded-xl border space-y-2 text-xs"
            :class="isDarkMode ? 'bg-cyan-950/20 border-cyan-500/30 text-slate-200' : 'bg-cyan-50 border-cyan-200 text-cyan-950'"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-cyan-300 font-display flex items-center gap-1.5 text-[11px]">
                <Icons name="Shield" :size="12" />
                Signed Handoff Payload & Review Loop
              </span>
              <span class="font-mono text-[9px] text-cyan-400 font-bold">Auditor Verified</span>
            </div>

            <!-- Auto Review Loop -->
            <div v-if="phase.artifacts.autoReview" class="rounded-lg border border-violet-700/60 bg-violet-950/20 p-2.5 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-bold text-violet-200">Independent review loop</span>
                <span class="rounded-full border border-violet-500/40 px-2 py-0.5 font-mono text-[9px] uppercase text-violet-300">{{ phase.artifacts.autoReview.status || 'recorded' }}</span>
              </div>
              <p class="mt-1 text-[10px] text-slate-300">Reviewer: {{ phase.artifacts.autoReview.reviewer_provider || 'second local agent' }} · {{ phase.artifacts.autoReview.iterations || 0 }} round(s)</p>
              <p v-if="phase.artifacts.autoReview.feedback" class="mt-1.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-slate-200">{{ phase.artifacts.autoReview.feedback }}</p>
              <p class="mt-1.5 text-[10px] text-violet-200/80">This is additional evidence. Final approval and merge remain a human action on Hub.</p>
            </div>

            <!-- Epic Children Results -->
            <div v-if="isEpicAggregate && epicChildren.length" class="rounded-lg border border-amber-700/60 bg-amber-950/20 p-2.5 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-amber-100">CAO Epic child results</span>
                <span class="font-mono text-[9px] text-amber-200">{{ epicChildren.length }} task(s)</span>
              </div>
              <div class="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                <div v-for="child in epicChildren" :key="child.taskId" class="flex min-w-0 items-center justify-between gap-2 rounded border border-amber-800/50 bg-black/20 px-2 py-1">
                  <span class="truncate font-mono text-[9px] text-amber-100" :title="child.title">{{ child.issueKey || child.taskId }}</span>
                  <span class="shrink-0 text-[9px] text-emerald-300">{{ child.testStatus || 'verified' }}</span>
                </div>
              </div>
            </div>

            <!-- PR & Commit Link -->
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <a
                v-if="phase.artifacts.prUrl"
                :href="phase.artifacts.prUrl"
                target="_blank"
                rel="noreferrer"
                class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition-all flex items-center gap-1 shadow-sm"
              >
                <Icons name="GitPullRequest" :size="11" />
                <span>View Pull Request</span>
              </a>
              <span v-if="phase.artifacts.commitSha" class="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                <Icons name="GitBranch" :size="11" />
                <span>Commit:</span>
                <code class="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">{{ phase.artifacts.commitSha.slice(0, 7) }}</code>
              </span>
            </div>
          </div>

          <!-- Scoped Collapsible Accordion: Terminal Logs for this Phase -->
          <div class="rounded-xl border overflow-hidden" :class="isDarkMode ? 'border-slate-800 bg-[#070b14]' : 'border-slate-200 bg-slate-900 text-white'">
            <div
              @click="expandedLogs[phase.role] = !expandedLogs[phase.role]"
              class="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer select-none"
            >
              <div class="flex items-center gap-2">
                <Icons name="Terminal" :size="12" class="text-cyan-400" />
                <span class="font-mono text-[10px] font-bold text-slate-200">{{ phase.badge }} Terminal Logs</span>
                <span class="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {{ phase.logs.length }} lines
                </span>
              </div>

              <div class="flex items-center gap-2" @click.stop>
                <button
                  v-if="phase.logs.length"
                  @click="copyPhaseLogs(phase)"
                  class="px-2 py-0.5 rounded text-[9px] font-mono border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1"
                >
                  <Icons :name="copiedPhaseLogs[phase.role] ? 'Check' : 'Copy'" :size="10" />
                  <span>{{ copiedPhaseLogs[phase.role] ? 'Copied' : 'Copy' }}</span>
                </button>
                <Icons
                  :name="expandedLogs[phase.role] ? 'ChevronUp' : 'ChevronDown'"
                  :size="12"
                  class="text-slate-400"
                />
              </div>
            </div>

            <div
              v-if="expandedLogs[phase.role]"
              class="p-3 font-mono text-[10.5px] leading-relaxed max-h-48 overflow-y-auto space-y-1 bg-black/80 select-all"
            >
              <div v-if="!phase.logs.length" class="text-slate-500 italic py-2 text-center text-[10px]">
                No logs recorded yet for {{ phase.title }}...
              </div>
              <div
                v-for="(log, lIdx) in phase.logs"
                :key="log.id || lIdx"
                class="flex items-start gap-2 break-all"
              >
                <span class="text-slate-600 select-none text-[9px] pt-0.5 shrink-0">{{ lIdx + 1 }}</span>
                <span
                  :class="[
                    log.stream === 'stderr'
                      ? 'text-rose-400 font-semibold'
                      : log.stream === 'system'
                      ? 'text-cyan-400 font-bold'
                      : 'text-emerald-300'
                  ]"
                >
                  {{ log.content }}
                </span>
              </div>
            </div>
          </div>

          <!-- Scoped Collapsible Accordion: Tool Calls for this Phase -->
          <div
            v-if="phase.toolCalls.length"
            class="rounded-xl border overflow-hidden"
            :class="isDarkMode ? 'border-slate-800 bg-[#070b14]' : 'border-slate-200 bg-slate-50'"
          >
            <div
              @click="expandedTools[phase.role] = !expandedTools[phase.role]"
              class="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer select-none"
            >
              <div class="flex items-center gap-2 font-mono text-[10px] text-slate-300 font-bold">
                <Icons name="Wrench" :size="12" class="text-emerald-400" />
                <span>{{ phase.badge }} Tool Executions ({{ phase.toolCalls.length }})</span>
              </div>
              <Icons
                :name="expandedTools[phase.role] ? 'ChevronUp' : 'ChevronDown'"
                :size="12"
                class="text-slate-400"
              />
            </div>

            <div v-if="expandedTools[phase.role]" class="p-2 space-y-1.5 bg-black/40">
              <div
                v-for="tc in phase.toolCalls"
                :key="tc.id"
                class="rounded-lg border overflow-hidden transition-all text-xs"
                :class="isDarkMode ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200 bg-white'"
              >
                <div
                  @click="activeToolAccordion = activeToolAccordion === tc.id ? null : tc.id"
                  class="p-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/40"
                >
                  <div class="flex items-center gap-2 min-w-0 font-mono text-[10.5px]">
                    <Icons name="Wrench" :size="11" class="text-emerald-400 shrink-0" />
                    <span class="font-bold truncate text-slate-200">{{ tc.tool }}</span>
                    <span v-if="tc.durationMs" class="text-slate-500 text-[9px]">({{ tc.durationMs }}ms)</span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class="px-1.5 py-0.2 rounded font-mono text-[8.5px] font-bold uppercase border"
                      :class="tc.status === 'failed' ? 'bg-rose-950 text-rose-400 border-rose-800' : 'bg-emerald-950 text-emerald-400 border-emerald-800'"
                    >
                      {{ tc.status }}
                    </span>
                    <Icons :name="activeToolAccordion === tc.id ? 'ChevronUp' : 'ChevronDown'" :size="11" class="text-slate-400" />
                  </div>
                </div>

                <!-- Expanded Tool Details -->
                <div
                  v-if="activeToolAccordion === tc.id"
                  class="p-2.5 border-t font-mono text-[9.5px] space-y-1.5"
                  :class="isDarkMode ? 'border-slate-800 bg-black/70 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-800'"
                >
                  <div v-if="tc.params">
                    <span class="text-slate-500 block mb-0.5 font-bold text-[8.5px]">INPUT PARAMETERS:</span>
                    <pre class="overflow-x-auto p-1.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">{{ typeof tc.params === 'string' ? tc.params : JSON.stringify(tc.params, null, 2) }}</pre>
                  </div>
                  <div v-if="tc.output">
                    <span class="text-slate-500 block mb-0.5 font-bold text-[8.5px]">RESULT / OUTPUT:</span>
                    <pre class="overflow-x-auto p-1.5 rounded bg-slate-950 text-emerald-300 border border-slate-800 max-h-28">{{ typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. OPTIONAL UNIFIED RAW TERMINAL LOG STREAM CONSOLE -->
    <div
      v-if="showGlobalConsole"
      class="rounded-2xl border overflow-hidden shadow-2xl flex flex-col transition-all"
      :class="isDarkMode ? 'bg-[#070b14] border-slate-800' : 'bg-slate-950 border-slate-800 text-white'"
    >
      <!-- Terminal Header Bar -->
      <div class="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <!-- Window Dots -->
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span class="font-mono text-[11px] text-slate-300 font-bold ml-1">Live Streamback Console</span>
          <span class="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {{ logs.length }} lines
          </span>
        </div>

        <!-- Terminal Controls -->
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 font-mono text-[10px] text-slate-400 cursor-pointer select-none">
            <input type="checkbox" v-model="autoScroll" class="rounded text-emerald-500 focus:ring-0" />
            <span>Auto-Scroll</span>
          </label>
          <button
            @click="copyAllLogs"
            class="px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1"
          >
            <Icons :name="copiedLogs ? 'Check' : 'Copy'" :size="11" />
            <span>{{ copiedLogs ? 'Copied' : 'Copy' }}</span>
          </button>
          <button
            @click="logs = []"
            class="px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Terminal Log Container -->
      <div
        ref="terminalContainer"
        class="p-4 font-mono text-[11px] leading-relaxed max-h-72 sm:max-h-96 overflow-y-auto space-y-1 select-all bg-black/90"
      >
        <div v-if="!logs.length" class="text-slate-500 italic py-4 text-center">
          Waiting for live output from desktop agent runner...
        </div>

        <div
          v-for="(log, idx) in logs"
          :key="log.id || idx"
          class="flex items-start gap-2 break-all"
        >
          <span class="text-slate-600 select-none text-[9px] pt-0.5 shrink-0">{{ idx + 1 }}</span>
          <span
            :class="[
              log.stream === 'stderr'
                ? 'text-rose-400 font-semibold'
                : log.stream === 'system'
                ? 'text-cyan-400 font-bold'
                : 'text-emerald-300'
            ]"
          >
            {{ log.content }}
          </span>
        </div>
      </div>
    </div>

    <!-- 4. FINAL APPROVAL ACTIONS & REVIEW GATE -->
    <div
      v-if="activeRun?.status === 'needs_review' || activeRun?.status === 'verified'"
      class="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex flex-wrap items-center justify-between gap-3 shadow-md"
    >
      <div>
        <h4 class="font-bold text-xs text-emerald-400">
          Automated Handoff Ready for Final Review
        </h4>
        <p class="text-[11px] text-slate-300">
          <template v-if="isEpicAggregate">All CAO child tasks have passed. Click below to approve the Epic and mark every child Done.</template>
          <template v-else>All test evidence has passed. Click below to approve and mark this task as Done.</template>
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <button
          @click="rejectSafetyOrHandoff"
          :disabled="isRejecting"
          class="px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 font-bold text-xs transition-all hover:bg-amber-500/20 disabled:opacity-60 cursor-pointer"
        >{{ isRejecting ? 'Sending…' : 'Request changes' }}</button>
        <button
          @click="approveSafetyOrHandoff"
          :disabled="isApproving"
          class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95 shrink-0"
        >
          <Icons name="Check" :size="13" />
          <span>{{ isApproving ? 'Approving...' : isEpicAggregate ? 'Approve Epic & Mark All Done' : 'Approve & Mark Done' }}</span>
        </button>
      </div>
    </div>

    <!-- Feedback Message -->
    <p v-if="isActionFeedback" class="text-xs text-emerald-400 font-medium px-1">
      {{ isActionFeedback }}
    </p>
  </div>
</template>

<style scoped>
.streamback-console {
  contain: layout style;
}
</style>
