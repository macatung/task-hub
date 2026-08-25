import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';

describe('ControlCenter user action feedback integration', () => {
  it('integrates useActionFeedback and binds immediate toasts for all actions', () => {
    expect(controlCenterSource).toContain("import { useActionFeedback } from '../composables/useActionFeedback'");
    expect(controlCenterSource).toContain('startOperation');
    expect(controlCenterSource).toContain('finishOperation');
    expect(controlCenterSource).toContain('notify(');
  });

  it('provides explicit immediate feedback on task selection, workspace choosing, and launching', () => {
    // Task selection feedback
    expect(controlCenterSource).toContain("notify({ type: 'info', title: 'Đã chọn nhiệm vụ'");
    // Workspace selection feedback
    expect(controlCenterSource).toContain("notify({ type: 'info', title: 'Chọn thư mục dự án'");
    // Agent launch feedback
    expect(controlCenterSource).toContain("startOperation('agent-run', 'Đã ghi nhận lệnh chạy'");
    // Agent cancellation feedback
    expect(controlCenterSource).toContain("notify({ type: 'warning', title: 'Đang hủy phiên chạy'");
    // Follow-up message feedback
    expect(controlCenterSource).toContain("notify({ type: 'info', title: 'Đã gửi tin nhắn đến Agent'");
  });

  it('provides feedback during requirement discovery and docs workflows', () => {
    expect(controlCenterSource).toContain("startOperation('req-run', 'Đang phân tích yêu cầu'");
    expect(controlCenterSource).toContain("startOperation('create-backlog', 'Đang tạo Backlog trên Hub'");
    expect(controlCenterSource).toContain("startOperation('docs-scan', 'Đang quét tài liệu'");
    expect(controlCenterSource).toContain("startOperation('sync-docs', 'Đang đồng bộ tài liệu lên Hub'");
  });

  it('includes ActivityTimelineDrawer for complete audit trail visibility', () => {
    expect(controlCenterSource).toContain('<ActivityTimelineDrawer');
    expect(controlCenterSource).toContain(':timeline="activityTimeline"');
    expect(controlCenterSource).toContain('showTimelineDrawer');
  });
});
