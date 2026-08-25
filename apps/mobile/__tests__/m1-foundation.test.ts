import { colors } from '../src/theme/colors';
import { spacing, borderRadius } from '../src/theme';
import { env, normalizeApiUrl } from '../src/config/env';

describe('Milestone 1 Core Foundation Tests', () => {
  describe('Design Tokens & Color Theme', () => {
    it('defines complete midnight color palette matching Task Hub SaaS dark theme', () => {
      expect(colors.midnight[950]).toBe('#04070d');
      expect(colors.midnight[900]).toBe('#070b14');
      expect(colors.midnight[850]).toBe('#0c1220');
      expect(colors.midnight[800]).toBe('#11182c');
      expect(colors.midnight[700]).toBe('#1a233d');
    });

    it('defines talisman accent palette', () => {
      expect(colors.talisman.yellow).toBe('#ffd166');
      expect(colors.talisman.gold).toBe('#f59e0b');
      expect(colors.talisman.cinnabar).toBe('#e63946');
    });

    it('defines phantom telemetry and highlight palette', () => {
      expect(colors.phantom.cyan).toBe('#00f5d4');
      expect(colors.phantom.mint).toBe('#00f5a0');
      expect(colors.phantom.blue).toBe('#00bbf9');
      expect(colors.phantom.purple).toBe('#9d4edd');
      expect(colors.phantom.blood).toBe('#ff0054');
    });

    it('defines Scrum issue type token hierarchy', () => {
      expect(colors.issueType.epic).toBe('#9d4edd');
      expect(colors.issueType.story).toBe('#00f5a0');
      expect(colors.issueType.task).toBe('#00bbf9');
      expect(colors.issueType.bug).toBe('#ff0054');
    });

    it('exports spacing and border radius constants', () => {
      expect(spacing.md).toBe(16);
      expect(borderRadius.lg).toBe(12);
    });
  });

  describe('Environment Configuration', () => {
    it('normalizes URL protocols and trailing slashes', () => {
      expect(normalizeApiUrl('http://localhost:8000/')).toBe('http://localhost:8000');
      expect(normalizeApiUrl('localhost:8000')).toBe('http://localhost:8000');
      expect(normalizeApiUrl('https://api.taskhub.dev///')).toBe('https://api.taskhub.dev');
    });

    it('provides sensible environment defaults', () => {
      expect(env.appName).toBe('Task Hub');
      expect(env.defaultTimeoutMs).toBe(15000);
      expect(env.sseReconnectIntervalMs).toBe(2000);
      expect(env.maxSseReconnectAttempts).toBe(10);
    });
  });
});
