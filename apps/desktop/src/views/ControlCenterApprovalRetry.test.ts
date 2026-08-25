import { describe, expect, it } from 'vitest';
import source from './ControlCenter.vue?raw';

describe('Control Center approval retry', () => {
  it('continues the existing activity timeline and surfaces human review even after full access fails', () => {
    expect(source).toContain('preserveOutput = false');
    expect(source).toContain('if (!preserveOutput) output.value = \'\';');
    expect(source).toContain("pending.intent, true");
    expect(source).toContain("pendingLaunch.value?.policy === 'full_access'");
    expect(source).toContain('alreadyFullAccess');
    expect(source).toContain('human review required before retrying');
    expect(source).toContain('isSandboxFailure(output.value.slice(runOutputStart.value))');
    expect(source).toContain('Continuing the same run.');
  });
});
