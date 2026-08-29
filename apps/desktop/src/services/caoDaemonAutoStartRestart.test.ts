import { describe, expect, it } from 'vitest';
import electronMainSource from '../../electron/main.ts?raw';
import preloadSource from '../../electron/preload.ts?raw';
import controlCenterSource from '../views/ControlCenter.vue?raw';

describe('CAO Daemon Startup & Restart Reliability', () => {
  it('detects python-executed cao-server using pgrep -f in inspectCaoPortOwner and readCaoServerPid', () => {
    expect(electronMainSource).toContain('pgrep -f cao-server');
  });

  it('explicitly binds cao-server to 0.0.0.0 and target port for Windows/WSL2 accessibility', () => {
    expect(electronMainSource).toContain('exec cao-server --host 0.0.0.0 --port ${port}');
    expect(electronMainSource).toContain("['--host', '0.0.0.0', '--port', String(port)]");
  });

  it('captures stderr and errors from caoDaemonProcess for runtime diagnostics', () => {
    expect(electronMainSource).toContain('caoDaemonProcess.stderr');
    expect(electronMainSource).toContain('caoRuntimeStatus.lastError = err.message');
  });

  it('broadcasts cao-status-updated upon startup and restart to renderers', () => {
    expect(electronMainSource).toContain("safeSend(win, 'cao-status-updated', status)");
    expect(preloadSource).toContain('onStatusUpdated: (callback: (status: any) => void)');
    expect(preloadSource).toContain("ipcRenderer.on('cao-status-updated', listener)");
  });

  it('performs pkill -f cao-server during restart flow to free lingering ports', () => {
    expect(electronMainSource).toContain('pkill -f cao-server');
  });

  it('automatically triggers CAO daemon startup and verifies status on Desktop App launch', () => {
    expect(electronMainSource).toContain('void startCaoDaemon()');
    expect(controlCenterSource).toContain('caoStatus.value?.available !== true && caoStatus.value?.running !== true');
    expect(controlCenterSource).toContain('void restartCao()');
    expect(controlCenterSource).toContain('desktopApi?.cao?.onStatusUpdated');
  });

  it('handles restart failure gracefully with operator notifications in UI', () => {
    expect(controlCenterSource).toContain("res?.status === 'error'");
    expect(controlCenterSource).toContain('title: "CAO daemon chưa sẵn sàng"');
    expect(controlCenterSource).toContain('CAO daemon đã sẵn sàng');
  });
});

