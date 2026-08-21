import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApi', {
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.send('window-set-always-on-top', alwaysOnTop),
  moveWindow: (dx: number, dy: number) => ipcRenderer.send('window-move-by', { dx, dy }),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('window-resize', { width, height }),
  toggleFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window-toggle-fullscreen', fullscreen),
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
    getCredential: () => ipcRenderer.invoke('taskhub-credential-get'),
    saveCredential: (credential: { taskHubUrl: string; token: string; projectId: string; projectTitle?: string }) => ipcRenderer.invoke('taskhub-credential-save', credential),
    clearCredential: () => ipcRenderer.invoke('taskhub-credential-clear'),
    startPairing: (taskHubUrl: string, projectId?: number | null) => ipcRenderer.invoke('taskhub-pairing-start', { taskHubUrl, projectId }),
    pollPairing: (taskHubUrl: string, pairingId: string, deviceSecret: string) => ipcRenderer.invoke('taskhub-pairing-status', { taskHubUrl, pairingId, deviceSecret }),
    mcpCall: (taskHubUrl: string, token: string, projectId: string, method: string, params?: Record<string, any>) => ipcRenderer.invoke('taskhub-mcp-call', { taskHubUrl, token, projectId, method, params }),
    importGeneratedDocuments: (taskHubUrl: string, token: string, projectId: string, payload: { manifest: string; documents: Array<{ path: string; content: string }> }) => ipcRenderer.invoke('taskhub-documents-import-generated', { taskHubUrl, token, projectId, payload }),
    getCapabilities: (taskHubUrl: string) => ipcRenderer.invoke('taskhub-capabilities', taskHubUrl),
  },
  agent: {
    pickWorkspace: () => ipcRenderer.invoke('agent-pick-workspace'),
    listWorkspaces: () => ipcRenderer.invoke('agent-list-workspaces'),
    saveWorkspace: (cwd: string) => ipcRenderer.invoke('agent-save-workspace', cwd),
    removeWorkspace: (cwd: string) => ipcRenderer.invoke('agent-remove-workspace', cwd),
    preflight: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-preflight', { provider, cwd }),
    quickSetup: (cwd: string, installDependencies = true) => ipcRenderer.invoke('agent-quick-setup', { cwd, installDependencies }),
    createWorktree: (repository: string, issueKey: string) => ipcRenderer.invoke('agent-create-worktree', { repository, issueKey }),
    openWorkspace: (cwd: string) => ipcRenderer.invoke('agent-open-workspace', cwd),
    cleanupWorktree: (repository: string, worktree: string) => ipcRenderer.invoke('agent-cleanup-worktree', { repository, worktree }),
    readGeneratedDocuments: (worktree: string) => ipcRenderer.invoke('agent-read-generated-documents', worktree),
    applyDocsToWorkspace: (worktree: string, destinationWorkspace: string) => ipcRenderer.invoke('agent-apply-docs-to-workspace', { worktree, destinationWorkspace }),
    configureMcp: (options: { cwd: string; provider: string; taskHubUrl: string; projectId: string; token: string }) => ipcRenderer.invoke('agent-configure-mcp', options),
    start: (provider: string, cwd: string, prompt?: string) => ipcRenderer.invoke('agent-start', { provider, cwd, prompt }),
    startInteractive: (provider: string, cwd: string, prompt?: string, kind: 'task' | 'docs' = 'task') => ipcRenderer.invoke('agent-start-interactive', { provider, cwd, prompt, kind }),
    listSessions: () => ipcRenderer.invoke('agent-list-sessions'),
    saveSessionState: (state: any) => ipcRenderer.invoke('agent-save-session-state', state),
    listSavedSessions: () => ipcRenderer.invoke('agent-list-saved-sessions'),
    getSessionState: (sessionId: string) => ipcRenderer.invoke('agent-get-session-state', sessionId),
    deleteSavedSession: (sessionId: string) => ipcRenderer.invoke('agent-delete-session', sessionId),
    openSessionLog: (sessionId: string) => ipcRenderer.invoke('agent-open-session-log', sessionId),
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
