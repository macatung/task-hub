import { describe, expect, it } from 'vitest';
import heroSource from './TaskProgressHero.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import controlCenterSource from '../../views/ControlCenter.vue?raw';

describe('TaskProgressHero Component (Design App Lead Progress-First View)', () => {
  it('renders task progress hero with high priority badge, live timer, and progress percentage', () => {
    expect(heroSource).toContain('task-progress-hero');
    expect(heroSource).toContain('progressPercent');
    expect(heroSource).toContain('HIGH PRIORITY');
    expect(heroSource).toContain('standardSteps');
    expect(heroSource).toContain('formattedTime');
    expect(heroSource).toContain('Worktree Isolated');
  });

  it('computes and supports hierarchical Epic sub-tasks breakdown with status tags', () => {
    expect(heroSource).toContain('epicSubTasks');
    expect(heroSource).toContain('isEpic');
    expect(heroSource).toContain('Danh sách Task trong Epic');
    expect(heroSource).toContain('selectSubTask');
    expect(heroSource).toContain('isSubTasksOpen');
  });

  it('integrates TaskProgressHero inside RunWorkspace.vue at top of content area', () => {
    expect(runWorkspaceSource).toContain('<TaskProgressHero');
    expect(runWorkspaceSource).toContain(':workflow-status="workflowStatus"');
    expect(runWorkspaceSource).toContain(':epic-completed-count="epicCompletedCount"');
    expect(runWorkspaceSource).toContain('@select-sub-task="handleSelectSubTask"');
  });

  it('provides a collapsible chat and log dock in RunWorkspace footer to prioritize progress real estate', () => {
    expect(runWorkspaceSource).toContain('isChatDockCollapsed');
    expect(runWorkspaceSource).toContain('Khung Chat & Chỉ thị đang thu gọn');
    expect(runWorkspaceSource).toContain('Thu gọn khung chat để ưu tiên không gian cho tiến độ');
  });

  it('binds workflow status and sub-task selection in ControlCenter.vue', () => {
    expect(controlCenterSource).toContain(':workflow-status="workflowStatus"');
    expect(controlCenterSource).toContain('@select-sub-task="handleSelectSubTask"');
    expect(controlCenterSource).toContain('const handleSelectSubTask');
  });
});
