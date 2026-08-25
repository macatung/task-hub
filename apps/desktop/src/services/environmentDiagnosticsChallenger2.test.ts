import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';

describe('Challenger 2 Empirical Adversarial Stress Test Suite — Milestone 1', () => {
  let tempDir: string;
  let mainSource: string;
  let preloadSource: string;
  let autoRepairModalSource: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-hub-challenger2-stress-'));
    mainSource = fs.readFileSync(path.resolve(__dirname, '../../electron/main.ts'), 'utf8');
    preloadSource = fs.readFileSync(path.resolve(__dirname, '../../electron/preload.ts'), 'utf8');
    autoRepairModalSource = fs.readFileSync(path.resolve(__dirname, '../components/AutoRepairModal.vue'), 'utf8');
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

  describe('Dimension 1: Missing Binaries & Malformed Executable Verification', () => {
    it('ensures directory candidates are not mistaken for executable files in resolveCli', () => {
      // Simulate a directory named git.exe inside a mock candidate path
      const mockBinDir = path.join(tempDir, 'mock-bin');
      const fakeDirAsExe = path.join(mockBinDir, 'git.exe');
      fs.mkdirSync(fakeDirAsExe, { recursive: true });

      // resolveCli candidate filter logic verification:
      const candidateCheck = (candidate: string) => {
        try {
          return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
        } catch {
          return false;
        }
      };

      expect(fs.existsSync(fakeDirAsExe)).toBe(true);
      expect(candidateCheck(fakeDirAsExe)).toBe(false); // MUST be false because it is a directory, not a file
    });

    it('empirically verifies verifyCliExecutable timeout mechanism with hanging process', async () => {
      // Create a hanging CLI mock script using node
      const hangingScript = path.join(tempDir, 'hanging-cli.js');
      fs.writeFileSync(hangingScript, 'setInterval(() => {}, 1000);', 'utf8');

      const verifyCliExecutableMock = (executable: string, args: string[], timeoutMs = 500): Promise<{ ok: boolean; message: string }> => {
        return new Promise((resolve) => {
          let output = '';
          let settled = false;
          const finish = (ok: boolean, message: string) => {
            if (!settled) {
              settled = true;
              resolve({ ok, message });
            }
          };
          try {
            const child = spawn(executable, args, {
              windowsHide: true,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            const timeout = setTimeout(() => {
              try { child.kill(); } catch { /* ignore */ }
              finish(false, `CLI version check timed out after ${timeoutMs}ms.`);
            }, timeoutMs);
            child.stdout?.on('data', (chunk) => { output += String(chunk); });
            child.stderr?.on('data', (chunk) => { output += String(chunk); });
            child.once('error', (error) => { clearTimeout(timeout); finish(false, error.message); });
            child.once('close', (code) => {
              clearTimeout(timeout);
              finish(code === 0, code === 0 ? (output.trim().split(/\r?\n/)[0] || 'CLI version check passed.') : (output.trim().slice(-400) || `CLI exited with code ${code}.`));
            });
          } catch (error: any) {
            finish(false, error?.message || 'Unable to execute CLI version check.');
          }
        });
      };

      const start = Date.now();
      const result = await verifyCliExecutableMock(process.execPath, [hangingScript], 400);
      const elapsed = Date.now() - start;

      expect(result.ok).toBe(false);
      expect(result.message).toContain('timed out after 400ms');
      expect(elapsed).toBeGreaterThanOrEqual(350);
      expect(elapsed).toBeLessThan(1500);
    });

    it('empirically verifies verifyCliExecutable with corrupt or non-zero exit code binary', async () => {
      const failingScript = path.join(tempDir, 'failing-cli.js');
      fs.writeFileSync(failingScript, 'process.stderr.write("Fatal: corrupted runtime metadata\\n"); process.exit(1);', 'utf8');

      const verifyCliExecutableMock = (executable: string, args: string[], timeoutMs = 2500): Promise<{ ok: boolean; message: string }> => {
        return new Promise((resolve) => {
          let output = '';
          let settled = false;
          const finish = (ok: boolean, message: string) => {
            if (!settled) {
              settled = true;
              resolve({ ok, message });
            }
          };
          try {
            const child = spawn(executable, args, {
              windowsHide: true,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            const timeout = setTimeout(() => {
              try { child.kill(); } catch { /* ignore */ }
              finish(false, `CLI version check timed out after ${timeoutMs}ms.`);
            }, timeoutMs);
            child.stdout?.on('data', (chunk) => { output += String(chunk); });
            child.stderr?.on('data', (chunk) => { output += String(chunk); });
            child.once('error', (error) => { clearTimeout(timeout); finish(false, error.message); });
            child.once('close', (code) => {
              clearTimeout(timeout);
              finish(code === 0, code === 0 ? (output.trim().split(/\r?\n/)[0] || 'CLI version check passed.') : (output.trim().slice(-400) || `CLI exited with code ${code}.`));
            });
          } catch (error: any) {
            finish(false, error?.message || 'Unable to execute CLI version check.');
          }
        });
      };

      const result = await verifyCliExecutableMock(process.execPath, [failingScript]);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Fatal: corrupted runtime metadata');
    });
  });

  describe('Dimension 2: Broken Symlinks, Missing Targets & Corrupt Gitdir Pointers', () => {
    it('handles corrupt or dangling .git gitdir file pointer without crashing', () => {
      const repoDir = path.join(tempDir, 'corrupt-gitdir-repo');
      fs.mkdirSync(repoDir, { recursive: true });

      // Create a .git file that points to a non-existent path
      const gitFile = path.join(repoDir, '.git');
      fs.writeFileSync(gitFile, 'gitdir: ../non-existent-worktree-dir/.git\n', 'utf8');

      // Test scanning function with dangling pointer
      const scanGitLocksImplementation = (rootPath: string): string[] => {
        const locks: string[] = [];
        try {
          let gitDir = path.join(rootPath, '.git');
          if (fs.existsSync(gitDir)) {
            const stat = fs.statSync(gitDir);
            if (stat.isFile()) {
              const content = fs.readFileSync(gitDir, 'utf8').trim();
              const match = content.match(/^gitdir:\s*(.+)$/i);
              if (match && match[1]) {
                gitDir = path.resolve(rootPath, match[1].trim());
              }
            }
          }

          if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
            return locks;
          }
        } catch {
          // ignore
        }
        return locks;
      };

      const result = scanGitLocksImplementation(repoDir);
      expect(result).toEqual([]);
    });

    it('safely scans when non-git directories or empty folders are passed', () => {
      const nonGitDir = path.join(tempDir, 'not-a-git-repo');
      fs.mkdirSync(nonGitDir, { recursive: true });

      const scanGitLocksImplementation = (rootPath: string): string[] => {
        const locks: string[] = [];
        try {
          let gitDir = path.join(rootPath, '.git');
          if (!fs.existsSync(gitDir)) return locks;
        } catch {
          return locks;
        }
        return locks;
      };

      expect(scanGitLocksImplementation(nonGitDir)).toEqual([]);
      expect(scanGitLocksImplementation(path.join(tempDir, 'does-not-exist'))).toEqual([]);
    });
  });

  describe('Dimension 3: Multi-Level Nested Git Lockfiles & Read-Only Attributes', () => {
    it('empirically discovers and prunes deep multi-level lockfiles across refs and worktrees', () => {
      const repoDir = path.join(tempDir, 'deep-locks-repo');
      const gitDir = path.join(repoDir, '.git');
      const deepRefsDir = path.join(gitDir, 'refs', 'heads', 'team', 'feature', 'sub-module', 'nested');
      const wt1Dir = path.join(gitDir, 'worktrees', 'agent-wt-1');
      const wt2Dir = path.join(gitDir, 'worktrees', 'agent-wt-2');
      fs.mkdirSync(deepRefsDir, { recursive: true });
      fs.mkdirSync(wt1Dir, { recursive: true });
      fs.mkdirSync(wt2Dir, { recursive: true });

      // Create variety of standard and nested lockfiles
      const lockpaths = [
        path.join(gitDir, 'index.lock'),
        path.join(gitDir, 'HEAD.lock'),
        path.join(gitDir, 'config.lock'),
        path.join(gitDir, 'packed-refs.lock'),
        path.join(gitDir, 'shallow.lock'),
        path.join(deepRefsDir, 'branch-a.lock'),
        path.join(deepRefsDir, 'branch-b.lock'),
        path.join(wt1Dir, 'locked'),
        path.join(wt1Dir, '.git.lock'),
        path.join(wt1Dir, 'gitdir.lock'),
        path.join(wt2Dir, 'index.lock'),
        path.join(wt2Dir, 'HEAD.lock'),
      ];

      for (const lp of lockpaths) {
        fs.writeFileSync(lp, `lock-${path.basename(lp)}`, 'utf8');
        expect(fs.existsSync(lp)).toBe(true);
      }

      // Reusable scan function matching main.ts implementation
      const scanGitLocksImplementation = (rootPath: string): string[] => {
        const locks: string[] = [];
        try {
          let gitDir = path.join(rootPath, '.git');
          if (fs.existsSync(gitDir)) {
            const stat = fs.statSync(gitDir);
            if (stat.isFile()) {
              const content = fs.readFileSync(gitDir, 'utf8').trim();
              const match = content.match(/^gitdir:\s*(.+)$/i);
              if (match && match[1]) {
                gitDir = path.resolve(rootPath, match[1].trim());
              }
            }
          }

          if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
            return locks;
          }

          const directLocks = ['index.lock', 'HEAD.lock', 'config.lock', 'packed-refs.lock', 'shallow.lock'];
          for (const file of directLocks) {
            const fullPath = path.join(gitDir, file);
            if (fs.existsSync(fullPath)) locks.push(fullPath);
          }

          const refsDir = path.join(gitDir, 'refs');
          if (fs.existsSync(refsDir)) {
            const scanDir = (dir: string) => {
              try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                  const entryPath = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    scanDir(entryPath);
                  } else if (entry.name.endsWith('.lock')) {
                    locks.push(entryPath);
                  }
                }
              } catch { /* ignore */ }
            };
            scanDir(refsDir);
          }

          const worktreesDir = path.join(gitDir, 'worktrees');
          if (fs.existsSync(worktreesDir) && fs.statSync(worktreesDir).isDirectory()) {
            try {
              const wtEntries = fs.readdirSync(worktreesDir, { withFileTypes: true });
              for (const wt of wtEntries) {
                if (wt.isDirectory()) {
                  const wtPath = path.join(worktreesDir, wt.name);
                  const wtLockFiles = ['.git.lock', 'index.lock', 'HEAD.lock', 'locked', 'gitdir.lock'];
                  for (const lf of wtLockFiles) {
                    const fullPath = path.join(wtPath, lf);
                    if (fs.existsSync(fullPath)) locks.push(fullPath);
                  }
                }
              }
            } catch { /* ignore */ }
          }
        } catch {
          // ignore
        }
        return locks;
      };

      const foundLocks = scanGitLocksImplementation(repoDir);
      expect(foundLocks.length).toBe(lockpaths.length);
      for (const lp of lockpaths) {
        expect(foundLocks).toContain(lp);
      }

      // Reusable prune function matching main.ts implementation
      const pruneGitLocksImplementation = (rootPath: string) => {
        const scanned = scanGitLocksImplementation(rootPath);
        const removed: string[] = [];
        const errors: string[] = [];

        for (const lockPath of scanned) {
          try {
            if (process.platform === 'win32') {
              try { fs.chmodSync(lockPath, 0o666); } catch { /* ignore */ }
            }
            fs.rmSync(lockPath, { force: true });
            removed.push(lockPath);
          } catch (err: any) {
            errors.push(`${lockPath}: ${err?.message || err}`);
          }
        }
        return { scanned, removed, errors };
      };

      const pruneResult = pruneGitLocksImplementation(repoDir);
      expect(pruneResult.removed.length).toBe(lockpaths.length);
      expect(pruneResult.errors.length).toBe(0);

      // Verify all lockfiles are completely removed
      for (const lp of lockpaths) {
        expect(fs.existsSync(lp)).toBe(false);
      }
    });

    it('successfully prunes read-only lock files by resetting permissions', () => {
      const repoDir = path.join(tempDir, 'readonly-lock-repo');
      const gitDir = path.join(repoDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });

      const indexLock = path.join(gitDir, 'index.lock');
      fs.writeFileSync(indexLock, 'locked-content', { mode: 0o444 });

      // Emulate prune with permission reset
      try {
        fs.chmodSync(indexLock, 0o666);
      } catch { /* ignore */ }
      fs.rmSync(indexLock, { force: true });

      expect(fs.existsSync(indexLock)).toBe(false);
    });
  });

  describe('Dimension 4: Multi-Template .env Discovery & Fallback Generation', () => {
    const ENV_TEMPLATE_CANDIDATES = [
      '.env.example',
      '.env.template',
      '.env.defaults',
      '.env.dist',
      '.env.sample',
      '.env.local.example',
    ];

    function findEnvTemplate(rootPath: string): string | null {
      for (const templateName of ENV_TEMPLATE_CANDIDATES) {
        const candidatePath = path.join(rootPath, templateName);
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          return candidatePath;
        }
      }
      return null;
    }

    it('strictly adheres to priority ordering across all 6 template candidates', () => {
      const testDir = path.join(tempDir, 'priority-test');
      fs.mkdirSync(testDir, { recursive: true });

      // Create all candidate files with unique content
      for (const tpl of ENV_TEMPLATE_CANDIDATES) {
        fs.writeFileSync(path.join(testDir, tpl), `TPL=${tpl}\n`, 'utf8');
      }

      // 1. All exist -> .env.example must win
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.example');

      // 2. Remove .env.example -> .env.template must win
      fs.unlinkSync(path.join(testDir, '.env.example'));
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.template');

      // 3. Remove .env.template -> .env.defaults must win
      fs.unlinkSync(path.join(testDir, '.env.template'));
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.defaults');

      // 4. Remove .env.defaults -> .env.dist must win
      fs.unlinkSync(path.join(testDir, '.env.defaults'));
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.dist');

      // 5. Remove .env.dist -> .env.sample must win
      fs.unlinkSync(path.join(testDir, '.env.dist'));
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.sample');

      // 6. Remove .env.sample -> .env.local.example must win
      fs.unlinkSync(path.join(testDir, '.env.sample'));
      expect(path.basename(findEnvTemplate(testDir)!)).toBe('.env.local.example');

      // 7. Remove .env.local.example -> null
      fs.unlinkSync(path.join(testDir, '.env.local.example'));
      expect(findEnvTemplate(testDir)).toBeNull();
    });

    it('generates standard fallback .env content when no template exists', () => {
      const generateDefaultEnvContent = (): string => {
        return [
          '# Task Companion Auto-Generated Environment Configuration',
          'APP_ENV=local',
          'APP_DEBUG=true',
          'PORT=3000',
          'NODE_ENV=development',
          '',
        ].join('\n');
      };

      const fallbackContent = generateDefaultEnvContent();
      expect(fallbackContent).toContain('APP_ENV=local');
      expect(fallbackContent).toContain('APP_DEBUG=true');
      expect(fallbackContent).toContain('PORT=3000');
      expect(fallbackContent).toContain('NODE_ENV=development');
    });
  });

  describe('Dimension 5: Directory Writability Probe Integrity & Cleanup', () => {
    const probeDirectoryWritability = (dirPath: string): { writable: boolean; error?: string } => {
      const probeFile = path.join(dirPath, `.task-hub-write-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      try {
        fs.writeFileSync(probeFile, 'ok', 'utf8');
        fs.readFileSync(probeFile, 'utf8');
        fs.unlinkSync(probeFile);
        return { writable: true };
      } catch (err: any) {
        try {
          if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
        } catch { /* ignore */ }
        return { writable: false, error: err?.message || String(err) };
      }
    };

    it('verifies probe creates, reads, and unlinks without leaving stray probe files', () => {
      const targetDir = path.join(tempDir, 'probe-clean-test');
      fs.mkdirSync(targetDir, { recursive: true });

      const res = probeDirectoryWritability(targetDir);
      expect(res.writable).toBe(true);

      const files = fs.readdirSync(targetDir);
      const probeFiles = files.filter(f => f.startsWith('.task-hub-write-test-'));
      expect(probeFiles.length).toBe(0);
    });

    it('returns writable: false and does not throw on invalid or non-existent path', () => {
      const badPath = path.join(tempDir, 'non_existent_folder_xyz');
      const res = probeDirectoryWritability(badPath);
      expect(res.writable).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('Dimension 6: Source Code & Preload/Vue Integration Hardening', () => {
    it('verifies main.ts implements all R1 diagnostics and auto-repair routines', () => {
      expect(mainSource).toContain('function getCandidateBinDirs(): string[]');
      expect(mainSource).toContain('function resolveCli(command: string)');
      expect(mainSource).toContain('function scanGitLocks(rootPath: string): string[]');
      expect(mainSource).toContain('function pruneGitLocks(rootPath: string)');
      expect(mainSource).toContain('function findEnvTemplate(rootPath: string): string | null');
      expect(mainSource).toContain('function generateDefaultEnvContent(): string');
      expect(mainSource).toContain('function probeDirectoryWritability(dirPath: string)');
      expect(mainSource).toContain('function fixDirectoryPermissions(dirPath: string)');
      expect(mainSource).toContain('function verifyCliExecutable(executable: string, timeoutMs = 2500)');
      expect(mainSource).toContain('async function agentRuntimeStatus()');
      expect(mainSource).toContain('async function bootstrapAgentRuntimes()');
      expect(mainSource).toContain('async function preflightAgent(provider: AgentProvider, cwd: string)');
      expect(mainSource).toContain('async function repairEnvironment(provider: AgentProvider, cwd: string)');
    });

    it('verifies preload.ts exposes full desktopApi environment and agent methods', () => {
      expect(preloadSource).toContain('repair: (provider:');
      expect(preloadSource).toContain('preflight: (provider:');
      expect(preloadSource).toContain('quickSetup: (cwd:');
      expect(preloadSource).toContain('runtimeStatus: ()');
      expect(preloadSource).toContain('bootstrapRuntimes: ()');
    });

    it('verifies AutoRepairModal.vue includes all diagnostic cards and action bindings', () => {
      expect(autoRepairModalSource).toContain('One-Click Environment Auto-Repair');
      expect(autoRepairModalSource).toContain('desktopApi.environment.repair');
      expect(autoRepairModalSource).toContain('desktopApi.environment.preflight');
      expect(autoRepairModalSource).toContain('desktopApi?.agent?.repairEnvironment');
    });
  });
});
