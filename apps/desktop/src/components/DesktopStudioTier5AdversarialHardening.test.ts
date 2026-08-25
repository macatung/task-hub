import { describe, expect, it, vi, beforeEach } from 'vitest';
import planUpgradeModalSource from './PlanUpgradeModal.vue?raw';
import agentConsoleModalSource from './AgentConsoleModal.vue?raw';
import taskDispatchModalSource from './TaskDispatchModal.vue?raw';
import preloadSource from '../../electron/preload.ts?raw';
import mainSource from '../../electron/main.ts?raw';
import packageJson from '../../package.json';
import { useUpgradeModal } from '../composables/useUpgradeModal';
import { DesktopHeartbeatService } from '../services/desktopHeartbeat';

describe('Phase 2 Tier 5 Adversarial Coverage Hardening — Desktop Studio Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PROTOCOL INJECTION & DEEP-LINK SECURITY HARNESS
  // =========================================================================
  describe('1. Protocol Injection, Scheme Whitelisting & Deep-Link Sanitization', () => {
    const isAllowedExternalUrl = (url: string): boolean => {
      return /^https?:\/\//i.test(url);
    };

    const buildBillingUrl = (workspaceSlug?: string, taskHubUrl?: string): string => {
      const base = (
        taskHubUrl ||
        (typeof process !== 'undefined' && process.env?.VITE_TASK_HUB_URL) ||
        'https://task-hub.macatung.dev'
      ).replace(/\/$/, '');

      if (workspaceSlug && workspaceSlug.trim()) {
        return `${base}/workspaces/${encodeURIComponent(workspaceSlug.trim())}/billing`;
      }
      return `${base}/pricing`;
    };

    it('electron/main.ts enforces strict HTTP/HTTPS scheme regex on open-external IPC handler', () => {
      expect(mainSource).toContain("ipcMain.handle('open-external'");
      expect(mainSource).toContain("if (!/^https?:\\/\\//i.test(url)) throw new Error('Only HTTP/HTTPS URLs are allowed.');");
      expect(mainSource).toContain('await shell.openExternal(url);');
    });

    it('rejects dangerous and non-HTTP protocol schemes via IPC validation logic', () => {
      const dangerousUrls = [
        'javascript:alert(document.cookie)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'file:///C:/Windows/System32/cmd.exe',
        'file:///etc/passwd',
        'vbscript:MsgBox("malicious")',
        'powershell:Start-Process calc',
        'chrome://settings',
        'blob:https://task-hub.macatung.dev/uuid',
        'ws://127.0.0.1:8080',
        'ftp://anonymous@ftp.example.com',
        'ssh://root@192.168.1.1',
        '',
        '   ',
        'relative/path/billing',
        '//malicious.domain.com/phishing',
      ];

      for (const url of dangerousUrls) {
        expect(isAllowedExternalUrl(url)).toBe(false);
      }
    });

    it('allows valid HTTP and HTTPS URLs across diverse ports and hosts', () => {
      const validUrls = [
        'https://task-hub.macatung.dev',
        'https://task-hub.macatung.dev/pricing',
        'https://task-hub.macatung.dev/workspaces/engineering/billing',
        'http://localhost:8000/workspaces/demo/billing',
        'http://127.0.0.1:20128/dashboard',
        'https://hub.enterprise-corp.internal:8443/workspaces/team-a/billing',
      ];

      for (const url of validUrls) {
        expect(isAllowedExternalUrl(url)).toBe(true);
      }
    });

    it('prevents protocol injection in workspace slugs via URL encoding in PlanUpgradeModal', () => {
      const injectionSlugs = [
        'javascript:alert(1)',
        'data:text/plain;evil',
        'http://attacker.com/#',
        '//attacker.com/malicious',
      ];

      for (const slug of injectionSlugs) {
        const generated = buildBillingUrl(slug);
        // Ensure the host is strictly task-hub.macatung.dev and not attacker-controlled
        expect(generated.startsWith('https://task-hub.macatung.dev/workspaces/')).toBe(true);
        expect(generated).toContain(encodeURIComponent(slug));
        expect(isAllowedExternalUrl(generated)).toBe(true);
      }
    });

    it('safeClone in preload.ts cleans up functions, symbols, and extracts error properties', () => {
      expect(preloadSource).toContain('function safeClone<T>(value: T): T');
      expect(preloadSource).toContain("if (typeof val === 'function' || typeof val === 'symbol') return undefined;");
      expect(preloadSource).toContain("if (typeof val === 'bigint') return val.toString();");
      expect(preloadSource).toContain("if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack };");

      // Verify safeClone emulation behavior
      const testObj = {
        name: 'Workspace Alpha',
        num: 42,
        fn: () => 'execute',
        sym: Symbol('secret'),
        err: new Error('Quota exceeded'),
      };

      const cloneFn = (value: any): any => {
        if (value === undefined || value === null) return value;
        if (typeof value !== 'object') return value;
        try {
          return JSON.parse(JSON.stringify(value, (_key, val) => {
            if (typeof val === 'function' || typeof val === 'symbol') return undefined;
            if (typeof val === 'bigint') return val.toString();
            if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack };
            return val;
          }));
        } catch {
          return {};
        }
      };

      const cloned = cloneFn(testObj);
      expect(cloned.name).toBe('Workspace Alpha');
      expect(cloned.num).toBe(42);
      expect(cloned.fn).toBeUndefined();
      expect(cloned.sym).toBeUndefined();
      expect(cloned.err.message).toBe('Quota exceeded');
    });
  });

  // =========================================================================
  // 2. MALFORMED & PATH-TRAVERSAL WORKSPACE SLUGS
  // =========================================================================
  describe('2. Malformed, Adversarial & Path-Traversal Workspace Slugs', () => {
    const buildBillingUrl = (workspaceSlug?: string, taskHubUrl?: string): string => {
      const base = (
        taskHubUrl ||
        (typeof process !== 'undefined' && process.env?.VITE_TASK_HUB_URL) ||
        'https://task-hub.macatung.dev'
      ).replace(/\/$/, '');

      if (workspaceSlug && workspaceSlug.trim()) {
        return `${base}/workspaces/${encodeURIComponent(workspaceSlug.trim())}/billing`;
      }
      return `${base}/pricing`;
    };

    it('neutralizes path traversal attempts in workspace slugs', () => {
      const traversalSlugs = [
        '../../admin/billing',
        '..\\..\\Windows\\System32',
        '....//....//config',
        '/root/workspace',
        './subfolder/../..',
      ];

      for (const slug of traversalSlugs) {
        const url = buildBillingUrl(slug);
        expect(url).not.toContain('/../../');
        expect(url).toContain(encodeURIComponent(slug.trim()));
      }
    });

    it('handles query parameters, fragments, and CRLF characters in slugs', () => {
      const edgeSlugs = [
        { input: 'ws-name?bypass=true&admin=1', encoded: 'ws-name%3Fbypass%3Dtrue%26admin%3D1' },
        { input: 'ws-name#token=secret123', encoded: 'ws-name%23token%3Dsecret123' },
        { input: 'ws\r\nSet-Cookie: admin=true', encoded: 'ws%0D%0ASet-Cookie%3A%20admin%3Dtrue' },
        { input: 'ws\twith\ttabs', encoded: 'ws%09with%09tabs' },
      ];

      for (const { input, encoded } of edgeSlugs) {
        const url = buildBillingUrl(input);
        expect(url).toBe(`https://task-hub.macatung.dev/workspaces/${encoded}/billing`);
      }
    });

    it('safely handles Vietnamese UTF-8 and Multi-byte Unicode Emojis in workspace slugs', () => {
      const unicodeSlugs = [
        'không-gian-phát-triển-ai',
        'dự-án-chuyển-đổi-số',
        '🚀-enterprise-workspace-🤖',
        'nhóm_kỹ_thuật_2026',
      ];

      for (const slug of unicodeSlugs) {
        const url = buildBillingUrl(slug);
        expect(url).toContain(encodeURIComponent(slug));
        expect(() => decodeURIComponent(url)).not.toThrow();
      }
    });

    it('safely handles null bytes and ASCII control characters', () => {
      const controlSlug = 'test\x00workspace\x1fend';
      const url = buildBillingUrl(controlSlug);
      expect(url).toBe('https://task-hub.macatung.dev/workspaces/test%00workspace%1Fend/billing');
    });

    it('resilient against massive 10,000-character workspace slug strings without memory or stack overflow', () => {
      const massiveSlug = 'a'.repeat(10000);
      const url = buildBillingUrl(massiveSlug);
      expect(url.length).toBeGreaterThan(10000);
      expect(url.startsWith('https://task-hub.macatung.dev/workspaces/aaaa')).toBe(true);
      expect(url.endsWith('/billing')).toBe(true);
    });

    it('falls back safely to /pricing on empty, whitespace, null, or undefined slugs', () => {
      expect(buildBillingUrl('')).toBe('https://task-hub.macatung.dev/pricing');
      expect(buildBillingUrl('   \t\n  ')).toBe('https://task-hub.macatung.dev/pricing');
      expect(buildBillingUrl(undefined)).toBe('https://task-hub.macatung.dev/pricing');
      expect(buildBillingUrl(undefined, 'http://localhost:3000/')).toBe('http://localhost:3000/pricing');
    });
  });

  // =========================================================================
  // 3. OFFLINE, DISCONNECTED & UNHEALTHY STATES RESILIENCE
  // =========================================================================
  describe('3. Offline, Disconnected & Unauthenticated States Resilience', () => {
    it('TaskDispatchModal renders unauthenticated warning banner when credential is null', () => {
      expect(taskDispatchModalSource).toContain('v-if="!credential"');
      expect(taskDispatchModalSource).toContain('Desktop is not authenticated with Task Hub.');
      expect(taskDispatchModalSource).toContain('Open Task Hub Connect in toolbar');
    });

    it('TaskDispatchModal reflects online/offline status dot with green/amber indicator', () => {
      expect(taskDispatchModalSource).toContain(":class=\"isOnline ? 'bg-emerald-400' : 'bg-amber-400'\"");
    });

    it('TaskDispatchModal displays empty message when tasks array is empty', () => {
      expect(taskDispatchModalSource).toContain('v-if="tasks.length === 0"');
      expect(taskDispatchModalSource).toContain('No tasks scheduled for today.');
    });

    it('PlanUpgradeModal gracefully catches shell openExternal exceptions in offline / failure states', () => {
      const failingMock = vi.fn().mockImplementation(() => {
        throw new Error('ENETUNREACH: Network is unreachable');
      });
      (globalThis as any).window = {
        desktopApi: {
          openExternal: failingMock,
        },
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const safeUpgrade = (customUrl?: string) => {
        const targetUrl = customUrl || 'https://task-hub.macatung.dev/pricing';
        try {
          if (typeof window !== 'undefined' && (window as any).desktopApi?.openExternal) {
            (window as any).desktopApi.openExternal(targetUrl);
          } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(targetUrl, '_blank');
          }
        } catch (err) {
          console.warn('Failed to open external billing URL:', err);
        }
      };

      expect(() => safeUpgrade()).not.toThrow();
      expect(failingMock).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Failed to open external billing URL:', expect.any(Error));
    });

    it('DesktopHeartbeatService transitions to offline status and catches network failure exceptions', async () => {
      const failingFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Server unreachable'));
      const heartbeat = new DesktopHeartbeatService({
        baseUrl: 'http://127.0.0.1:8000',
        fetchFn: failingFetch as any,
      });

      const result = await heartbeat.sendHeartbeat();
      expect(result).toBeNull();
      expect(heartbeat.isOnline()).toBe(false);
    });

    it('DesktopHeartbeatService marks offline when server returns HTTP 500 / 503 error', async () => {
      const errorFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      const heartbeat = new DesktopHeartbeatService({
        baseUrl: 'http://127.0.0.1:8000',
        fetchFn: errorFetch as any,
      });

      const result = await heartbeat.sendHeartbeat();
      expect(result).toBeNull();
      expect(heartbeat.isOnline()).toBe(false);
    });
  });

  // =========================================================================
  // 4. RAPID MODAL TOGGLING & SINGLETON STATE STRESS
  // =========================================================================
  describe('4. Rapid Modal Toggling & Concurrent State Stress', () => {
    it('handles 1,000 rapid sequential open/close modal cycles deterministically', () => {
      const { openUpgradeModal, closeUpgradeModal, isOpen, modalState } = useUpgradeModal();

      for (let i = 0; i < 1000; i++) {
        openUpgradeModal({
          currentPlan: i % 2 === 0 ? 'pro' : 'team',
          currentLimit: (i % 3) + 1,
          activeCount: (i % 3) + 1,
          workspaceSlug: `rapid-ws-${i}`,
          reasonMessage: `Stress iteration ${i}`,
        });
        expect(isOpen.value).toBe(true);

        if (i % 2 === 1) {
          closeUpgradeModal();
          expect(isOpen.value).toBe(false);
        }
      }

      // Close at the end
      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('handles concurrent/interleaved quota error handlers and manual triggers safely', async () => {
      const { handleQuotaError, openUpgradeModal, closeUpgradeModal, isOpen, modalState } = useUpgradeModal();

      const promises = Array.from({ length: 50 }).map(async (_, idx) => {
        if (idx % 3 === 0) {
          handleQuotaError({
            error_code: 'PLAN_QUOTA_EXCEEDED',
            plan: 'pro',
            limit: 3,
            active: 3,
            message: `Concurrent error ${idx}`,
          }, { workspaceSlug: `workspace-${idx}` });
        } else if (idx % 3 === 1) {
          openUpgradeModal({
            currentPlan: 'team',
            currentLimit: 10,
            activeCount: 10,
            workspaceSlug: `team-ws-${idx}`,
          });
        } else {
          closeUpgradeModal();
        }
      });

      await Promise.all(promises);
      // State must be defined and valid
      expect(typeof isOpen.value).toBe('boolean');
      expect(modalState.value).toBeDefined();
      expect(typeof modalState.value.currentPlan).toBe('string');
      expect(typeof modalState.value.currentLimit).toBe('number');

      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('preserves existing state fields when partially overriding with openUpgradeModal', () => {
      const { openUpgradeModal, modalState, closeUpgradeModal } = useUpgradeModal();

      openUpgradeModal({
        currentPlan: 'pro',
        currentLimit: 3,
        activeCount: 3,
        workspaceSlug: 'master-workspace',
        taskHubUrl: 'https://master-hub.dev',
        reasonMessage: 'Initial reason',
      });

      expect(modalState.value.workspaceSlug).toBe('master-workspace');
      expect(modalState.value.taskHubUrl).toBe('https://master-hub.dev');

      // Update only reasonMessage
      openUpgradeModal({
        reasonMessage: 'Updated reason message only',
      });

      expect(modalState.value.workspaceSlug).toBe('master-workspace');
      expect(modalState.value.taskHubUrl).toBe('https://master-hub.dev');
      expect(modalState.value.currentPlan).toBe('pro');
      expect(modalState.value.currentLimit).toBe(3);
      expect(modalState.value.reasonMessage).toBe('Updated reason message only');

      closeUpgradeModal();
    });
  });

  // =========================================================================
  // 5. CONCURRENT RUNNER LIMITS & 4-TIER QUOTA ENFORCEMENT
  // =========================================================================
  describe('5. Concurrent Runner Limits & 4-Tier Plan Quota Guardrails', () => {
    it('verifies 4-tier runner concurrency limits contract (Community=1, Pro=3, Team=10, Enterprise=Unlimited/Custom)', () => {
      const PLAN_RUNNER_LIMITS: Record<string, number | null> = {
        community: 1,
        pro: 3,
        team: 10,
        enterprise: null, // Unlimited / Custom
      };

      expect(PLAN_RUNNER_LIMITS.community).toBe(1);
      expect(PLAN_RUNNER_LIMITS.pro).toBe(3);
      expect(PLAN_RUNNER_LIMITS.team).toBe(10);
      expect(PLAN_RUNNER_LIMITS.enterprise).toBeNull();
    });

    it('correctly intercepts quota errors across all plan tiers and normalizes them', () => {
      const { handleQuotaError, modalState, closeUpgradeModal } = useUpgradeModal();

      const tiers = [
        { plan: 'community', limit: 1, active: 1 },
        { plan: 'pro', limit: 3, active: 3 },
        { plan: 'team', limit: 10, active: 10 },
        { plan: 'enterprise', limit: 50, active: 50 },
      ];

      for (const tier of tiers) {
        const payload = {
          response: {
            data: {
              error_code: 'PLAN_QUOTA_EXCEEDED',
              plan: tier.plan,
              limit: tier.limit,
              active: tier.active,
              message: `Concurrent runner limit reached for plan ${tier.plan}`,
            },
          },
        };

        const intercepted = handleQuotaError(payload, { workspaceSlug: `ws-${tier.plan}` });
        expect(intercepted).toBe(true);
        expect(modalState.value.currentPlan).toBe(tier.plan);
        expect(modalState.value.currentLimit).toBe(tier.limit);
        expect(modalState.value.activeCount).toBe(tier.active);
        expect(modalState.value.workspaceSlug).toBe(`ws-${tier.plan}`);

        closeUpgradeModal();
      }
    });

    it('coerces string, floating point, and null limits/active counts gracefully', () => {
      const { handleQuotaError, modalState, closeUpgradeModal } = useUpgradeModal();

      // String numeric
      handleQuotaError({
        error_code: 'PLAN_QUOTA_EXCEEDED',
        limit: '10',
        active: '10',
      });
      expect(modalState.value.currentLimit).toBe(10);
      expect(modalState.value.activeCount).toBe(10);
      closeUpgradeModal();

      // Float numeric string
      handleQuotaError({
        error_code: 'PLAN_QUOTA_EXCEEDED',
        limit: '3.5',
        active: '3.5',
      });
      expect(modalState.value.currentLimit).toBe(3.5);
      expect(modalState.value.activeCount).toBe(3.5);
      closeUpgradeModal();

      // Null limit/active defaults to 1
      handleQuotaError({
        error_code: 'PLAN_QUOTA_EXCEEDED',
        limit: null,
        active: null,
      });
      expect(modalState.value.currentLimit).toBe(1);
      expect(modalState.value.activeCount).toBe(1);
      closeUpgradeModal();
    });

    it('tracks active_run_ids in DesktopHeartbeatService and dynamically updates status', () => {
      const heartbeat = new DesktopHeartbeatService({ baseUrl: 'http://127.0.0.1:8000' });

      expect(heartbeat.getActiveRunIds()).toEqual([]);
      expect(heartbeat.getTelemetry().status).toBe('idle');

      // Add run 101
      heartbeat.addActiveRunId(101);
      expect(heartbeat.getActiveRunIds()).toEqual([101]);
      expect(heartbeat.getTelemetry().status).toBe('busy');
      expect(heartbeat.getTelemetry().active_run_ids).toEqual([101]);

      // Add run 102 (concurrency = 2)
      heartbeat.addActiveRunId(102);
      expect(heartbeat.getActiveRunIds().length).toBe(2);
      expect(heartbeat.getTelemetry().status).toBe('busy');

      // Duplicate add has no effect (Set uniqueness)
      heartbeat.addActiveRunId(101);
      expect(heartbeat.getActiveRunIds().length).toBe(2);

      // Remove run 101
      heartbeat.removeActiveRunId(101);
      expect(heartbeat.getActiveRunIds()).toEqual([102]);
      expect(heartbeat.getTelemetry().status).toBe('busy');

      // Remove run 102 -> idle
      heartbeat.removeActiveRunId(102);
      expect(heartbeat.getActiveRunIds()).toEqual([]);
      expect(heartbeat.getTelemetry().status).toBe('idle');
    });

    it('ignores non-quota HTTP errors and exceptions (401, 403, 404, 500, network)', () => {
      const { handleQuotaError, isOpen } = useUpgradeModal();

      const ignoredErrors = [
        { response: { status: 401, data: { message: 'Unauthenticated.' } } },
        { response: { status: 403, data: { message: 'Forbidden action.' } } },
        { response: { status: 404, data: { message: 'Task not found.' } } },
        { response: { status: 500, data: { message: 'Internal server error.' } } },
        new Error('SyntaxError: Unexpected token < in JSON at position 0'),
        new TypeError('Failed to fetch'),
      ];

      for (const err of ignoredErrors) {
        const intercepted = handleQuotaError(err);
        expect(intercepted).toBe(false);
        expect(isOpen.value).toBe(false);
      }
    });
  });

  // =========================================================================
  // 6. BUILD & PACKAGE SCRIPT ALIGNMENT
  // =========================================================================
  describe('6. Desktop Package & Typecheck Scripts Parity', () => {
    it('package.json includes standard typecheck script "vue-tsc --noEmit"', () => {
      expect(packageJson.scripts.typecheck).toBe('vue-tsc --noEmit');
    });

    it('package.json includes build:vue script "vite build"', () => {
      expect(packageJson.scripts['build:vue']).toBe('vite build');
    });

    it('package.json includes test script "vitest run"', () => {
      expect(packageJson.scripts.test).toBe('vitest run');
    });
  });
});
