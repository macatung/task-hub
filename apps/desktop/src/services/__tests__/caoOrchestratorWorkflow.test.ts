import { describe, expect, it } from 'vitest';
import {
  buildCaoTaskOrchestrationPrompt,
  buildCaoEpicOrchestrationPrompt,
  caoBridge,
} from '../caoBridgeService';

describe('CAO Multi-Agent Orchestration Workflow & Protocols', () => {
  it('builds structured CAO task orchestration prompt with supervisor directives and handoff marker', () => {
    const prompt = buildCaoTaskOrchestrationPrompt({
      task: {
        id: 101,
        issue_key: 'TASK-101',
        title: 'Implement OAuth2 login route',
        description: 'Add OAuth2 login endpoint with JWT generation and unit tests.',
      },
      context: {
        repository: 'macatung/task-hub',
        branch: 'feature/oauth2',
      },
      policy: 'workspace_write',
    });

    expect(prompt).toContain('# CAO Multi-Agent Task Orchestration: TASK-101 (Implement OAuth2 login route)');
    expect(prompt).toContain('`assign(task, role)` (Async / Free)');
    expect(prompt).toContain('`handoff(task, role)` (Sync / Blocked)');
    expect(prompt).toContain('`send_message(recipient, message)` (Direct)');
    expect(prompt).toContain('<TASK_HUB_HANDOFF>');
    expect(prompt).toContain('macatung/task-hub');
  });

  it('includes Epic boundaries when running a child task within an Epic sequence', () => {
    const prompt = buildCaoTaskOrchestrationPrompt({
      task: {
        id: 102,
        issue_key: 'TASK-102',
        title: 'Create User Profile UI component',
      },
      epic: {
        id: 50,
        issue_key: 'EPIC-50',
        title: 'Authentication & User Management',
      },
    });

    expect(prompt).toContain('This task is part of Epic EPIC-50');
    expect(prompt).toContain('Focus strictly on this task; do not modify sibling tasks.');
  });

  it('builds comprehensive CAO Epic orchestration prompt with child task DAG and parallel worker directives', () => {
    const prompt = buildCaoEpicOrchestrationPrompt({
      epic: {
        id: 50,
        issue_key: 'EPIC-50',
        title: 'Authentication & User Management',
        description: 'Complete user authentication, password recovery, and profile management suite.',
      },
      childTasks: [
        {
          id: 101,
          issue_key: 'TASK-101',
          title: 'Implement auth database migration',
          status: 'done',
        },
        {
          id: 102,
          issue_key: 'TASK-102',
          title: 'Build auth API endpoints',
          status: 'todo',
          dependencies: [{ depends_on_task_id: 101, depends_on: { issue_key: 'TASK-101', status: 'done' } }],
        },
        {
          id: 103,
          issue_key: 'TASK-103',
          title: 'Build login and signup web screens',
          status: 'todo',
          dependencies: [{ depends_on_task_id: 102, depends_on: { issue_key: 'TASK-102', status: 'todo' } }],
        },
      ],
      context: {
        epic_id: 50,
        project: 'Task Hub',
      },
    });

    expect(prompt).toContain('# CAO Multi-Agent Epic Orchestration: EPIC-50: Authentication & User Management');
    expect(prompt).toContain('## Epic Objectives:');
    expect(prompt).toContain('Complete user authentication, password recovery, and profile management suite.');
    expect(prompt).toContain('## Child Tasks Breakdown & DAG:');
    expect(prompt).toContain('[TASK-101] Implement auth database migration (Status: done)');
    expect(prompt).toContain('[TASK-102] Build auth API endpoints (Status: todo, Depends on: TASK-101)');
    expect(prompt).toContain('assign(task, ...)');
    expect(prompt).toContain('handoff(task, ...)');
    expect(prompt).toContain('send_message');
    expect(prompt).toContain('$CAO_TERMINAL_ID');
    expect(prompt).toContain('<TASK_HUB_HANDOFF>');
  });

  it('normalizes CAO multi-agent events with roles and token usage metrics', () => {
    const rawEvent = {
      event: 'tool_call',
      role: 'supervisor',
      provider: 'cao',
      text: 'Calling assign() to launch worker-1 in isolated tmux window.',
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 350,
        total_tokens: 1550,
      },
    };

    const normalized = caoBridge.normalizeStreamEvent(rawEvent, 'cao-session-123');

    expect(normalized.type).toBe('tool_call');
    expect(normalized.agentRole).toBe('supervisor');
    expect(normalized.provider).toBe('cao');
    expect(normalized.content).toBe('Calling assign() to launch worker-1 in isolated tmux window.');
    expect(normalized.tokenUsage).toEqual({
      promptTokens: 1200,
      completionTokens: 350,
      totalTokens: 1550,
    });
  });
});
