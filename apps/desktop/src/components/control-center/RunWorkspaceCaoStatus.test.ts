import { describe, expect, it } from 'vitest';
import source from './RunWorkspace.vue?raw';

describe('RunWorkspace CAO realtime reflection, roles, and token metrics', () => {
  it('accepts caoStatus, agentRole, and tokenUsage props', () => {
    expect(source).toContain('caoStatus?:');
    expect(source).toContain('agentRole?:');
    expect(source).toContain('tokenUsage?:');
    expect(source).toContain('caoReconnecting?: boolean');
  });

  it('renders tri-state CAO connection indicator (Connected, Disconnected, Reconnecting)', () => {
    expect(source).toContain('const isCaoReconnecting');
    expect(source).toContain('const isCaoAvailable');
    expect(source).toContain('const caoStatusLabel');
    expect(source).toContain('const caoStatusTone');
    expect(source).toContain('Đang kết nối lại…');
    expect(source).toContain('Sẵn sàng');
    expect(source).toContain('Bắt buộc · chưa sẵn sàng');
  });

  it('displays active agent role badge in header (SUPERVISOR / WORKER / REVIEWER)', () => {
    expect(source).toContain('const roleBadgeLabel');
    expect(source).toContain('const roleBadgeClass');
    expect(source).toContain('SUPERVISOR');
    expect(source).toContain('WORKER');
    expect(source).toContain('REVIEWER');
    expect(source).toContain('v-if="agentRole"');
  });

  it('renders live token usage counter widget when tokenUsage is supplied', () => {
    expect(source).toContain('tokenUsage && tokenUsage.totalTokens > 0');
    expect(source).toContain('formatTokens(tokenUsage.totalTokens)');
    expect(source).toContain('formatTokens(tokenUsage.promptTokens)');
    expect(source).toContain('formatTokens(tokenUsage.completionTokens)');
  });

  it('prevents launch when CAO daemon is unavailable and renders restart action', () => {
    expect(source).toContain('CAO daemon is required');
    expect(source).toContain('props.caoAvailable === false');
    expect(source).toContain('@click="$emit(\'restart-cao\'); $emit(\'restartCao\')"');
    expect(source).toContain('Restart CAO');
  });
});
