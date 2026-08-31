export type ExecutionStreamMode = 'workflow' | 'supervisor' | 'auto_pilot';

export type ExecutionStreamEventType =
  | 'run.started' | 'run.completed' | 'run.failed'
  | 'step.started' | 'step.completed' | 'step.failed'
  | 'worker.started' | 'worker.completed'
  | 'tool.started' | 'tool.completed'
  | 'thought' | 'output' | 'evidence' | 'handoff' | 'error' | 'system';

export interface ExecutionStreamActor {
  id?: string;
  role?: string;
  provider?: string;
  model?: string;
  sessionId?: string;
}

export interface ExecutionStreamEvent {
  id: string;
  runId: number | string;
  mode: ExecutionStreamMode;
  type: ExecutionStreamEventType;
  occurredAt: string;
  sequence?: number;
  stepId?: string;
  taskId?: number;
  taskKey?: string;
  actor?: ExecutionStreamActor;
  status?: string;
  summary: string;
  detail?: string;
  payload?: Record<string, unknown>;
  source: 'cao' | 'hub' | 'agent' | 'terminal';
}

export interface GroupedExecutionStreamEvent {
  groupKey: string;
  event: ExecutionStreamEvent;
  type: ExecutionStreamEventType;
  stepId?: string;
  taskId?: number;
  taskKey?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
  repeatCount: number;
  isGrouped: boolean;
  events: ExecutionStreamEvent[];
  lifecycleState?: 'started' | 'running' | 'completed' | 'failed' | 'other';
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? value as Record<string, any> : {};

const eventType = (raw: string, source: ExecutionStreamEvent['source']): ExecutionStreamEventType => {
  const value = raw.toLowerCase().replace(/^workflow\./, '');
  if (value === 'run.started') return 'run.started';
  if (value === 'run.completed') return 'run.completed';
  if (value === 'run.failed') return 'run.failed';
  if (value === 'started') return 'run.started';
  if (value === 'completed') return 'run.completed';
  if (value === 'failed' || value === 'error') return 'run.failed';
  if (value === 'waiting_input' || value === 'interrupted' || value === 'cancelled') return 'system';
  if (value.includes('step.started')) return 'step.started';
  if (value.includes('step.completed')) return 'step.completed';
  if (value.includes('step.failed')) return 'step.failed';
  if (value.includes('worker.started')) return 'worker.started';
  if (value.includes('worker.completed')) return 'worker.completed';
  if (value.includes('tool.started') || value.includes('tool_call')) return 'tool.started';
  if (value.includes('tool.completed')) return 'tool.completed';
  if (value.includes('evidence')) return 'evidence';
  if (value.includes('handoff')) return 'handoff';
  if (value.includes('thought') || value.includes('reasoning')) return 'thought';
  if (value.includes('output') || value.includes('message') || source === 'agent') return 'output';
  if (value.includes('error') || value.includes('failure')) return 'error';
  if (value.includes('step')) return 'system';
  return 'system';
};

const summaryFor = (type: ExecutionStreamEventType, raw: Record<string, any>, fallback: string): string => {
  const explicit = raw.summary || raw.message || raw.text || raw.content || raw.detail;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().slice(0, 500);
  const labels: Record<string, string> = {
    'run.started': 'Execution started', 'run.completed': 'Execution completed', 'run.failed': 'Execution failed',
    'step.started': 'Step started', 'step.completed': 'Step completed', 'step.failed': 'Step failed',
    'worker.started': 'Worker started', 'worker.completed': 'Worker completed',
    'tool.started': 'Tool started', 'tool.completed': 'Tool completed',
    thought: 'Agent reasoning', output: 'Agent output', evidence: 'Evidence produced', handoff: 'Handoff prepared',
    error: 'Execution error', system: fallback || 'Execution update',
  };
  return labels[type] || fallback || 'Execution update';
};

export function normalizeExecutionEvent(rawEvent: unknown, options: {
  runId: number | string;
  mode: ExecutionStreamMode;
  source: ExecutionStreamEvent['source'];
  sequence?: number;
  defaultActor?: ExecutionStreamActor;
}): ExecutionStreamEvent {
  const raw = asRecord(rawEvent);
  const rawType = String(raw.type || raw.event_type || raw.event || 'system');
  const type = eventType(rawType, options.source);
  const payload = asRecord(raw.payload || raw.output || raw.data);
  const actor = {
    ...options.defaultActor,
    ...asRecord(raw.actor),
    ...(raw.role ? { role: raw.role } : {}),
    ...(raw.provider ? { provider: raw.provider } : {}),
    ...(raw.model ? { model: raw.model } : {}),
    ...(raw.sessionId || raw.session_id ? { sessionId: raw.sessionId || raw.session_id } : {}),
  };
  const occurredAt = String(raw.occurred_at || raw.timestamp || raw.created_at || new Date().toISOString());
  const stepId = raw.stepId || raw.step_id || raw.stage || payload.step_id || payload.stage;
  const taskId = Number(raw.taskId || raw.task_id || payload.task_id) || undefined;
  const taskKey = raw.taskKey || raw.task_key || payload.task_key;
  const detail = typeof raw.detail === 'string' ? raw.detail : typeof raw.error === 'string' ? raw.error : undefined;

  const isLifecycleBoundary =
    type.startsWith('step.') ||
    type.startsWith('run.') ||
    type.startsWith('worker.');
  const fallbackId = isLifecycleBoundary
    ? `${options.source}:${options.runId}:${type}:${stepId || ''}:${options.sequence ?? ''}`
    : `${options.source}:${options.runId}:${type}:${stepId || ''}:${occurredAt}:${options.sequence ?? ''}`;
  const id = String(raw.id || raw.event_id || fallbackId);

  return {
    id, runId: options.runId, mode: options.mode, type, occurredAt,
    sequence: options.sequence ?? (Number(raw.sequence) || undefined),
    stepId: stepId ? String(stepId) : undefined, taskId,
    taskKey: taskKey ? String(taskKey) : undefined,
    actor: Object.keys(actor).length ? actor : undefined,
    status: raw.status || payload.status,
    summary: summaryFor(type, raw, rawType), detail,
    payload: Object.keys(payload).length ? payload : raw, source: options.source,
  };
}

export function mergeExecutionEvents(existing: ExecutionStreamEvent[], incoming: ExecutionStreamEvent[]): ExecutionStreamEvent[] {
  const byId = new Map<string, ExecutionStreamEvent>();
  [...existing, ...incoming].forEach((event) => {
    if (!event?.id) return;
    const previous = byId.get(event.id);
    if (!previous) {
      byId.set(event.id, event);
      return;
    }
    const prevTime = Date.parse(previous.occurredAt);
    const incomingTime = Date.parse(event.occurredAt);
    const earliestTime = (Number.isFinite(prevTime) && Number.isFinite(incomingTime))
      ? (prevTime <= incomingTime ? previous.occurredAt : event.occurredAt)
      : (previous.occurredAt || event.occurredAt);

    byId.set(event.id, {
      ...previous,
      ...event,
      occurredAt: earliestTime,
      status: event.status || previous.status,
      detail: event.detail || previous.detail,
      payload: event.payload || previous.payload,
    });
  });
  return [...byId.values()].sort((a, b) => {
    const time = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    if (Number.isFinite(time) && time !== 0) return time;
    return (a.sequence ?? 0) - (b.sequence ?? 0) || a.id.localeCompare(b.id);
  });
}

export function groupExecutionStreamEvents(
  events: ExecutionStreamEvent[],
  options: { collapseDuplicates?: boolean; groupSteps?: boolean } = { collapseDuplicates: true, groupSteps: true }
): GroupedExecutionStreamEvent[] {
  const collapse = options.collapseDuplicates !== false;
  const groupSteps = options.groupSteps !== false;

  if (!collapse && !groupSteps) {
    return events.map((event) => ({
      groupKey: event.id,
      event,
      type: event.type,
      stepId: event.stepId,
      taskId: event.taskId,
      taskKey: event.taskKey,
      startedAt: event.occurredAt,
      updatedAt: event.occurredAt,
      repeatCount: 1,
      isGrouped: false,
      events: [event],
      lifecycleState: event.type.endsWith('.completed') ? 'completed'
        : event.type.endsWith('.failed') || event.type === 'error' ? 'failed'
        : event.type.endsWith('.started') ? 'started' : 'other',
    }));
  }

  const groups: GroupedExecutionStreamEvent[] = [];

  for (const event of events) {
    const lastGroup = groups[groups.length - 1];
    const isStepEvent = event.type.startsWith('step.');
    const isSameStep = Boolean(
      groupSteps &&
      isStepEvent &&
      lastGroup &&
      lastGroup.stepId &&
      event.stepId &&
      lastGroup.stepId === event.stepId
    );

    const isIdenticalDuplicate = Boolean(
      collapse &&
      lastGroup &&
      lastGroup.type === event.type &&
      (lastGroup.stepId || '') === (event.stepId || '') &&
      lastGroup.event.summary === event.summary &&
      (lastGroup.event.actor?.id || '') === (event.actor?.id || '')
    );

    if (isSameStep || isIdenticalDuplicate) {
      lastGroup.events.push(event);
      lastGroup.repeatCount += 1;
      lastGroup.isGrouped = true;
      lastGroup.updatedAt = event.occurredAt;

      const startTime = Date.parse(lastGroup.startedAt);
      const updateTime = Date.parse(event.occurredAt);
      if (Number.isFinite(startTime) && Number.isFinite(updateTime) && updateTime >= startTime) {
        lastGroup.durationMs = updateTime - startTime;
      }

      // Upgrade group representative if event is a completion or failure state
      if (event.type === 'step.completed' || event.type === 'run.completed') {
        lastGroup.event = { ...event, occurredAt: lastGroup.startedAt };
        lastGroup.type = event.type;
        lastGroup.completedAt = event.occurredAt;
        lastGroup.lifecycleState = 'completed';
      } else if (event.type === 'step.failed' || event.type === 'run.failed' || event.type === 'error') {
        lastGroup.event = { ...event, occurredAt: lastGroup.startedAt };
        lastGroup.type = event.type;
        lastGroup.completedAt = event.occurredAt;
        lastGroup.lifecycleState = 'failed';
      } else if (event.detail && !lastGroup.event.detail) {
        lastGroup.event.detail = event.detail;
      }
    } else {
      const state: GroupedExecutionStreamEvent['lifecycleState'] =
        event.type.endsWith('.completed') ? 'completed'
          : event.type.endsWith('.failed') || event.type === 'error' ? 'failed'
          : event.type.endsWith('.started') ? 'started' : 'other';

      groups.push({
        groupKey: `group:${event.id}:${groups.length}`,
        event,
        type: event.type,
        stepId: event.stepId,
        taskId: event.taskId,
        taskKey: event.taskKey,
        startedAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: event.type.endsWith('.completed') || event.type.endsWith('.failed') ? event.occurredAt : undefined,
        repeatCount: 1,
        isGrouped: false,
        events: [event],
        lifecycleState: state,
      });
    }
  }

  return groups;
}

export function eventMatchesFilter(event: ExecutionStreamEvent, filter: 'all' | 'steps' | 'tools' | 'output' | 'evidence' | 'errors') {
  if (filter === 'all') return true;
  if (filter === 'steps') return event.type.startsWith('step.') || event.type.startsWith('run.');
  if (filter === 'tools') return event.type.startsWith('tool.');
  if (filter === 'output') return event.type === 'output' || event.type === 'thought';
  if (filter === 'evidence') return event.type === 'evidence' || event.type === 'handoff';
  return event.type === 'error' || event.type === 'step.failed' || event.status === 'failed';
}

export function normalizeWorkflowEvent(event: any, runId: string | number, mode: ExecutionStreamMode = 'workflow') {
  return normalizeExecutionEvent(event, { runId, mode, source: 'cao' });
}

export function normalizeHubRunEvent(event: any, runId: string | number, mode: ExecutionStreamMode = 'workflow') {
  const persisted = asRecord(event?.payload?.normalized);
  return normalizeExecutionEvent({ ...event, ...persisted, id: event?.id || event?.event_id, payload: persisted.payload || event?.payload }, { runId, mode, source: 'hub', sequence: Number(event?.id) || undefined });
}

export function normalizeAgentOutput(event: any, runId: string | number, mode: ExecutionStreamMode) {
  return normalizeExecutionEvent({ ...event, type: event?.event?.type || 'output', text: event?.text }, {
    runId, mode, source: 'agent', defaultActor: { sessionId: event?.sessionId, role: event?.agentRole, provider: event?.provider },
  });
}
