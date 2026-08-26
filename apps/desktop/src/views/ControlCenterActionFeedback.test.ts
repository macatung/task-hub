import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';

describe('ControlCenter user action feedback integration', () => {
  it('integrates useActionFeedback and binds immediate toasts for all actions', () => {
    expect(controlCenterSource).toMatch(/import\s+\{\s*useActionFeedback\s*\}\s+from\s+["']\.\.\/composables\/useActionFeedback["']/);
    expect(controlCenterSource).toContain('startOperation');
    expect(controlCenterSource).toContain('finishOperation');
    expect(controlCenterSource).toContain('notify(');
  });

  it('provides explicit immediate feedback on task selection, workspace choosing, and launching', () => {
    // Task selection feedback
    expect(controlCenterSource).toMatch(/notify\(\s*\{\s*type:\s*["']info["'],\s*title:\s*["']Đã chọn nhiệm vụ["']/);
    // Workspace selection feedback
    expect(controlCenterSource).toMatch(/notify\(\s*\{\s*type:\s*["']info["'],\s*title:\s*["']Chọn thư mục dự án["']/);
    // Agent launch feedback
    expect(controlCenterSource).toMatch(/startOperation\(\s*["']agent-run["'],\s*["']Đã ghi nhận lệnh chạy["']/);
    // Agent cancellation feedback
    expect(controlCenterSource).toMatch(/notify\(\s*\{\s*type:\s*["']warning["'],\s*title:\s*["']Đang hủy phiên chạy["']/);
    // Follow-up message feedback
    expect(controlCenterSource).toMatch(/notify\(\s*\{\s*type:\s*["']info["'],\s*title:\s*["']Đã gửi tin nhắn đến Agent["']/);
  });

  it('provides feedback during requirement discovery and docs workflows', () => {
    expect(controlCenterSource).toMatch(/startOperation\(\s*["']req-run["'],\s*["']Đang phân tích yêu cầu["']/);
    expect(controlCenterSource).toMatch(/startOperation\(\s*["']create-backlog["'],\s*["']Đang tạo Backlog trên Hub["']/);
    expect(controlCenterSource).toMatch(/startOperation\(\s*["']docs-scan["'],\s*["']Đang quét tài liệu["']/);
    expect(controlCenterSource).toMatch(/startOperation\(\s*["']sync-docs["'],\s*["']Đang đồng bộ tài liệu lên Hub["']/);
  });

  it('includes ActivityTimelineDrawer for complete audit trail visibility', () => {
    expect(controlCenterSource).toContain('<ActivityTimelineDrawer');
    expect(controlCenterSource).toContain(':timeline="activityTimeline"');
    expect(controlCenterSource).toContain('showTimelineDrawer');
  });
});
