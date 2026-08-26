import { describe, expect, it, vi } from 'vitest';
import { CaoBridgeService } from './caoBridgeService.js';

describe('CaoBridgeService (CLI Agent Orchestrator Bridge)', () => {
  it('initializes with default endpoint and handles endpoint updates', () => {
    const defaultBridge = new CaoBridgeService();
    expect(defaultBridge.getEndpoint()).toBe('http://127.0.0.1:9889');
    const customBridge = new CaoBridgeService('http://127.0.0.1:9889/');
    expect(customBridge.getEndpoint()).toBe('http://127.0.0.1:9889');
    customBridge.setEndpoint('http://localhost:9000/');
    expect(customBridge.getEndpoint()).toBe('http://localhost:9000');
  });

  it('normalizes text stream events', () => {
    const bridge = new CaoBridgeService();
    const event = bridge.normalizeStreamEvent('Agent output text', 'session-123');
    expect(event.type).toBe('text');
    expect(event.sessionId).toBe('session-123');
    expect(event.content).toBe('Agent output text');
    expect(event.provider).toBe('cao');
  });

  it('normalizes structured CAO / agent JSON stream events with token metrics', () => {
    const bridge = new CaoBridgeService();
    const raw = {
      event: 'tool_call',
      role: 'worker',
      provider: 'antigravity',
      text: 'Reading file schema.json',
      usage: {
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
      },
    };
    const event = bridge.normalizeStreamEvent(raw, 'session-456');
    expect(event.type).toBe('tool_call');
    expect(event.sessionId).toBe('session-456');
    expect(event.agentRole).toBe('worker');
    expect(event.provider).toBe('antigravity');
    expect(event.tokenUsage).toEqual({
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
    });
  });

  it('does not synthesize a session while the CAO daemon is unavailable', async () => {
    const bridge = new CaoBridgeService();
    const result = await bridge.createSession({
      taskKey: 'TH-10',
      taskTitle: 'Integrate CAO Bridge',
      instructions: 'Setup bridge adapter',
      provider: 'antigravity',
      model: 'gemini-3.7-flash',
      workingDirectory: 'd:/Work/task-hub',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Electron main must launch CAO');
    expect(bridge.getActiveSessions()).toEqual([]);
  });

  it('does not synthesize a session even when /health is available', async () => {
    const bridge = new CaoBridgeService();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', service: 'cli-agent-orchestrator' }), { status: 200 }));
    await bridge.checkHealth();
    const result = await bridge.createSession({
      taskKey: 'TH-11',
      taskTitle: 'Use official lifecycle',
      instructions: 'Run through Electron main',
      provider: 'codex',
      workingDirectory: 'd:/Work/task-hub',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Electron main');
    expect(bridge.getActiveSessions()).toEqual([]);
    fetchMock.mockRestore();
  });

  it('returns graceful status when CAO daemon is offline', async () => {
    const bridge = new CaoBridgeService('http://127.0.0.1:9999');
    const health = await bridge.checkHealth();
    expect(health.ok).toBe(false);
    expect(health.message).toContain('CAO Orchestrator daemon is not running');
  });
});
