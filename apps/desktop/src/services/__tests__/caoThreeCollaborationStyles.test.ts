import { describe, expect, it } from 'vitest';
import {
  buildCaoTaskOrchestrationPrompt,
  buildCaoEpicOrchestrationPrompt,
  caoBridge,
  CAO_THREE_STYLES_GUIDELINES,
} from '../caoBridgeService';

describe('CAO Three Tools, Three Styles & Rule of Thumb', () => {
  describe('Rule of Thumb Specification & Guidelines', () => {
    it('defines the three collaboration styles and rule of thumb in CAO guidelines', () => {
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('handoff(task, role)');
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('assign(task, role)');
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('send_message(recipient, message)');
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('Need the result now? Use `handoff`.');
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('Work is independent? Use `assign`.');
      expect(CAO_THREE_STYLES_GUIDELINES).toContain('Target already running? Use `send_message`.');
    });

    it('embeds the 3 collaboration styles in task orchestration prompt', () => {
      const prompt = buildCaoTaskOrchestrationPrompt({
        task: {
          id: 201,
          issueKey: 'TASK-201',
          title: 'Add JWT Auth middleware',
        },
      });

      expect(prompt).toContain('Three Tools, Three Styles');
      expect(prompt).toContain('`assign()` to dispatch workers in parallel');
      expect(prompt).toContain('`handoff()` to block until the review completes');
      expect(prompt).toContain('`send_message()`');
      expect(prompt).toContain('Need the result now? Use `handoff`.');
    });

    it('embeds the 3 collaboration styles in epic orchestration prompt', () => {
      const prompt = buildCaoEpicOrchestrationPrompt({
        epic: {
          id: 55,
          issueKey: 'EPIC-55',
          title: 'Microservices Architecture Migration',
          description: 'Build 5 independent services simultaneously.',
        },
        childTasks: [
          { id: 1, issueKey: 'AUTH-1', title: 'Auth service', status: 'todo' },
          { id: 2, issueKey: 'PAY-1', title: 'Payment service', status: 'todo' },
          { id: 3, issueKey: 'NOTIF-1', title: 'Notification service', status: 'todo' },
        ],
      });

      expect(prompt).toContain('Three Tools, Three Styles');
      expect(prompt).toContain('Dispatch all independent/unblocked child tasks in parallel using `assign(task, ...)`');
      expect(prompt).toContain('Dispatch sequential/dependent child tasks using `handoff(task, ...)`');
      expect(prompt).toContain('report completion and evidence back to supervisor via `send_message()`');
      expect(prompt).toContain('code review / quality audit using `handoff()`');
    });
  });

  describe('Scenario-Based Decision Validation', () => {
    it('Scenario 1: Code review before merge requires synchronous handoff (blocked)', () => {
      const isCodeReview = true;
      const requiresImmediateResult = isCodeReview;
      const recommendedTool = requiresImmediateResult ? 'handoff' : 'assign';

      expect(recommendedTool).toBe('handoff');
    });

    it('Scenario 2: Independent microservices / child tasks require asynchronous assign (parallel)', () => {
      const tasks = ['Service A', 'Service B', 'Service C'];
      const areIndependent = true;
      const recommendedTool = areIndependent ? 'assign' : 'handoff';

      expect(recommendedTool).toBe('assign');
    });

    it('Scenario 3: Finished worker reporting to supervisor requires direct send_message', () => {
      const targetIsRunningConductor = true;
      const recommendedTool = targetIsRunningConductor ? 'send_message' : 'handoff';

      expect(recommendedTool).toBe('send_message');
    });
  });

  describe('Stream Event Normalization with Collaboration Styles', () => {
    it('detects sync_handoff tool calls in stream events', () => {
      const rawEvent = {
        event: 'tool_call',
        role: 'supervisor',
        content: 'handoff(reviewer, "Review code diff before merge")',
      };
      const normalized = caoBridge.normalizeStreamEvent(rawEvent, 'cao-sess-1');
      expect(normalized.collaborationStyle).toBe('sync_handoff');
    });

    it('detects async_assign tool calls in stream events', () => {
      const rawEvent = {
        event: 'tool_call',
        role: 'supervisor',
        content: 'assign(worker-1, "Build Payment microservice")',
      };
      const normalized = caoBridge.normalizeStreamEvent(rawEvent, 'cao-sess-2');
      expect(normalized.collaborationStyle).toBe('async_assign');
    });

    it('detects direct_message calls in stream events', () => {
      const rawEvent = {
        event: 'tool_call',
        role: 'worker',
        content: 'send_message($CAO_TERMINAL_ID, "Task completed with all unit tests passing.")',
      };
      const normalized = caoBridge.normalizeStreamEvent(rawEvent, 'cao-sess-3');
      expect(normalized.collaborationStyle).toBe('direct_message');
    });
  });
});
