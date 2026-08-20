import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApi', {
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.send('window-set-always-on-top', alwaysOnTop),
  moveWindow: (dx: number, dy: number) => ipcRenderer.send('window-move-by', { dx, dy }),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('window-resize', { width, height }),
  setIgnoreMouseEvents: (ignore: boolean, forward: boolean) => ipcRenderer.send('window-ignore-mouse-events', { ignore, forward }),
  onTrayAction: (callback: (action: string) => void) => {
    ipcRenderer.on('tray-action', (_event, action) => callback(action));
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  updater: {
    getState: () => ipcRenderer.invoke('updater-get-state'),
    check: () => ipcRenderer.invoke('updater-check'),
    install: () => ipcRenderer.invoke('updater-install'),
    dismiss: () => ipcRenderer.invoke('updater-dismiss'),
    onState: (callback: (state: { status: string; version?: string; percent?: number; message?: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: { status: string; version?: string; percent?: number; message?: string }) => callback(state);
      ipcRenderer.on('updater-state', listener);
      return () => ipcRenderer.removeListener('updater-state', listener);
    },
  },
  taskHub: {
    startPairing: (taskHubUrl: string, projectId: number) => ipcRenderer.invoke('taskhub-pairing-start', { taskHubUrl, projectId }),
    pollPairing: (taskHubUrl: string, pairingId: string, deviceSecret: string) => ipcRenderer.invoke('taskhub-pairing-status', { taskHubUrl, pairingId, deviceSecret }),
    mcpCall: (taskHubUrl: string, token: string, projectId: string, method: string, params?: Record<string, any>) => ipcRenderer.invoke('taskhub-mcp-call', { taskHubUrl, token, projectId, method, params }),
    getCapabilities: (taskHubUrl: string) => ipcRenderer.invoke('taskhub-capabilities', taskHubUrl),
  },
  agent: {
    pickWorkspace: () => ipcRenderer.invoke('agent-pick-workspace'),
    preflight: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-preflight', { provider, cwd }),
    createWorktree: (repository: string, issueKey: string) => ipcRenderer.invoke('agent-create-worktree', { repository, issueKey }),
    openWorkspace: (cwd: string) => ipcRenderer.invoke('agent-open-workspace', cwd),
    cleanupWorktree: (repository: string, worktree: string) => ipcRenderer.invoke('agent-cleanup-worktree', { repository, worktree }),
    configureMcp: (options: { cwd: string; provider: string; taskHubUrl: string; projectId: string; token: string }) => ipcRenderer.invoke('agent-configure-mcp', options),
    start: (provider: string, cwd: string, prompt?: string) => ipcRenderer.invoke('agent-start', { provider, cwd, prompt }),
    startInteractive: (provider: string, cwd: string, prompt?: string) => ipcRenderer.invoke('agent-start-interactive', { provider, cwd, prompt }),
    send: (sessionId: string, input: string) => ipcRenderer.send('agent-input', { sessionId, input }),
    stop: (sessionId: string) => ipcRenderer.invoke('agent-stop', sessionId),
    onOutput: (callback: (event: { sessionId: string; stream: string; text: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; stream: string; text: string }) => callback(payload);
      ipcRenderer.on('agent-output', listener);
      return () => ipcRenderer.removeListener('agent-output', listener);
    },
    onExit: (callback: (event: { sessionId: string; code: number | null; signal: string | null }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; code: number | null; signal: string | null }) => callback(payload);
      ipcRenderer.on('agent-exit', listener);
      return () => ipcRenderer.removeListener('agent-exit', listener);
    },
  },
});
