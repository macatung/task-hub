import { describe, expect, it } from 'vitest';
import heroSource from './TaskProgressHero.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import controlCenterSource from '../../views/ControlCenter.vue?raw';
import connBarSource from './ConnectionBar.vue?raw';

describe('TaskProgressHero & Agent Switching System', () => {
  it('renders task progress hero with high priority badge, live timer, and progress percentage', () => {
    expect(heroSource).toContain('task-progress-hero');
    expect(heroSource).toContain('progressPercent');
    expect(heroSource).toContain('HIGH PRIORITY');
    expect(heroSource).toContain('standardSteps');
    expect(heroSource).toContain('formattedTime');
    expect(heroSource).toContain('Worktree Isolated');
  });

  it('provides interactive Role and Provider Quick Switchers inside TaskProgressHero', () => {
    expect(heroSource).toContain('Đổi vai trò Agent (Switch Role)');
    expect(heroSource).toContain('Đổi AI Engine (Switch Provider)');
    expect(heroSource).toContain('Đổi Agent / Fleet');
    expect(heroSource).toContain('update:agentRole');
    expect(heroSource).toContain('update:provider');
    expect(heroSource).toContain('openAgentRoom');
  });

  it('computes and supports hierarchical Epic sub-tasks breakdown with status tags', () => {
    expect(heroSource).toContain('epicSubTasks');
    expect(heroSource).toContain('isEpic');
    expect(heroSource).toContain('Danh sách Task trong Epic');
    expect(heroSource).toContain('selectSubTask');
    expect(heroSource).toContain('isSubTasksOpen');
  });

  it('integrates prominent Agent Role, Provider, Model selectors and Fleet Switcher Strip in RunWorkspace.vue', () => {
    expect(runWorkspaceSource).toContain('<TaskProgressHero');
    expect(runWorkspaceSource).toContain('Chọn vai trò tác tử (Agent Role)');
    expect(runWorkspaceSource).toContain('Chọn AI Provider / Engine');
    expect(runWorkspaceSource).toContain('Chọn Model AI');
    expect(runWorkspaceSource).toContain('Đổi Tác tử / Fleet:');
    expect(runWorkspaceSource).toContain('Fleet / Đổi Agent');
  });

  it('features prominent Agent Fleet trigger button in ConnectionBar.vue', () => {
    expect(connBarSource).toContain('Đổi Agent / Fleet');
    expect(connBarSource).toContain('codicon-organization');
  });

  it('binds agent-role, fleet workers, and open-agent-room in ControlCenter.vue', () => {
    expect(controlCenterSource).toContain('v-model:agent-role="activeAgentRole"');
    expect(controlCenterSource).toContain('@open-agent-room="showAgentRoomDrawer = true"');
    expect(controlCenterSource).toContain(':workers="fleetAgents"');
    expect(controlCenterSource).toContain('const handleSelectFleetSession');
  });
});
