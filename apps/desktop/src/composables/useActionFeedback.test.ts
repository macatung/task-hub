import { describe, it, expect, beforeEach } from 'vitest';
import { useActionFeedback } from './useActionFeedback';

describe('useActionFeedback composable', () => {
  beforeEach(() => {
    const { clearTimeline } = useActionFeedback();
    clearTimeline();
  });

  it('notifies user actions with immediate feedback item and logs to timeline', () => {
    const { notify, activeFeedbacks, activityTimeline } = useActionFeedback();

    const id = notify({
      type: 'info',
      title: 'Đã chọn nhiệm vụ',
      message: 'TASK-101 — Tích hợp hệ thống ghi nhận tương tác',
      sound: false,
    });

    expect(id).toBeDefined();
    expect(activeFeedbacks.value.length).toBeGreaterThan(0);
    expect(activeFeedbacks.value[0].title).toBe('Đã chọn nhiệm vụ');
    expect(activeFeedbacks.value[0].type).toBe('info');
    expect(activeFeedbacks.value[0].actor).toBe('User');

    // Should also record into activity timeline
    expect(activityTimeline.value.length).toBeGreaterThan(0);
    expect(activityTimeline.value[0].label).toBe('Đã chọn nhiệm vụ');
    expect(activityTimeline.value[0].actor?.name).toBe('Developer (Desktop User)');
  });

  it('manages long-running operation lifecycle with start, update, and finish', () => {
    const { startOperation, updateOperation, finishOperation, activeFeedbacks } = useActionFeedback();

    startOperation('agent-run-test', 'Đã ghi nhận lệnh chạy', 'Đang chuẩn bị Git worktree cô lập…');
    const runningItem = activeFeedbacks.value.find(f => f.id === 'agent-run-test');
    expect(runningItem).toBeDefined();
    expect(runningItem?.type).toBe('loading');
    expect(runningItem?.persistent).toBe(true);

    updateOperation('agent-run-test', 'Agent đang streaming kết quả…', 45);
    expect(runningItem?.message).toBe('Agent đang streaming kết quả…');
    expect(runningItem?.progress).toBe(45);

    finishOperation('agent-run-test', 'success', 'Agent hoàn tất thực thi', 'Đã tạo xong bằng chứng test.');
    const finishedItem = activeFeedbacks.value.find(f => f.id === 'agent-run-test');
    expect(finishedItem?.type).toBe('success');
    expect(finishedItem?.persistent).toBe(false);
  });

  it('allows manual dismiss of active feedback toasts', () => {
    const { notify, dismiss, activeFeedbacks } = useActionFeedback();

    const id = notify({
      type: 'warning',
      title: 'Cảnh báo',
      message: 'Cần phê duyệt quyền',
      sound: false,
    });

    expect(activeFeedbacks.value.some(f => f.id === id)).toBe(true);
    dismiss(id);
    expect(activeFeedbacks.value.some(f => f.id === id)).toBe(false);
  });
});
