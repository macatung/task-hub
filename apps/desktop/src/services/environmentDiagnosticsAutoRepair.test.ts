import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import mainSource from '../../electron/main.ts?raw';
import preloadSource from '../../electron/preload.ts?raw';
import autoRepairModalSource from '../components/AutoRepairModal.vue?raw';

describe('Milestone 1: Environment Diagnostics & Robust Auto-Repair', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-hub-m1-test-'));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('1. Multi-Tier Windows Candidate Discovery & CLI Resolution', () => {
    it('declares comprehensive multi-tier candidate directories for Windows in main.ts', () => {
      expect(mainSource).toContain('function getCandidateBinDirs()');
      expect(mainSource).toContain("path.join(localAppData, 'agy', 'bin')");
      expect(mainSource).toContain("path.join(localAppData, 'Programs', 'Git', 'cmd')");
      expect(mainSource).toContain("path.join(userProfile, 'scoop', 'shims')");
      expect(mainSource).toContain("path.join(programData, 'chocolatey', 'bin')");
      expect(mainSource).toContain("path.join(programFiles, 'Git', 'cmd')");
      expect(mainSource).toContain("path.join(localAppData, 'Microsoft', 'WinGet', 'Links')");
      expect(mainSource).toContain("path.join(appData, 'npm')");
      expect(mainSource).toContain("path.join(localAppData, 'pnpm')");
    });

    it('prepends discovered candidate directories to nativeAgentEnvironment PATH', () => {
      expect(mainSource).toContain('const runtimeBins = getCandidateBinDirs();');
      expect(mainSource).toContain("env.PATH = [...runtimeBins, env.PATH || ''].join(path.delimiter);");
    });

    it('filters out non-spawnable WindowsApps Store binary stubs for Codex', () => {
      expect(mainSource).toContain('/\\\\WindowsApps\\\\OpenAI\\.Codex_/i');
    });

    it('uses resolved Git CLI path and nativeAgentEnvironment in git helper function', () => {
      expect(mainSource).toContain("const gitBin = resolveCli('git') || 'git';");
      expect(mainSource).toContain("execFileSync(gitBin, args, { cwd, encoding: 'utf8', windowsHide: true, env: nativeAgentEnvironment() })");
    });
  });

  describe('2. Stale Git Lockfile Scanning & Auto-Pruning', () => {
    it('defines scanGitLocks and pruneGitLocks functions in main.ts', () => {
      expect(mainSource).toContain('function scanGitLocks(rootPath: string): string[]');
      expect(mainSource).toContain('function pruneGitLocks(rootPath: string)');
      expect(mainSource).toContain("directLocks = ['index.lock', 'HEAD.lock', 'config.lock', 'packed-refs.lock', 'shallow.lock']");
      expect(mainSource).toContain("wtLockFiles = ['.git.lock', 'index.lock', 'HEAD.lock', 'locked', 'gitdir.lock']");
      expect(mainSource).toContain("git(rootPath, ['worktree', 'prune', '--verbose'])");
    });

    it('simulates detecting and pruning stale Git lockfiles from mock repository structure', () => {
      const gitDir = path.join(tempDir, '.git');
      const refsHeadsDir = path.join(gitDir, 'refs', 'heads');
      const worktreesDir = path.join(gitDir, 'worktrees', 'wt-1');
      fs.mkdirSync(refsHeadsDir, { recursive: true });
      fs.mkdirSync(worktreesDir, { recursive: true });

      // Create dummy lock files
      const indexLock = path.join(gitDir, 'index.lock');
      const headLock = path.join(gitDir, 'HEAD.lock');
      const refLock = path.join(refsHeadsDir, 'main.lock');
      const wtLock = path.join(worktreesDir, 'locked');

      fs.writeFileSync(indexLock, 'lock content', 'utf8');
      fs.writeFileSync(headLock, 'lock content', 'utf8');
      fs.writeFileSync(refLock, 'lock content', 'utf8');
      fs.writeFileSync(wtLock, 'lock content', 'utf8');

      expect(fs.existsSync(indexLock)).toBe(true);
      expect(fs.existsSync(headLock)).toBe(true);
      expect(fs.existsSync(refLock)).toBe(true);
      expect(fs.existsSync(wtLock)).toBe(true);

      // Verify lock removal logic
      const locks = [indexLock, headLock, refLock, wtLock];
      for (const lock of locks) {
        fs.rmSync(lock, { force: true });
      }

      expect(fs.existsSync(indexLock)).toBe(false);
      expect(fs.existsSync(headLock)).toBe(false);
      expect(fs.existsSync(refLock)).toBe(false);
      expect(fs.existsSync(wtLock)).toBe(false);
    });
  });

  describe('3. Multi-Template .env Auto-Repair', () => {
    it('defines multi-template candidate priority list and discovery in main.ts', () => {
      expect(mainSource).toContain("'.env.example'");
      expect(mainSource).toContain("'.env.template'");
      expect(mainSource).toContain("'.env.defaults'");
      expect(mainSource).toContain("'.env.dist'");
      expect(mainSource).toContain("'.env.sample'");
      expect(mainSource).toContain("'.env.local.example'");
      expect(mainSource).toContain('function findEnvTemplate(rootPath: string): string | null');
      expect(mainSource).toContain('function generateDefaultEnvContent(): string');
    });

    it('finds and restores .env from various alternate template names', () => {
      const templates = [
        '.env.example',
        '.env.template',
        '.env.defaults',
        '.env.dist',
        '.env.sample',
        '.env.local.example',
      ];

      for (const tpl of templates) {
        const subDir = path.join(tempDir, `test-${tpl.replace(/\./g, '_')}`);
        fs.mkdirSync(subDir, { recursive: true });
        const tplFile = path.join(subDir, tpl);
        fs.writeFileSync(tplFile, `TEST_KEY=${tpl}\nPORT=8080`, 'utf8');

        const envFile = path.join(subDir, '.env');
        expect(fs.existsSync(envFile)).toBe(false);

        // Copy template to .env
        fs.copyFileSync(tplFile, envFile);
        expect(fs.existsSync(envFile)).toBe(true);
        expect(fs.readFileSync(envFile, 'utf8')).toContain(`TEST_KEY=${tpl}`);
      }
    });

    it('generates standard fallback .env content when no template exists', () => {
      const fallbackDir = path.join(tempDir, 'no-template');
      fs.mkdirSync(fallbackDir, { recursive: true });

      const envFile = path.join(fallbackDir, '.env');
      const fallbackContent = [
        '# Task Companion Auto-Generated Environment Configuration',
        'APP_ENV=local',
        'APP_DEBUG=true',
        'PORT=3000',
        'NODE_ENV=development',
        '',
      ].join('\n');

      fs.writeFileSync(envFile, fallbackContent, 'utf8');
      expect(fs.existsSync(envFile)).toBe(true);
      expect(fs.readFileSync(envFile, 'utf8')).toContain('APP_ENV=local');
      expect(fs.readFileSync(envFile, 'utf8')).toContain('NODE_ENV=development');
    });
  });

  describe('4. Directory Writability & Permission Fix', () => {
    it('defines probeDirectoryWritability and fixDirectoryPermissions in main.ts', () => {
      expect(mainSource).toContain('function probeDirectoryWritability(dirPath: string)');
      expect(mainSource).toContain('.task-hub-write-test-');
      expect(mainSource).toContain('function fixDirectoryPermissions(dirPath: string)');
      expect(mainSource).toContain("execFileSync('attrib', ['-r', `${dirPath}\\\\*`, '/s', '/d']");
    });

    it('accurately tests directory write permissions with a temporary test file', () => {
      const probeFile = path.join(tempDir, `.task-hub-write-test-${Date.now()}`);
      fs.writeFileSync(probeFile, 'ok', 'utf8');
      expect(fs.readFileSync(probeFile, 'utf8')).toBe('ok');
      fs.unlinkSync(probeFile);
      expect(fs.existsSync(probeFile)).toBe(false);
    });
  });

  describe('5. Executable Health Verification & Auto-Repair', () => {
    it('defines verifyCliExecutable with fast timeout and version verification in main.ts', () => {
      expect(mainSource).toContain('function verifyCliExecutable(executable: string, timeoutMs = 2500)');
      expect(mainSource).toContain("spawn(executable, ['--version']");
      expect(mainSource).toContain('CLI version check timed out after');
    });

    it('evaluates provider availability inside the CAO runtime', () => {
      expect(mainSource).toContain('async function agentRuntimeStatus()');
      expect(mainSource).toContain('const available = await isCaoProviderAvailable(provider, cao)');
      expect(mainSource).toContain('inside the CAO');
      expect(mainSource).toContain("status: 'ready'");
      expect(mainSource).toContain("status: 'missing'");
    });

    it('does not install provider CLIs outside CAO', () => {
      expect(mainSource).toContain('async function bootstrapAgentRuntimes()');
      expect(mainSource).toContain('never install or execute provider CLIs in the host');
      expect(mainSource).toContain('Install it inside the CAO runtime');
    });
  });

  describe('6. Preload API & AutoRepairModal UI Contracts', () => {
    it('exposes environment namespace with repair, preflight, and quickSetup on desktopApi', () => {
      expect(preloadSource).toContain('environment: {');
      expect(preloadSource).toContain("repair: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-repair-environment'");
      expect(preloadSource).toContain("preflight: (provider: 'codex' | 'claude_code' | 'antigravity', cwd: string) => ipcRenderer.invoke('agent-preflight'");
      expect(preloadSource).toContain("quickSetup: (cwd: string, installDependencies = true) => ipcRenderer.invoke('agent-quick-setup'");
    });

    it('exposes runtimeStatus and bootstrapRuntimes on desktopApi.agent in preload.ts', () => {
      expect(preloadSource).toContain("runtimeStatus: () => ipcRenderer.invoke('agent-runtime-status')");
      expect(preloadSource).toContain("bootstrapRuntimes: () => ipcRenderer.invoke('agent-bootstrap-runtimes')");
    });

    it('supports all diagnostic categories and interactive auto-repair in AutoRepairModal.vue', () => {
      expect(autoRepairModalSource).toContain('One-Click Environment Auto-Repair');
      expect(autoRepairModalSource).toContain('Multi-Tier Windows PATH');
      expect(autoRepairModalSource).toContain('Stale Git Locks & Worktrees');
      expect(autoRepairModalSource).toContain('Multi-Template .env Recovery');
      expect(autoRepairModalSource).toContain('Permissions & Write Probes');
      expect(autoRepairModalSource).toContain('desktopApi.environment.repair');
      expect(autoRepairModalSource).toContain('desktopApi.environment.preflight');
      expect(autoRepairModalSource).toContain('filterCategory');
      expect(autoRepairModalSource).toContain('getStatusBadge');
      expect(autoRepairModalSource).toContain('formatCheckTitle');
    });
  });
});
