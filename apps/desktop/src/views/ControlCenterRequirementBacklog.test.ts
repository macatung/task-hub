import { describe, expect, it } from 'vitest';
import source from './ControlCenter.vue?raw';

describe('Control Center requirement backlog creation', () => {
  it('requires a validated discovery payload and creates one linked backlog transaction', () => {
    expect(source).toContain('serializeDiscoveryPlanContract()');
    expect(source).toContain('parseDiscoveryPlan(requirementPlan.value || output.value)');
    expect(source).toContain("mcp('create_requirement_backlog'");
    expect(source).toContain('Story: ${story.title}');
    expect(source).toContain('window.confirm(`Approve and sync this proposal to Hub?');
    expect(source).toContain('const reviseRequirement');
    expect(source).toContain("toolMessage.value = 'Review the backlog proposal before creating tasks.'");
    expect(source).toContain("runIntent.value === 'requirement'");
    expect(source).toContain("toolMode.value = 'requirement'");
    expect(source).toContain("'requirement');");
  });
});
