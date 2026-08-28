import { describe, expect, it } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';
import connectionBarSource from '../components/control-center/ConnectionBar.vue?raw';
import statusFooterSource from '../components/control-center/StatusFooter.vue?raw';

describe('ControlCenter CAO sync, AgentFleetBar mounting, and mid-flight resilience', () => {
  it('mounts AgentFleetBar in ControlCenter template with active fleet sessions and select handler', () => {
    expect(controlCenterSource).toContain("import AgentFleetBar from '../components/control-center/AgentFleetBar.vue'");
    expect(controlCenterSource).toContain('<AgentFleetBar');
    expect(controlCenterSource).toContain(':agents="fleetAgents"');
    expect(controlCenterSource).toContain(':active-session-id="sessionId"');
    expect(controlCenterSource).toContain('@select="handleSelectFleetSession"');
    expect(controlCenterSource).toContain('const handleSelectFleetSession = (targetSessionId: string) =>');
  });

  it('passes caoStatus, agentRole, and tokenUsage props across child components', () => {
    expect(controlCenterSource).toContain(':cao-status="caoStatus"');
    expect(controlCenterSource).toContain(':cao-reconnecting="caoReconnecting"');
    expect(controlCenterSource).toContain(':agent-role="activeAgentRole"');
    expect(controlCenterSource).toContain(':token-usage="sessionTokenUsage"');
    expect(controlCenterSource).toContain('@restart-cao="restartCao"');
  });

  it('surfaces error toast notification when CAO disconnects mid-flight', () => {
    expect(controlCenterSource).toContain('previousCaoAvailable');
    expect(controlCenterSource).toContain('Mất kết nối CAO');
    expect(controlCenterSource).toContain('CAO Daemon bị ngắt kết nối trong khi agent đang chạy. Phiên làm việc có thể bị gián đoạn.');
  });

  it('renders CAO daemon indicators in ConnectionBar and StatusFooter', () => {
    expect(connectionBarSource).toContain('cc-connectionbar__cao');
    expect(connectionBarSource).toContain('CAO Reconnecting…');
    expect(connectionBarSource).toContain('CAO Offline');
    expect(statusFooterSource).toContain('CAO: RECONNECTING');
    expect(statusFooterSource).toContain('CAO: CONNECTED');
    expect(statusFooterSource).toContain('CAO: OFFLINE');
  });
});
