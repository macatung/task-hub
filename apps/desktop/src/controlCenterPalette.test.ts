import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const styleSource = fs.readFileSync(path.resolve(__dirname, 'style.css'), 'utf8');

describe('Control Center Cloud Hub palette', () => {
  it('keeps the desktop tokens aligned with Hub graphite/copper dark mode', () => {
    const hubDarkTokens = [
      '--cc-canvas: #151514',
      '--cc-surface: #1f1f1d',
      '--cc-surface-muted: #282724',
      '--cc-line: #514c45',
      '--cc-ink: #f7f3ed',
      '--cc-muted: #c2bbb1',
      '--cc-accent: #e09a70',
      '--cc-accent-strong: #efad85',
      '--cc-accent-soft: #4a2e22',
      '--cc-accent-line: #966044',
      '--cc-success: #a9bea4',
      '--cc-success-soft: #2b382b',
    ];

    for (const token of hubDarkTokens) expect(styleSource).toContain(token);
  });

  it('does not reintroduce the previous navy control-center surfaces', () => {
    expect(styleSource).not.toContain('background: #0b1019; color: #e6edf7');
    expect(styleSource).not.toContain('background: #3976e8');
  });
});
