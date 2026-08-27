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

  it('ignores the staged protocol echoed by CAO before a successful response', () => {
    const caoEcho = [
      'Task Hub Desktop execution protocol:',
      '1. Read and follow the complete task instructions from this exact local file:',
      '/mnt/d/Work/task/.macatung/agent/prompts/cao-run.md',
      '2. Do not report the task as completed until those instructions have been read and the requested work is done.',
      '3. If the file cannot be read, stop and respond with the literal prefix TASK_HUB_RUN_BLOCKED: unable to read staged task instructions, followed by the reason. Do not claim success.',
      'I have assigned the review task and am waiting for the review results.',
    ].join('\n');
    expect(hasAgentReportedFailure(caoEcho)).toBe(false);
  });
});
