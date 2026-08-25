import { contextBridge, ipcRenderer } from 'electron';

function safeClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  try {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return undefined;
        seen.add(val);
      }
      if (typeof val === 'function' || typeof val === 'symbol') return undefined;
      if (typeof val === 'bigint') return val.toString();
      if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack };
      return val;
    }));
  } catch {
    return {} as any;
  }
}

contextBridge.exposeInMainWorld('desktopApi', {
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.send('window-set-always-on-top', safeClone(alwaysOnTop)),
  moveWindow: (dx: number, dy: number) => ipcRenderer.send('window-move-by', safeClone({ dx, dy })),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('window-resize', safeClone({ width, height })),
  toggleFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window-toggle-fullscreen', safeClone(fullscreen)),
  setIgnoreMouseEvents: (ignore: boolean, forward: boolean) => ipcRenderer.send('window-ignore-mouse-events', safeClone({ ignore, forward })),
  getAppMode: () => ipcRenderer.invoke('app-get-mode'),
  setAppMode: (mode: 'ide' | 'mascot') => ipcRenderer.invoke('app-set-mode', safeClone(mode)),
  toggleAppMode: () => ipcRenderer.invoke('app-toggle-mode'),
  getSystemInfo: () => ipcRenderer.invoke('app-get-system-info'),
  onAppModeChange: (callback: (mode: 'ide' | 'mascot') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: 'ide' | 'mascot') => callback(mode);
    ipcRenderer.on('app-mode-changed', listener);
    return () => ipcRenderer.removeListener('app-mode-changed', listener);
  },
  onTrayAction: (callback: (action: string) => void) => {
    ipcRenderer.on('tray-action', (_event, action) => callback(action));
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', safeClone(url)),
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
    saveCredential: (credential: { taskHubUrl: string; token: string; projectId: string; projectTitle?: string }) => ipcRenderer.invoke('taskhub-credential-save', safeClone(credential)),
    clearCredential: () => ipcRenderer.invoke('taskhub-credential-clear'),
    startPairing: (taskHubUrl: string, projectId?: number | null) => ipcRenderer.invoke('taskhub-pairing-start', safeClone({ taskHubUrl, projectId })),
    pollPairing: (taskHubUrl: string, pairingId: string, deviceSecret: string) => ipcRenderer.invoke('taskhub-pairing-status', safeClone({ taskHubUrl, pairingId, deviceSecret })),
    mcpCall: (taskHubUrl: string, token: string, projectId: string, method: string, params?: Record<string, any>) => ipcRenderer.invoke('taskhub-mcp-call', safeClone({ taskHubUrl, token, projectId, method, params })),
    importGeneratedDocuments: (taskHubUrl: string, token: string, projectId: string, payload: { manifest: string; documents: Array<{ path: string; content: string }> }) => ipcRenderer.invoke('taskhub-documents-import-generated', safeClone({ taskHubUrl, token, projectId, payload })),
    getCapabilities: (taskHubUrl: string) => ipcRenderer.invoke('taskhub-capabilities', safeClone(taskHubUrl)),
  },
  agent: {
    getLocalRouter: () => ipcRenderer.invoke('agent-router-get'),
    saveLocalRouter: (config: { enabled: boolean; apiKey?: string }) => ipcRenderer.invoke('agent-router-save', safeClone(config)),
    clearLocalRouter: () => ipcRenderer.invoke('agent-router-clear'),
    checkLocalRouter: (includeModels = false) => ipcRenderer.invoke('agent-router-check', safeClone({ includeModels })),
    openLocalRouterDashboard: () => ipcRenderer.invoke('agent-router-open-dashboard'),
    codexDiagnostics: () => ipcRenderer.invoke('agent-codex-diagnostics'),
    pickWorkspace: () => ipcRenderer.invoke('agent-pick-workspace'),
    listWorkspaces: () => ipcRenderer.invoke('agent-list-workspaces'),
    saveWorkspace: (cwd: string) => ipcRenderer.invoke('agent-save-workspace', safeClone(cwd)),
    removeWorkspace: (cwd: string) => ipcRenderer.invoke('agent-remove-workspace', safeClone(cwd)),
    preflight: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-preflight', safeClone({ provider, cwd })),
    quickSetup: (cwd: string, installDependencies = true) => ipcRenderer.invoke('agent-quick-setup', safeClone({ cwd, installDependencies })),
    repairEnvironment: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-repair-environment', safeClone({ provider, cwd })),
    createWorktree: (repository: string, issueKey: string) => ipcRenderer.invoke('agent-create-worktree', safeClone({ repository, issueKey })),
    openWorkspace: (cwd: string) => ipcRenderer.invoke('agent-open-workspace', safeClone(cwd)),
    cleanupWorktree: (repository: string, worktree: string) => ipcRenderer.invoke('agent-cleanup-worktree', safeClone({ repository, worktree })),
    runTest: (options: { cwd: string; command?: string }) => ipcRenderer.invoke('agent-run-test', safeClone(options)),
    readGeneratedDocuments: (worktree: string) => ipcRenderer.invoke('agent-read-generated-documents', safeClone(worktree)),
    applyDocsToWorkspace: (worktree: string, destinationWorkspace: string) => ipcRenderer.invoke('agent-apply-docs-to-workspace', safeClone({ worktree, destinationWorkspace })),
    configureMcp: (options: { cwd: string; provider: string; taskHubUrl: string; projectId: string; token: string }) => ipcRenderer.invoke('agent-configure-mcp', safeClone(options)),
    start: (provider: string, cwd: string, prompt?: string, model?: string) => ipcRenderer.invoke('agent-start', safeClone({ provider, cwd, prompt, model })),
    startInteractive: (provider: string, cwd: string, prompt?: string, kind: 'task' | 'docs' = 'task', model?: string, executionPolicy: 'restricted' | 'workspace_write' | 'full_access' = 'workspace_write') => ipcRenderer.invoke('agent-start-interactive', safeClone({ provider, cwd, prompt, kind, model, executionPolicy })),
    listAvailableModels: (provider?: string, options?: { forceRefresh?: boolean; taskHubUrl?: string }) => ipcRenderer.invoke('agent-list-available-models', safeClone({ provider, options })),
    saveCustomModel: (provider: string, model: { id: string; name?: string; badges?: string[]; description?: string }) => ipcRenderer.invoke('agent-save-custom-model', safeClone({ provider, model })),
    deleteCustomModel: (provider: string, modelId: string) => ipcRenderer.invoke('agent-delete-custom-model', safeClone({ provider, modelId })),
    getQuotaUsage: () => ipcRenderer.invoke('agent-get-quota-usage'),
    syncQuotaUsage: (taskHubUrl?: string) => ipcRenderer.invoke('agent-sync-quota-usage', safeClone({ taskHubUrl })),
    updateQuotaSettings: (settings: { enableCreditOverages?: boolean; plan?: string }) => ipcRenderer.invoke('agent-update-quota-settings', safeClone(settings)),
    listSessions: () => ipcRenderer.invoke('agent-list-sessions'),
    saveSessionState: (state: any) => ipcRenderer.invoke('agent-save-session-state', safeClone(state)),
    listSavedSessions: () => ipcRenderer.invoke('agent-list-saved-sessions'),
    getSessionState: (sessionId: string) => ipcRenderer.invoke('agent-get-session-state', safeClone(sessionId)),
    deleteSavedSession: (sessionId: string) => ipcRenderer.invoke('agent-delete-session', safeClone(sessionId)),
    openSessionLog: (sessionId: string) => ipcRenderer.invoke('agent-open-session-log', safeClone(sessionId)),
    logActivity: (cwd: string, sessionId: string | null, activity: { label: string; detail: string; tone: string }) => ipcRenderer.invoke('agent-log-activity', safeClone({ cwd, sessionId, activity })),
    readFile: (cwd: string, relativePath: string) => ipcRenderer.invoke('workspace-read-file', safeClone({ cwd, relativePath })),
    listFiles: (cwd: string, maxFiles?: number) => ipcRenderer.invoke('workspace-list-files', safeClone({ cwd, maxFiles })),
    getGitDiff: (cwd: string) => ipcRenderer.invoke('workspace-get-git-diff', safeClone({ cwd })),
    revertFile: (cwd: string, relativePath: string) => ipcRenderer.invoke('workspace-revert-file', safeClone({ cwd, relativePath })),
    stageFile: (cwd: string, relativePath: string) => ipcRenderer.invoke('workspace-stage-file', safeClone({ cwd, relativePath })),
    listSkills: (workspacePath?: string) => ipcRenderer.invoke('agent-list-skills', safeClone({ workspacePath })),
    readSkill: (skillPath: string) => ipcRenderer.invoke('agent-read-skill', safeClone({ skillPath })),
    listMcpServers: () => ipcRenderer.invoke('agent-list-mcp-servers'),
    listRules: (workspacePath?: string) => ipcRenderer.invoke('agent-list-rules', safeClone({ workspacePath })),
    listScheduledTasks: () => ipcRenderer.invoke('agent-list-scheduled-tasks'),
    createSchedule: (task: any) => ipcRenderer.invoke('agent-create-schedule', safeClone(task)),
    cancelSchedule: (id: string) => ipcRenderer.invoke('agent-cancel-schedule', safeClone({ id })),
    getPermissions: () => ipcRenderer.invoke('agent-get-permissions'),
    savePermissions: (perms: any) => ipcRenderer.invoke('agent-save-permissions', safeClone(perms)),
    send: (sessionId: string, input: string) => ipcRenderer.send('agent-input', safeClone({ sessionId, input })),
    stop: (sessionId: string) => ipcRenderer.invoke('agent-stop', safeClone(sessionId)),
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
    onQuotaUpdated: (callback: (quota: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
      ipcRenderer.on('agent-quota-updated', listener);
      return () => ipcRenderer.removeListener('agent-quota-updated', listener);
    },
  },
});
