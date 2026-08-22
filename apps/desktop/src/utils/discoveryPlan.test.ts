import { describe, expect, it } from 'vitest';
import { parseDiscoveryPlan } from './discoveryPlan';

const valid = `<task-hub-discovery-plan>{"summary":"Thêm login","assumptions":["OAuth"],"affected_docs":["docs/PRD.md"],"architecture_notes":["Auth module"],"risks":["Redirect"],"epic":{"title":"Google Login"},"stories":[{"title":"Đăng nhập","story_points":5,"acceptance_criteria":["Đăng nhập được"],"tasks":[{"ref":"schema","title":"Thêm config","story_points":3,"acceptance_criteria":["Có config"],"depends_on":[]},{"ref":"api","title":"OAuth callback","story_points":5,"acceptance_criteria":["Callback hợp lệ"],"depends_on":["schema"]}]}]}</task-hub-discovery-plan>`;

describe('parseDiscoveryPlan', () => {
  it('parses and validates a compliant plan', () => {
    const result = parseDiscoveryPlan(`Human summary\n${valid}`);
    expect(result.errors).toEqual([]);
    expect(result.plan?.epic.title).toBe('Google Login');
  });

  it('rejects a missing contract', () => {
    expect(parseDiscoveryPlan('only prose').errors[0]).toContain('payload');
  });

  it('reports malformed JSON', () => {
    expect(parseDiscoveryPlan('<task-hub-discovery-plan>{bad}</task-hub-discovery-plan>').errors[0]).toContain('JSON');
  });

  it('reports invalid points and missing dependency refs', () => {
    const result = parseDiscoveryPlan(valid.replace('"story_points":5,"acceptance_criteria":["Callback', '"story_points":13,"acceptance_criteria":["Callback').replace('["schema"]', '["missing"]'));
    expect(result.errors.join(' ')).toContain('Fibonacci');
    expect(result.errors.join(' ')).toContain('không tồn tại');
  });
});
