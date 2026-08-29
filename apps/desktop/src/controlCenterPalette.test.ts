import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const styleSource = fs.readFileSync(path.resolve(__dirname, 'style.css'), 'utf8');

describe('Control Center Cloud Hub palette', () => {
  it('keeps the desktop tokens aligned with Deep Midnight Obsidian & Phantom Neon palette', () => {
    const midnightObsidianTokens = [
      '--cc-canvas: #04070d',
      '--cc-surface: #070b14',
      '--cc-surface-muted: #0c1220',
      '--cc-surface-elevated: #11182c',
      '--cc-line: #141b2d',
      '--cc-line-soft: rgba(20, 27, 45, 0.6)',
      '--cc-ink: #f8fafc',
      '--cc-muted: #94a3b8',
      '--cc-accent: #00f5a0',
      '--cc-accent-strong: #00f5d4',
      '--cc-accent-soft: rgba(0, 245, 160, 0.12)',
      '--cc-accent-line: rgba(0, 245, 160, 0.4)',
      '--cc-cyan: #00f5d4',
      '--cc-purple: #9d4edd',
      '--cc-success: #00f5a0',
      '--cc-warning: #f59e0b',
      '--cc-danger: #ff0054',
    ];

    for (const token of midnightObsidianTokens) {
      expect(styleSource).toContain(token);
    }
  });

  it('does not reintroduce the previous navy control-center surfaces', () => {
    expect(styleSource).not.toContain('background: #0b1019; color: #e6edf7');
    expect(styleSource).not.toContain('background: #3976e8');
  });
});
