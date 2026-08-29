import { describe, expect, it } from 'vitest';
import {
  resolveCaoProviderModel,
  getCaoProviderCapabilities,
  buildCaoTaskOrchestrationPrompt,
  buildCaoEpicOrchestrationPrompt,
} from '../caoBridgeService';

describe('CAO Provider Adaptation for Antigravity & Codex', () => {
  describe('Model Resolution & Default Fallbacks', () => {
    it('resolves Antigravity models correctly with Gemini default', () => {
      expect(resolveCaoProviderModel('antigravity')).toBe('gemini-3.7-flash');
      expect(resolveCaoProviderModel('antigravity', 'default')).toBe('gemini-3.7-flash');
      expect(resolveCaoProviderModel('antigravity', 'gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(resolveCaoProviderModel('antigravity', 'gemini-3.7-pro')).toBe('gemini-3.7-pro');
    });

    it('resolves Codex models correctly with GPT-5 default', () => {
      expect(resolveCaoProviderModel('codex')).toBe('gpt-5');
      expect(resolveCaoProviderModel('codex', 'default')).toBe('gpt-5');
      expect(resolveCaoProviderModel('codex', 'o3-mini')).toBe('o3-mini');
      expect(resolveCaoProviderModel('codex', 'gpt-4.5-preview')).toBe('gpt-4.5-preview');
    });
  });

  describe('Provider Capabilities & Multi-Agent Primitives', () => {
    it('provides multi-agent and supervisor capabilities for Antigravity', () => {
      const caps = getCaoProviderCapabilities('antigravity');
      expect(caps).toContain('cao_supervisor');
      expect(caps).toContain('assign');
      expect(caps).toContain('handoff');
      expect(caps).toContain('gemini_multimodal');
    });

    it('provides multi-agent and sandbox capabilities for Codex', () => {
      const caps = getCaoProviderCapabilities('codex');
      expect(caps).toContain('cao_supervisor');
      expect(caps).toContain('assign');
      expect(caps).toContain('handoff');
      expect(caps).toContain('sandbox_isolation');
    });
  });

  describe('Prompt Construction for Antigravity & Codex Orchestration', () => {
    it('formats Antigravity supervisor prompt for Epic orchestration', () => {
      const prompt = buildCaoEpicOrchestrationPrompt({
        epic: {
          id: 42,
          issueKey: 'EPIC-42',
          title: 'Implement Multi-Provider Agent Architecture',
          description: 'Support Antigravity and Codex as flexible orchestrators and workers in CAO.',
        },
        childTasks: [
          {
            id: 101,
            issueKey: 'TASK-101',
            title: 'Adapt Antigravity CLI in CAO',
            status: 'todo',
          },
          {
            id: 102,
            issueKey: 'TASK-102',
            title: 'Adapt Codex CLI in CAO',
            status: 'todo',
          },
        ],
        context: {
          provider: 'antigravity',
          model: 'gemini-3.7-pro',
        },
      });

      expect(prompt).toContain('# CAO Multi-Agent Epic Orchestration: EPIC-42: Implement Multi-Provider Agent Architecture');
      expect(prompt).toContain('TASK-101');
      expect(prompt).toContain('TASK-102');
      expect(prompt).toContain('assign(task, ...)');
      expect(prompt).toContain('handoff(task, ...)');
      expect(prompt).toContain('send_message');
    });

    it('formats Codex supervisor prompt for single task orchestration', () => {
      const prompt = buildCaoTaskOrchestrationPrompt({
        task: {
          id: 105,
          issueKey: 'TASK-105',
          title: 'Verify Codex Sandbox Isolation in WSL ext4',
        },
        context: {
          provider: 'codex',
          model: 'gpt-5',
        },
        policy: 'workspace_write',
      });

      expect(prompt).toContain('# CAO Multi-Agent Task Orchestration: TASK-105');
      expect(prompt).toContain('You are operating as the CAO Conductor/Supervisor agent');
      expect(prompt).toContain('<TASK_HUB_HANDOFF>');
    });
  });
});
