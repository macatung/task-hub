import { describe, expect, it } from 'vitest';
import source from './SettingsPanel.vue?raw';

describe('SettingsPanel CAO orchestrator configuration and diagnostics', () => {
  it('accepts caoStatus and caoReconnecting props', () => {
    expect(source).toContain('caoStatus: {');
    expect(source).toContain('caoReconnecting?: boolean');
  });

  it('renders CAO Multi-Agent Orchestrator section with tri-state status badge', () => {
    expect(source).toContain('CAO Multi-Agent Orchestrator');
    expect(source).toContain('Reconnecting…');
    expect(source).toContain('Active (CAO required)');
    expect(source).toContain('Blocked (CAO unavailable)');
  });

  it('displays detailed backend port and daemon source metadata', () => {
    expect(source).toContain('Orchestrator Backend:');
    expect(source).toContain('Daemon Source:');
    expect(source).toContain('CLI Executable:');
  });

  it('provides troubleshooting instructions when CAO is unavailable', () => {
    expect(source).toContain('Hướng dẫn khắc phục sự cố CAO (Troubleshooting):');
    expect(source).toContain('cao-server --port 9889');
  });

  it('disables restart button with loading label while reconnecting', () => {
    expect(source).toContain(':disabled="caoReconnecting || caoStatus?.reconnecting"');
    expect(source).toContain("(caoReconnecting || caoStatus?.reconnecting) ? 'Restarting…' : 'Restart CAO daemon'");
    expect(source).toContain("@click=\"emit('restartCao')\"");
  });
});
