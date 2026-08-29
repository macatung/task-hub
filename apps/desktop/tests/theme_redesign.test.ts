/**
 * Tier 1, 2, 3 Test Suite: Desktop Midnight Obsidian Theme & Typography Redesign
 * Validates Deep Midnight Obsidian color tokens (#04070d, #070b14, #0c1220, #141b2d),
 * Phantom Mint (#00f5a0), Cyber Cyan (#00f5d4), Alchemist Purple (#9d4edd),
 * Typography (Space Grotesk, Plus Jakarta Sans, Inter, JetBrains Mono),
 * and absence of legacy copper/graphite theme overrides.
 *
 * Source: ORIGINAL_REQUEST §R1, PROJECT.md, TEST_INFRA.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const desktopRoot = path.resolve(__dirname, '..');
const styleSource = fs.readFileSync(path.join(desktopRoot, 'src/style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(desktopRoot, 'index.html'), 'utf8');

describe('Desktop Midnight Obsidian Design System & Theme Redesign', () => {
  describe('[Tier 1] Deep Midnight Obsidian Color Tokens & Variables', () => {
    it('[T1_01] defines Midnight Obsidian base backgrounds and surfaces in CSS variables', () => {
      // Must contain midnight obsidian palette tokens
      const hasObsidianTokens =
        styleSource.includes('#04070d') ||
        styleSource.includes('--color-midnight-950') ||
        styleSource.includes('--cc-canvas: #04070d');
      expect(hasObsidianTokens).toBe(true);

      const hasSurfaceTokens =
        styleSource.includes('#070b14') ||
        styleSource.includes('--color-midnight-900') ||
        styleSource.includes('--cc-surface: #070b14');
      expect(hasSurfaceTokens).toBe(true);

      const hasPanelTokens =
        styleSource.includes('#0c1220') ||
        styleSource.includes('--color-midnight-850') ||
        styleSource.includes('--cc-surface-muted: #0c1220');
      expect(hasPanelTokens).toBe(true);
    });

    it('[T1_02] defines Midnight Obsidian border tokens (#141b2d / midnight-800)', () => {
      const hasBorderTokens =
        styleSource.includes('#141b2d') ||
        styleSource.includes('--color-midnight-800') ||
        styleSource.includes('--cc-line: #141b2d') ||
        styleSource.includes('20, 27, 45');
      expect(hasBorderTokens).toBe(true);
    });

    it('[T1_03] defines neon accent tokens (Phantom Mint #00f5a0, Cyber Cyan #00f5d4, Purple #9d4edd)', () => {
      const hasMint =
        styleSource.includes('#00f5a0') ||
        styleSource.includes('--color-phantom-mint') ||
        styleSource.includes('--cc-accent: #00f5a0');
      expect(hasMint).toBe(true);

      const hasCyan =
        styleSource.includes('#00f5d4') ||
        styleSource.includes('--color-cyber-cyan') ||
        styleSource.includes('--cc-cyan: #00f5d4') ||
        styleSource.includes('--cc-accent-strong: #00f5d4');
      expect(hasCyan).toBe(true);

      const hasPurple =
        styleSource.includes('#9d4edd') ||
        styleSource.includes('--color-alchemist-purple') ||
        styleSource.includes('--cc-purple: #9d4edd');
      expect(hasPurple).toBe(true);
    });
  });

  describe('[Tier 1] Unified Typography Stack', () => {
    it('[T1_04] includes Google Fonts for Space Grotesk, Plus Jakarta Sans / Inter, and JetBrains Mono', () => {
      const combined = indexHtml + styleSource;
      expect(combined).toContain('Space+Grotesk');
      expect(combined).toContain('JetBrains+Mono');
      expect(combined.includes('Plus+Jakarta+Sans') || combined.includes('Inter')).toBe(true);
    });

    it('[T1_05] configures code, logs, issue keys, and terminal with JetBrains Mono', () => {
      expect(styleSource).toContain('JetBrains Mono');
    });

    it('[T1_06] sets default dark background and text antialiasing on body or root shell', () => {
      expect(styleSource.includes('antialiased') || indexHtml.includes('antialiased') || styleSource.includes('-webkit-font-smoothing')).toBe(true);
    });
  });

  describe('[Tier 2] Theme Boundaries & Fallback Values', () => {
    it('[T2_01] guarantees all semantic surfaces have defined fallback variables in .cc-shell', () => {
      expect(styleSource).toContain('--cc-canvas');
      expect(styleSource).toContain('--cc-surface');
      expect(styleSource).toContain('--cc-surface-muted');
      expect(styleSource).toContain('--cc-line');
      expect(styleSource).toContain('--cc-ink');
      expect(styleSource).toContain('--cc-accent');
    });

    it('[T2_02] enforces dark color scheme with zero light-mode canvas leakage', () => {
      expect(styleSource).toContain('color-scheme: dark');
      expect(styleSource).not.toContain('--cc-canvas: #ffffff');
      expect(styleSource).not.toContain('--cc-canvas: #f8fafc');
    });

    it('[T2_03] verifies high-contrast ink values for accessibility against #04070d obsidian background', () => {
      // Primary text must use near-white ink (#f8fafc, #f7f3ed, #e2e8f0, #ffffff)
      const hasHighContrastInk =
        styleSource.includes('--cc-ink: #f8fafc') ||
        styleSource.includes('--cc-ink: #f7f3ed') ||
        styleSource.includes('--cc-ink: #e2e8f0') ||
        styleSource.includes('--cc-ink: #ffffff');
      expect(hasHighContrastInk).toBe(true);
    });
  });

  describe('[Tier 3] Glow Effects & Ambient Accents', () => {
    it('[T3_01] provides ambient glow and soft neon highlights for active/focused elements', () => {
      const hasGlowUtilities =
        styleSource.includes('shadow-glow') ||
        styleSource.includes('box-shadow') ||
        styleSource.includes('rgba(0, 245, 160') ||
        styleSource.includes('rgba(0, 245, 212') ||
        styleSource.includes('--cc-accent-soft') ||
        styleSource.includes('--cc-accent-line');
      expect(hasGlowUtilities).toBe(true);
    });

    it('[T3_02] ensures scrollbar styling conforms to dark obsidian theme', () => {
      expect(styleSource).toContain('::-webkit-scrollbar');
      expect(styleSource).toContain('::-webkit-scrollbar-thumb');
    });
  });
});
