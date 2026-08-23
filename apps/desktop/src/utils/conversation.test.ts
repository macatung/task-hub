import { describe, expect, it } from 'vitest';
import { buildInitialRequest, consumePendingUserEcho } from './conversation';

describe('conversation request helpers', () => {
  it('builds a required requirement request', () => {
    expect(buildInitialRequest({ mode: 'discovery', note: 'Add Google login' })).toBe('Add Google login');
  });

  it('creates contextual requests for Task and Docs, preserving an optional note', () => {
    expect(buildInitialRequest({ mode: 'task', task: { issueKey: 'TASK-12', title: 'OAuth callback' }, note: 'Prioritize unit tests' })).toContain('TASK-12 · OAuth callback');
    expect(buildInitialRequest({ mode: 'task', task: { issueKey: 'TASK-12', title: 'OAuth callback' }, note: 'Prioritize unit tests' })).toContain('Execute TASK-12 · OAuth callback.');
    expect(buildInitialRequest({ mode: 'docs', projectTitle: 'Task Hub', note: 'Architecture docs only' })).toContain('Architecture docs only');
    expect(buildInitialRequest({ mode: 'docs', projectTitle: 'Task Hub', note: 'Architecture docs only' })).toContain('Scan repository and generate/update standard documentation for Task Hub.');
  });

  it('consumes only a matching provider echo', () => {
    expect(consumePendingUserEcho(['hello world'], 'Hello   world')).toEqual({ duplicate: true, pending: [] });
    expect(consumePendingUserEcho(['hello world'], 'different')).toEqual({ duplicate: false, pending: ['hello world'] });
  });
});
