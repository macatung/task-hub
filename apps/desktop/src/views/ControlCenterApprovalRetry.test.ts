import { describe, expect, it } from 'vitest';
import source from './ControlCenter.vue?raw';

describe('Control Center approval retry', () => {
  it('continues the existing activity timeline and never asks twice after full access is approved', () => {
    expect(source).toContain('preserveOutput = false');
    expect(source).toContain('if (!preserveOutput) output.value = \'\';');
    expect(source).toContain("pending.intent, true");
    expect(source).toContain("pendingLaunch.value.policy === 'full_access'");
    expect(source).toContain('No additional permission request was created');
    expect(source).toContain('Continuing the same run.');
  });
});
