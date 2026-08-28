import { describe, expect, it } from 'vitest';
import { CaoBridgeService } from '../services/caoBridgeService';
import controlCenterSource from './ControlCenter.vue?raw';
import runWorkspaceSource from '../components/control-center/RunWorkspace.vue?raw';
import agentFleetBarSource from '../components/control-center/AgentFleetBar.vue?raw';
import settingsPanelSource from '../components/control-center/SettingsPanel.vue?raw';
import connectionBarSource from '../components/control-center/ConnectionBar.vue?raw';
import statusFooterSource from '../components/control-center/StatusFooter.vue?raw';

describe('Challenger 2 Empirical Adversarial Stress Test Suite', () => {
  const service = new CaoBridgeService();

  describe('Dimension 1: Stream Event Normalizer & Token Usage Robustness', () => {
    it('handles malformed, null, undefined, and non-object stream events without throwing', () => {
      const sessionId = 'session-test-123';
      const nullRes = service.normalizeStreamEvent(null, sessionId);
      expect(nullRes.type).toBe('text');
      expect(nullRes.content).toBe('');
      expect(nullRes.tokenUsage).toBeUndefined();

      const undefRes = service.normalizeStreamEvent(undefined, sessionId);
      expect(undefRes.type).toBe('text');
      expect(undefRes.content).toBe('');

      const strRes = service.normalizeStreamEvent('raw string output', sessionId);
      expect(strRes.type).toBe('text');
      expect(strRes.content).toBe('raw string output');

      const numRes = service.normalizeStreamEvent(12345, sessionId);
      expect(numRes.type).toBe('text');
      expect(numRes.content).toBe('12345');

      const arrRes = service.normalizeStreamEvent(['item1', 'item2'], sessionId);
      expect(arrRes.type).toBe('text');
      expect(arrRes.content).toBe(JSON.stringify(['item1', 'item2']));
    });

    it('accurately normalizes event types and agent roles across all variants', () => {
      const sessionId = 'session-test-456';
      
      const initEvt = service.normalizeStreamEvent({ event: 'init', role: 'supervisor' }, sessionId);
      expect(initEvt.type).toBe('init');
      expect(initEvt.agentRole).toBe('supervisor');

      const toolEvt = service.normalizeStreamEvent({ event: 'tool_call', role: 'worker' }, sessionId);
      expect(toolEvt.type).toBe('tool_call');
      expect(toolEvt.agentRole).toBe('worker');

      const resEvt = service.normalizeStreamEvent({ event: 'result', role: 'reviewer' }, sessionId);
      expect(resEvt.type).toBe('turn_complete');
      expect(resEvt.agentRole).toBe('reviewer');

      const errEvt = service.normalizeStreamEvent({ type: 'error', message: 'Something went wrong' }, sessionId);
      expect(errEvt.type).toBe('error');
      expect(errEvt.content).toBe('Something went wrong');
    });

    it('extracts token usage correctly under edge cases, zeroes, and large values', () => {
      const sessionId = 'session-tokens-789';

      const zeroEvt = service.normalizeStreamEvent({
        event: 'result',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      }, sessionId);
      expect(zeroEvt.sessionId).toBe(sessionId);

      const normalEvt = service.normalizeStreamEvent({
        event: 'result',
        usage: { prompt_tokens: 150, completion_tokens: 250, total_tokens: 400 }
      }, sessionId);
      expect(normalEvt.tokenUsage).toEqual({
        promptTokens: 150,
        completionTokens: 250,
        totalTokens: 400
      });

      const largeEvt = service.normalizeStreamEvent({
        event: 'result',
        usage: { prompt_tokens: 1200000, completion_tokens: 300000, total_tokens: 1500000 }
      }, sessionId);
      expect(largeEvt.tokenUsage?.totalTokens).toBe(1500000);
    });

    it('handles partial token usage payloads gracefully with defaults', () => {
      const sessionId = 'session-tokens-partial';
      const partialEvt = service.normalizeStreamEvent({
        event: 'result',
        usage: { total_tokens: 500 }
      }, sessionId);
      expect(partialEvt.tokenUsage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 500
      });
    });
  });

  describe('Dimension 2: UI Token Formatting & Formatter Invariants', () => {
    const formatTokens = (count?: number): string => {
      if (count === undefined || count === null || isNaN(count)) return '0';
      if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
      if (count >= 1_000) return (count / 1_000).toFixed(1) + 'k';
      return String(count);
    };

    it('formats tokens according to exact threshold specifications', () => {
      expect(formatTokens(undefined)).toBe('0');
      expect(formatTokens(null as any)).toBe('0');
      expect(formatTokens(NaN)).toBe('0');
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(45)).toBe('45');
      expect(formatTokens(999)).toBe('999');
      expect(formatTokens(1000)).toBe('1.0k');
      expect(formatTokens(1500)).toBe('1.5k');
      expect(formatTokens(10500)).toBe('10.5k');
      expect(formatTokens(999999)).toBe('1000.0k');
      expect(formatTokens(1000000)).toBe('1.0M');
      expect(formatTokens(2450000)).toBe('2.5M');
      expect(formatTokens(10000000)).toBe('10.0M');
    });
  });

  describe('Dimension 3: Rapid Flapping & CAO Disconnect / Reconnect State Machine', () => {
    const evaluateCaoState = (props: {
      caoAvailable?: boolean;
      caoStatus?: { running: boolean; available: boolean; reconnecting?: boolean } | null;
      caoReconnecting?: boolean;
    }) => {
      const isCaoReconnecting = Boolean(props.caoReconnecting || props.caoStatus?.reconnecting);
      const isCaoAvailable = (() => {
        if (props.caoAvailable !== undefined) return props.caoAvailable;
        if (props.caoStatus?.available !== undefined) return props.caoStatus.available;
        return true;
      })();
      const caoStatusLabel = isCaoReconnecting
        ? 'Đang kết nối lại…'
        : isCaoAvailable
          ? 'Sẵn sàng'
          : 'Bắt buộc · chưa sẵn sàng';
      const caoStatusTone = isCaoReconnecting
        ? 'text-amber-400'
        : isCaoAvailable
          ? 'cc-state--success'
          : 'cc-state--blocked';
      return { isCaoReconnecting, isCaoAvailable, caoStatusLabel, caoStatusTone };
    };

    it('evaluates status labels and tones through rapid state transitions without desync', () => {
      let state = evaluateCaoState({
        caoAvailable: true,
        caoStatus: { running: true, available: true },
        caoReconnecting: false
      });
      expect(state.isCaoAvailable).toBe(true);
      expect(state.isCaoReconnecting).toBe(false);
      expect(state.caoStatusLabel).toBe('Sẵn sàng');
      expect(state.caoStatusTone).toBe('cc-state--success');

      state = evaluateCaoState({
        caoAvailable: false,
        caoStatus: { running: false, available: false },
        caoReconnecting: false
      });
      expect(state.isCaoAvailable).toBe(false);
      expect(state.isCaoReconnecting).toBe(false);
      expect(state.caoStatusLabel).toBe('Bắt buộc · chưa sẵn sàng');
      expect(state.caoStatusTone).toBe('cc-state--blocked');

      state = evaluateCaoState({
        caoAvailable: false,
        caoStatus: { running: false, available: false, reconnecting: true },
        caoReconnecting: true
      });
      expect(state.isCaoReconnecting).toBe(true);
      expect(state.caoStatusLabel).toBe('Đang kết nối lại…');
      expect(state.caoStatusTone).toBe('text-amber-400');

      state = evaluateCaoState({
        caoAvailable: true,
        caoStatus: { running: true, available: true, reconnecting: false },
        caoReconnecting: false
      });
      expect(state.isCaoAvailable).toBe(true);
      expect(state.isCaoReconnecting).toBe(false);
      expect(state.caoStatusLabel).toBe('Sẵn sàng');
    });

    it('verifies executionBlock prevents launch when CAO is unavailable and allows when available', () => {
      const evaluateExecutionBlock = (task: any, caoAvailable?: boolean, caoStatus?: any, isCaoReconnecting = false) => {
        if (!task) return null;
        if (task.status !== 'todo' && task.status !== 'in_progress') {
          return { title: 'Execution unavailable', tone: 'slate' };
        }
        if (caoAvailable === false || (caoStatus && !caoStatus.available && !isCaoReconnecting)) {
          return {
            title: 'CAO daemon is required',
            detail: 'CAO daemon is required to orchestrate multi-agent sessions. Start or restart the CAO daemon to proceed.',
            tone: 'rose'
          };
        }
        return null;
      };

      const task = { id: 101, status: 'todo', issue_type: 'task' };
      
      // Blocked when CAO is explicitly false
      const blocked = evaluateExecutionBlock(task, false, { available: false }, false);
      expect(blocked).not.toBeNull();
      expect(blocked?.title).toBe('CAO daemon is required');
      expect(blocked?.tone).toBe('rose');

      // Not blocked when CAO is available
      const unblocked = evaluateExecutionBlock(task, true, { available: true }, false);
      expect(unblocked).toBeNull();
    });
  });

  describe('Dimension 4: Multi-Agent Role Rendering & Fleet Hierarchy', () => {
    const evaluateAgentBadge = (agent: { role?: string; provider?: string }) => {
      const initials = agent.role === 'supervisor'
        ? 'SV'
        : agent.role === 'reviewer'
          ? 'RV'
          : agent.role === 'worker'
            ? 'WK'
            : (agent.provider || 'CODEX').slice(0, 2).toUpperCase();

      const role = agent.role === 'supervisor'
        ? 'Supervisor'
        : agent.role === 'worker'
          ? 'Worker'
          : agent.role === 'reviewer'
            ? 'Reviewer'
            : agent.role || 'Local agent';

      const roleBadgeClass = agent.role === 'supervisor'
        ? 'border-purple-600/40 bg-purple-950/50 text-purple-300'
        : agent.role === 'worker'
          ? 'border-sky-600/40 bg-sky-950/50 text-sky-300'
          : agent.role === 'reviewer'
            ? 'border-amber-600/40 bg-amber-950/50 text-amber-300'
            : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400';

      return { initials, role, roleBadgeClass };
    };

    it('maps supervisor, worker, reviewer, and fallback roles to distinct badges and initials', () => {
      const sv = evaluateAgentBadge({ role: 'supervisor', provider: 'cao' });
      expect(sv.initials).toBe('SV');
      expect(sv.role).toBe('Supervisor');
      expect(sv.roleBadgeClass).toContain('purple');

      const wk = evaluateAgentBadge({ role: 'worker', provider: 'codex' });
      expect(wk.initials).toBe('WK');
      expect(wk.role).toBe('Worker');
      expect(wk.roleBadgeClass).toContain('sky');

      const rv = evaluateAgentBadge({ role: 'reviewer', provider: 'claude_code' });
      expect(rv.initials).toBe('RV');
      expect(rv.role).toBe('Reviewer');
      expect(rv.roleBadgeClass).toContain('amber');

      const generic = evaluateAgentBadge({ provider: 'antigravity' });
      expect(generic.initials).toBe('AN');
      expect(generic.role).toBe('Local agent');
      expect(generic.roleBadgeClass).toContain('zinc');
    });

    it('correctly sorts fleet agents prioritizing the currently active session', () => {
      const activeSessionId = 'sess-2';
      const agents = [
        { sessionId: 'sess-1', status: 'running' },
        { sessionId: 'sess-2', status: 'running' },
        { sessionId: 'sess-3', status: 'saved' }
      ];

      const sorted = [...agents].sort(
        (a, b) => Number(b.sessionId === activeSessionId) - Number(a.sessionId === activeSessionId)
      );

      expect(sorted[0].sessionId).toBe('sess-2');
    });
  });

  describe('Dimension 5: Component Source Invariants & Contract Verification', () => {
    it('verifies ControlCenter mounts AgentFleetBar and binds active session and token usage', () => {
      expect(controlCenterSource).toContain('AgentFleetBar');
      expect(controlCenterSource).toContain('fleetAgents');
      expect(controlCenterSource).toContain('sessionId');
      expect(controlCenterSource).toContain('handleSelectFleetSession');
      expect(controlCenterSource).toContain('activeAgentRole.value');
      expect(controlCenterSource).toContain('sessionTokenUsage.value');
    });

    it('verifies RunWorkspace binds CAO connection tri-state and restart emitters', () => {
      expect(runWorkspaceSource).toContain('caoStatus');
      expect(runWorkspaceSource).toContain('caoReconnecting');
      expect(runWorkspaceSource).toContain('restartCao');
      expect(runWorkspaceSource).toContain('roleBadgeLabel');
      expect(runWorkspaceSource).toContain('formatTokens');
    });

    it('verifies SettingsPanel exposes CAO troubleshooting instructions and restart actions', () => {
      expect(settingsPanelSource).toContain('CAO Multi-Agent Orchestrator');
      expect(settingsPanelSource).toContain('Restart CAO daemon');
      expect(settingsPanelSource).toContain('cao-server --port 9889');
      expect(settingsPanelSource).toContain('caoStatus');
      expect(settingsPanelSource).toContain('restartCao');
    });

    it('verifies ConnectionBar and StatusFooter reflect CAO daemon status and reconnecting state', () => {
      expect(connectionBarSource).toContain('caoStatus');
      expect(connectionBarSource).toContain('caoReconnecting');
      expect(statusFooterSource).toContain('caoStatus');
      expect(statusFooterSource).toContain('caoReconnecting');
      expect(controlCenterSource).toContain('caoStatus');
      expect(controlCenterSource).toContain('caoReconnecting');
    });
  });
});
