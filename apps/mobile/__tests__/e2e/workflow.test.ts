import { QRScannerService } from '@/services/qrScanner';
import { SecureStorageService } from '@/services/secureStorage';
import { BiometricsService } from '@/services/biometrics';
import { SSEStreamClient } from '@/services/sseStreamClient';
import { TaskHubApiClient } from '@/api/client';
import { calculateSprintStats } from '@/utils/sprintStats';
import { Task, Sprint, AgentRunEvent, AgentRunLog } from '@/api/types';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { mockReactNativeSSE } from '../../jest.setup';

describe('Tier 4: End-to-End Real-World Application Scenarios', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    (SecureStore as any).__resetStore();
    (LocalAuthentication as any).__resetMock();
    mockReactNativeSSE.__resetInstances();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ----------------------------------------------------------------------
  // SCENARIO 1: End-to-End Device Pairing to Workspace Dashboard
  // ----------------------------------------------------------------------
  it('Scenario 1: End-to-End Device Pairing to Workspace Dashboard', async () => {
    // 1. QR camera scans code emitted by Task Hub Desktop / Web
    const rawQrCode = JSON.stringify({
      type: 'taskhub_pairing',
      version: '1',
      task_hub_url: 'http://localhost:8000',
      pairing_id: 'pair-uuid-112233',
      device_secret: 'sec_key_secure_pairing_secret_1234567890',
      workspace_id: 1,
      token: 'th_ws_paired_token_xyz999',
    });

    // 2. Validate QR Payload
    const qrResult = QRScannerService.parseAndValidateQrPayload(rawQrCode);
    expect(qrResult.success).toBe(true);
    if (!qrResult.success) return;

    // 3. Persist Token and URL into hardware SecureStore
    await SecureStorageService.saveToken(qrResult.payload.token!);
    await SecureStorageService.saveConfig('api_url', qrResult.payload.task_hub_url);
    await SecureStorageService.saveConfig('workspace_id', String(qrResult.payload.workspace_id));

    // 4. Verify token is securely stored
    const storedToken = await SecureStorageService.getToken();
    expect(storedToken).toBe('th_ws_paired_token_xyz999');

    // 5. Initialize API Client with stored credentials and fetch Workspaces
    const mockWorkspaces = [
      { id: 1, name: 'Production Workspace', slug: 'prod', created_at: '', updated_at: '' },
    ];
    const mockProjects = [
      { id: 10, workspace_id: 1, name: 'Task Hub Mobile', slug: 'mobile', status: 'active' as const, created_at: '', updated_at: '' },
    ];

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockWorkspaces }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockProjects }),
      });

    const client = new TaskHubApiClient({
      baseUrl: (await SecureStorageService.getConfig('api_url'))!,
      token: storedToken,
      workspaceId: Number(await SecureStorageService.getConfig('workspace_id')),
    });

    const workspacesRes = await client.getWorkspaces();
    expect(workspacesRes.data).toHaveLength(1);
    expect(workspacesRes.data[0].name).toBe('Production Workspace');

    const projectsRes = await client.getProjects(workspacesRes.data[0].id);
    expect(projectsRes.data).toHaveLength(1);
    expect(projectsRes.data[0].name).toBe('Task Hub Mobile');
  });

  // ----------------------------------------------------------------------
  // SCENARIO 2: Sprint Planning & Non-Epic Story Point Rollup
  // ----------------------------------------------------------------------
  it('Scenario 2: Sprint Planning & Non-Epic Story Point Rollup', async () => {
    // Sprint data: 1 Epic (8 pts estimate) + 7 child tasks totaling 19 pts
    const sprint: Sprint = {
      id: 20,
      project_id: 10,
      name: 'Sprint 12: Core Mobile',
      status: 'active',
      created_at: '',
      updated_at: '',
    };

    const tasks: Task[] = [
      // High-level Epic (8 pts) - MUST NOT BE COUNTED IN SPRINT POINTS
      {
        id: 1,
        workspace_id: 1,
        project_id: 10,
        sprint_id: 20,
        title: 'Epic: Mobile Experience',
        issue_type: 'epic',
        status: 'in_progress',
        priority: 'high',
        story_points: 8,
        created_at: '',
        updated_at: '',
      },
      // 7 child tasks (Total 19 pts: 3 done, 2 in_progress, 2 todo)
      { id: 2, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 1', issue_type: 'story', status: 'done', priority: 'medium', story_points: 3, created_at: '', updated_at: '' },
      { id: 3, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 2', issue_type: 'story', status: 'done', priority: 'medium', story_points: 3, created_at: '', updated_at: '' },
      { id: 4, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 3', issue_type: 'task', status: 'done', priority: 'medium', story_points: 2, created_at: '', updated_at: '' },
      { id: 5, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 4', issue_type: 'task', status: 'in_progress', priority: 'urgent', story_points: 5, created_at: '', updated_at: '' },
      { id: 6, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 5', issue_type: 'bug', status: 'in_progress', priority: 'high', story_points: 2, created_at: '', updated_at: '' },
      { id: 7, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 6', issue_type: 'story', status: 'todo', priority: 'medium', story_points: 3, created_at: '', updated_at: '' },
      { id: 8, workspace_id: 1, project_id: 10, sprint_id: 20, epic_id: 1, title: 'Task 7', issue_type: 'task', status: 'todo', priority: 'low', story_points: 1, created_at: '', updated_at: '' },
    ];

    // Compute Sprint Stats
    const stats = calculateSprintStats(tasks);

    // Assert: Total points is exactly 19 (not 27), total actionable tasks is 7 (not 8)
    expect(stats.totalPoints).toBe(19);
    expect(stats.donePoints).toBe(8); // 3+3+2
    expect(stats.inProgressPoints).toBe(7); // 5+2
    expect(stats.todoPoints).toBe(4); // 3+1
    expect(stats.totalTasks).toBe(7);
    expect(stats.doneTasks).toBe(3);
    expect(stats.completionPercentage).toBe(42); // (8 / 19) * 100 ~ 42%
  });

  // ----------------------------------------------------------------------
  // SCENARIO 3: Remote Agent Task Dispatch to Live Stream Logs
  // ----------------------------------------------------------------------
  it('Scenario 3: Remote Agent Task Dispatch to Live Stream Logs', async () => {
    // 1. Dispatch Task to runner
    const mockRun = {
      id: 301,
      task_id: 5,
      runner_id: 1,
      provider: 'antigravity' as const,
      model: 'gemini-2.5-pro',
      status: 'queued' as const,
      execution_mode: 'auto_pilot' as const,
      created_at: '',
      updated_at: '',
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: mockRun }),
    });

    const client = new TaskHubApiClient({ token: 'tok_123' });
    const dispatchRes = await client.dispatchTask(5, { runner_id: 1, provider: 'antigravity' });
    expect(dispatchRes.data.id).toBe(301);

    // 2. Connect to SSE Stream
    const events: AgentRunEvent[] = [];
    const logs: AgentRunLog[] = [];

    const sseClient = new SSEStreamClient();
    sseClient.connect({
      url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
      token: 'tok_123',
      runId: 301,
      onEvent: (e) => events.push(e),
      onLog: (l) => logs.push(l),
    });

    const instance = mockReactNativeSSE.__getLastInstance();
    instance.__emitOpen();

    // 3. Receive status transitions & log stream
    instance.__emitCustomEvent('agent-run', JSON.stringify({
      id: 1,
      run_id: 301,
      type: 'status_transition',
      status: 'running',
      occurred_at: '2026-08-25T07:10:00Z',
    }));

    instance.__emitCustomEvent('agent-log', JSON.stringify({
      id: 10,
      run_id: 301,
      stream: 'stdout',
      content: 'Executing build & test validation...\n',
      occurred_at: '2026-08-25T07:10:05Z',
    }));

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('running');
    expect(logs).toHaveLength(1);
    expect(logs[0].content).toContain('Executing build & test validation');
    expect(sseClient.getLastEventId()).toBe(1);
    expect(sseClient.getLastLogId()).toBe(10);
  });

  // ----------------------------------------------------------------------
  // SCENARIO 4: Agent Handoff Inspection & Biometric Approval
  // ----------------------------------------------------------------------
  it('Scenario 4: Agent Handoff Inspection & Biometric Approval', async () => {
    // 1. Setup Biometrics Hardware & Enrollment
    (LocalAuthentication as any).__setHardwareAvailable(true);
    (LocalAuthentication as any).__setEnrolled(true);
    (LocalAuthentication as any).__setMockResult({ success: true });

    // 2. Agent run in needs_review with 100% passing test evidence
    const runInReview = {
      id: 301,
      task_id: 5,
      status: 'needs_review',
      evidence: {
        tests_passed: 120,
        tests_failed: 0,
        tests_total: 120,
        commit_sha: 'c0ffee123456',
        changed_files: ['apps/mobile/src/services/biometrics.ts'],
      },
    };

    // 3. Mock approval API call
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 5, status: 'done' } }),
    });

    const client = new TaskHubApiClient({ token: 'tok_123' });

    // 4. Guard approval behind biometrics
    const approvedTask = await BiometricsService.guardSensitiveAction(
      async () => {
        return (await client.approveHandoff(runInReview.task_id)).data;
      },
      'Confirm Handoff Approval'
    );

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    expect(approvedTask.status).toBe('done');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/tasks/work-items/5/approve',
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ----------------------------------------------------------------------
  // SCENARIO 5: Handoff Rejection & Reconnect After Network Loss
  // ----------------------------------------------------------------------
  it('Scenario 5: Handoff Rejection & Reconnect After Network Loss', async () => {
    // 1. Submit rejection for a task
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 5, status: 'in_progress' } }),
    });

    const client = new TaskHubApiClient({ token: 'tok_123' });
    const rejectedTask = await client.rejectHandoff(5, 'Test coverage missing for offline persister');
    expect(rejectedTask.data.status).toBe('in_progress');

    // 2. Connect SSE client with initial cursors
    const newLogs: AgentRunLog[] = [];
    const sseClient = new SSEStreamClient({
      url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
      token: 'tok_123',
      initialAfter: 50,
      initialAfterLog: 200,
      onLog: (l) => newLogs.push(l),
    });

    sseClient.connect();
    const instance = mockReactNativeSSE.__getLastInstance();
    instance.__emitOpen();

    // Verify initial cursors were passed in request URL
    expect(instance.url).toContain('after=50');
    expect(instance.url).toContain('after_log=200');

    // 3. Receive new logs following rejection feedback
    instance.__emitCustomEvent('agent-log', JSON.stringify({
      id: 201,
      run_id: 301,
      stream: 'stdout',
      content: 'Received feedback. Writing offline persister tests...\n',
      occurred_at: '2026-08-25T07:20:00Z',
    }));

    expect(newLogs).toHaveLength(1);
    expect(newLogs[0].content).toContain('Writing offline persister tests');
    expect(sseClient.getLastLogId()).toBe(201);
  });
});
