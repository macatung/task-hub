import { describe, expect, it } from 'vitest';
import { buildInitialRequest, consumePendingUserEcho } from './conversation';

describe('conversation request helpers', () => {
  it('builds a required requirement request', () => {
    expect(buildInitialRequest({ mode: 'discovery', note: 'Thêm đăng nhập Google' })).toBe('Thêm đăng nhập Google');
  });

  it('creates contextual requests for Task and Docs, preserving an optional note', () => {
    expect(buildInitialRequest({ mode: 'task', task: { issueKey: 'TASK-12', title: 'OAuth callback' }, note: 'Ưu tiên unit test' })).toContain('TASK-12 · OAuth callback');
    expect(buildInitialRequest({ mode: 'docs', projectTitle: 'Task Hub', note: 'Chỉ docs kiến trúc' })).toContain('Chỉ docs kiến trúc');
  });

  it('consumes only a matching provider echo', () => {
    expect(consumePendingUserEcho(['hello world'], 'Hello   world')).toEqual({ duplicate: true, pending: [] });
    expect(consumePendingUserEcho(['hello world'], 'different')).toEqual({ duplicate: false, pending: ['hello world'] });
  });
});
