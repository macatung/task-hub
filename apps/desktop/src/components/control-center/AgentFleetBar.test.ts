import { describe, expect, it } from 'vitest';
import source from './AgentFleetBar.vue?raw';

describe('AgentFleetBar multi-agent and telemetry display', () => {
  it('defines FleetAgent with multi-agent roles and token usage metrics', () => {
    expect(source).toContain('role?: "supervisor" | "worker" | "reviewer" | string');
    expect(source).toContain('tokenUsage?:');
    expect(source).toContain('promptTokens: number');
    expect(source).toContain('completionTokens: number');
    expect(source).toContain('totalTokens: number');
    expect(source).toContain('stepInfo?: string');
  });

  it('renders multi-agent roles with distinct badges (supervisor, worker, reviewer)', () => {
    expect(source).toContain('role(agent)');
    expect(source).toContain('roleBadgeClass(agent)');
    expect(source).toContain('border-purple-600/40 bg-purple-950/50 text-purple-300');
    expect(source).toContain('border-sky-600/40 bg-sky-950/50 text-sky-300');
    expect(source).toContain('border-amber-600/40 bg-amber-950/50 text-amber-300');
  });

  it('displays formatted token usage per session card', () => {
    expect(source).toContain('formatTokens(agent.tokenUsage.totalTokens)');
    expect(source).toContain('tokens');
  });

  it('emits select event when a session card is clicked', () => {
    expect(source).toContain("select: [sessionId: string]");
    expect(source).toContain("@click=\"$emit('select', agent.sessionId)\"");
  });

  it('highlights activeSessionId and renders tone indicators', () => {
    expect(source).toContain("agent.sessionId === activeSessionId");
    expect(source).toContain("border-orange-400/70 bg-orange-950/20");
    expect(source).toContain("tone(agent.status)");
  });
});
