import { describe, expect, it } from 'vitest';
import { hasAgentReportedFailure } from './agentRunOutcome';

describe('hasAgentReportedFailure', () => {
  it('recognizes a provider that reports a blocking prompt-file error despite exiting successfully', () => {
    expect(hasAgentReportedFailure('I encountered a blocking error when attempting to access and execute the instructions in C:\\repo\\.macatung\\agent\\prompts\\run.md.')).toBe(true);
    expect(hasAgentReportedFailure('TASK_HUB_RUN_BLOCKED: prompt file could not be read.')).toBe(true);
  });

  it('does not reject an ordinary successful completion', () => {
    expect(hasAgentReportedFailure('Implemented the change and npm test passed.')).toBe(false);
  });
});
