import { describe, expect, it } from 'vitest';
import headerSource from './ConnectionBar.vue?raw';
import footerSource from './StatusFooter.vue?raw';
import controlCenterSource from '../../views/ControlCenter.vue?raw';
import preloadSource from '../../../electron/preload.ts?raw';
import mainSource from '../../../electron/main.ts?raw';

describe('Control Center application chrome', () => {
  it('keeps primary workspace actions visible and moves secondary actions to an overflow menu', () => {
    expect(headerSource).toContain('New requirement');
    expect(headerSource).toContain('cc-overflow-menu');
    expect(headerSource).toContain('Scan repo docs');
    expect(headerSource).toContain('Open Hub');
    expect(headerSource).toContain('triggerOverflowAction');
    expect(headerSource).toContain("overflowMenu.value?.removeAttribute('open')");
  });

  it('exposes accessible window controls from the frameless title bar', () => {
    expect(headerSource).toContain('aria-label="Minimize"');
    expect(headerSource).toContain("isMaximized ? 'Restore window' : 'Maximize window'");
    expect(headerSource).toContain('aria-label="Close"');
    expect(headerSource).toContain("$emit('minimize')");
    expect(headerSource).toContain("$emit('maximize')");
    expect(controlCenterSource).toContain('@minimize="minimize"');
    expect(controlCenterSource).toContain('@maximize="maximize"');
    expect(controlCenterSource).toContain(':is-maximized="isMaximized"');
    expect(preloadSource).toContain("toggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize')");
    expect(mainSource).toContain("ipcMain.handle('window-toggle-maximize'");
  });

  it('renders an operational status footer with connection, provider, location, run state and version', () => {
    expect(footerSource).toContain('Hub connected');
    expect(footerSource).toContain('Hub offline');
    expect(footerSource).toContain('Hub not connected');
    expect(footerSource).toContain('locationLabel()');
    expect(footerSource).toContain('runLabel()');
    expect(footerSource).toContain('appVersion');
    expect(controlCenterSource).toContain('<StatusFooter');
    expect(controlCenterSource).toContain(':worktree="worktree"');
  });
});
