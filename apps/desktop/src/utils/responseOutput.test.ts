import { describe, expect, it } from 'vitest';
import { parseResponseOutput, responseOutputForDisplay } from './responseOutput';

describe('responseOutput', () => {
  it('keeps marked markdown response while moving CAO JSON and progress to technical lines', () => {
    const raw = [
      'Working (4s • esc to interrupt)',
      'Calling cao-mcp-server.memory_recall({"query":"task instructions"})',
      '{"success":true,"memories":[{"key":"contract"}]}',
      '💬 Đã kiểm tra contract.',
      '',
      '- Tất cả test đều pass.',
      'Process exited (0).',
    ].join('\n');

    const parsed = parseResponseOutput(raw);
    expect(parsed.latestResponse).toContain('Đã kiểm tra contract.');
    expect(parsed.latestResponse).toContain('Tất cả test đều pass.');
    expect(parsed.latestResponse).not.toContain('memory_recall');
    expect(parsed.technicalLines.some((line) => line.includes('memory_recall'))).toBe(true);
    expect(parsed.hasTechnicalDetails).toBe(true);
    expect(parsed.hasRuntimeError).toBe(false);
  });

  it('does not promote operational-only CAO output to a response', () => {
    const parsed = parseResponseOutput([
      'I’ll first load the exact Task Hub instruction file, then follow its workflow.',
      'Working (7s • esc to interrupt)',
      'Called cao-mcp-server.memory_recall({"limit":5})',
      '{"success":true,"memories":[]}',
    ].join('\n'));

    expect(parsed.latestResponse).toBe('');
    expect(parsed.latestProgress).toBe('Working (7s • esc to interrupt)');
    expect(parsed.technicalLines).toHaveLength(4);
    expect(responseOutputForDisplay('', true)).toBe('Agent đang xử lý ngữ cảnh…');
  });

  it('strips ANSI and reports runtime errors without changing raw input', () => {
    const raw = '\u001b[31mERROR failed to execute\u001b[0m\nProcess exited (1).';
    const parsed = parseResponseOutput(raw);
    expect(parsed.hasRuntimeError).toBe(true);
    expect(parsed.technicalLines.join('\n')).not.toContain('\u001b');
    expect(responseOutputForDisplay(raw, false, 'failed')).toBe('Run thất bại trước khi có phản hồi cuối từ agent.');
  });

  it('accepts unmarked normal agent prose and exposes completion fallback', () => {
    const parsed = parseResponseOutput('Đã cập nhật schema và chạy kiểm thử thành công.');
    expect(parsed.latestResponse).toBe('Đã cập nhật schema và chạy kiểm thử thành công.');
    expect(responseOutputForDisplay('', false, 'completed')).toContain('không có phản hồi');
  });
});
