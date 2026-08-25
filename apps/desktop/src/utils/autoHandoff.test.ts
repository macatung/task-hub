import { describe, expect, it } from 'vitest';
import { buildAutoHandoffPayload } from './autoHandoff';

describe('buildAutoHandoffPayload', () => {
  it('submits a completed run with passing test evidence', () => {
    const payload = buildAutoHandoffPayload({
      output: '⚡ [Executing command] $ npm test\n✓ [Command completed] exit code: 0\n12 tests passed',
      taskTitle: 'Update quota contract',
      exitCode: 0,
    });

    expect(payload?.testStatus).toBe('passed');
    expect(payload?.tests).toContain('npm test');
  });

  it('still submits a successful run when no test output was emitted', () => {
    const payload = buildAutoHandoffPayload({ output: 'Agent completed the requested change.', taskTitle: 'Update docs', exitCode: 0 });

    expect(payload?.testStatus).toBe('skipped');
    expect(payload?.tests).toBe('Agent process exited with code 0');
  });

  it('does not submit failed or sandbox-blocked runs', () => {
    expect(buildAutoHandoffPayload({ output: 'Process exited (1)', taskTitle: 'Task', exitCode: 1 })).toBeNull();
    expect(buildAutoHandoffPayload({ output: 'sandbox startup failure', taskTitle: 'Task', exitCode: 0 })).toBeNull();
  });
});
