import { TaskHubApiClient } from '@/api/client';
import { queryKeys, CACHE_STORAGE_KEY } from '@/api/queryClient';
import { SecureStorageService } from '@/services/secureStorage';
import { calculateSprintStats } from '@/utils/sprintStats';
import { Task, Sprint } from '@/api/types';

describe('Milestone 3: OpenAPI Client, Auth & State Management', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    await SecureStorageService.clearAll();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('TaskHubApiClient: Workspaces & Dynamic Credentials', () => {
    it('creates a workspace via POST /api/v1/workspaces', async () => {
      const mockCreated = { id: 2, name: 'Secondary Workspace', slug: 'secondary' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: mockCreated }),
      });

      const client = new TaskHubApiClient();
      const res = await client.createWorkspace({ name: 'Secondary Workspace' });

      expect(res.data).toEqual(mockCreated);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/workspaces',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Secondary Workspace' }),
        })
      );
    });

    it('switches workspace, sets internal state, and writes to SecureStorage', async () => {
      const switchedWs = { id: 5, name: 'Design Studio', slug: 'design' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: switchedWs }),
      });

      const client = new TaskHubApiClient();
      const res = await client.switchWorkspace(5);

      expect(res.data).toEqual(switchedWs);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/workspaces/5/switch',
        expect.objectContaining({ method: 'POST' })
      );

      const effectiveId = await client.getEffectiveWorkspaceId();
      expect(effectiveId).toBe(5);

      const storedName = await SecureStorageService.getConfig('workspace_name');
      expect(storedName).toBe('Design Studio');
    });

    it('retrieves effective token and workspaceId from SecureStorageService when not explicitly passed', async () => {
      await SecureStorageService.saveToken('hardware_keychain_token_123');
      await SecureStorageService.saveConfig('workspace_id', '42');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const client = new TaskHubApiClient();
      await client.getWorkspaces();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/workspaces',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer hardware_keychain_token_123',
            'X-Workspace-Id': '42',
          }),
        })
      );
    });

    it('evicts auth token from SecureStorageService on 401 Unauthorized', async () => {
      await SecureStorageService.saveToken('expired_token_abc');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthenticated' }),
      });

      const client = new TaskHubApiClient();
      try {
        await client.getWorkspaces();
        fail('Should throw 401');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }

      const storedToken = await SecureStorageService.getToken();
      expect(storedToken).toBeNull();
    });
  });

  describe('TaskHubApiClient: Projects & Sprints Operations', () => {
    it('fetches a single project by id', async () => {
      const mockProject = { id: 10, title: 'Mobile App', slug: 'mobile' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockProject }),
      });

      const client = new TaskHubApiClient();
      const res = await client.getProject(10);

      expect(res.data).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/projects/10',
        expect.any(Object)
      );
    });

    it('creates a project via POST /api/v1/projects', async () => {
      const payload = { title: 'Backend API', description: 'Laravel 11 backend' };
      const mockProject = { id: 11, ...payload, slug: 'backend-api' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: mockProject }),
      });

      const client = new TaskHubApiClient();
      const res = await client.createProject(payload);

      expect(res.data).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('manages sprint lifecycle (create, update, start, complete, delete, moveTasks)', async () => {
      const client = new TaskHubApiClient();

      // 1. Create Sprint
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 101, name: 'Sprint 1', status: 'planned' } }),
      });
      const createRes = await client.createSprint({ project_id: 10, name: 'Sprint 1' });
      expect(createRes.data.id).toBe(101);

      // 2. Update Sprint
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 101, name: 'Sprint 1 Renamed' } }),
      });
      const updateRes = await client.updateSprint(101, { name: 'Sprint 1 Renamed' });
      expect(updateRes.data.name).toBe('Sprint 1 Renamed');

      // 3. Start Sprint
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 101, status: 'active' } }),
      });
      const startRes = await client.startSprint(101, { duration_weeks: 2 });
      expect(startRes.data.status).toBe('active');

      // 4. Complete Sprint
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 101, status: 'completed' } }),
      });
      const completeRes = await client.completeSprint(101, { move_incomplete_to: 'backlog' });
      expect(completeRes.data.status).toBe('completed');

      // 5. Move Tasks
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { message: 'Tasks moved successfully' } }),
      });
      const moveRes = await client.moveTasks({ task_ids: [1, 2, 3], sprint_id: 102 });
      expect(moveRes.data.message).toBe('Tasks moved successfully');

      // 6. Delete Sprint
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { message: 'Sprint deleted' } }),
      });
      const deleteRes = await client.deleteSprint(101);
      expect(deleteRes.data.message).toBe('Sprint deleted');
    });
  });

  describe('TaskHubApiClient: Tasks, History & Agent Runs', () => {
    it('retrieves single task and task audit history', async () => {
      const client = new TaskHubApiClient();

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 77, title: 'Task Details' } }),
      });
      const taskRes = await client.getTask(77);
      expect(taskRes.data.title).toBe('Task Details');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ field: 'status', old: 'todo', new: 'in_progress' }] }),
      });
      const historyRes = await client.getTaskHistory(77);
      expect(historyRes.data).toHaveLength(1);
    });

    it('deletes a task via DELETE /api/v1/tasks/{id}', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { message: 'Task deleted successfully' } }),
      });

      const client = new TaskHubApiClient();
      const res = await client.deleteTask(77);
      expect(res.data.message).toBe('Task deleted successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/77',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('dispatches epic sequence via POST /api/v1/tasks/{id}/dispatch-sequence', async () => {
      const mockRun = { id: 301, task_id: 88, status: 'queued', runner_id: 2 };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: mockRun }),
      });

      const client = new TaskHubApiClient();
      const res = await client.dispatchEpic(88, {
        runner_id: 2,
        provider: 'antigravity',
        execution_mode: 'auto_pilot',
      });

      expect(res.data.id).toBe(301);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/88/dispatch-sequence',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            runner_id: 2,
            provider: 'antigravity',
            execution_mode: 'auto_pilot',
          }),
        })
      );
    });

    it('submits agent handoff evidence payload to /api/v1/tasks/agent-runs/{id}/handoff', async () => {
      const payload = {
        summary: 'All unit tests passing and verified',
        changed_files: ['apps/mobile/src/api/client.ts'],
        tests: [{ command: 'npm test', status: 'passed' as const }],
      };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 201, status: 'needs_review' } }),
      });

      const client = new TaskHubApiClient();
      const res = await client.submitHandoff(201, payload);

      expect(res.data.status).toBe('needs_review');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/agent-runs/201/handoff',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('cancels an active agent run via POST /api/v1/tasks/agent-runs/{id}/cancel', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 201, status: 'cancelled' } }),
      });

      const client = new TaskHubApiClient();
      const res = await client.cancelAgentRun(201, 'User requested abort');

      expect(res.data.status).toBe('cancelled');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/agent-runs/201/cancel',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'User requested abort' }),
        })
      );
    });
  });

  describe('Query Keys & Cache Key Factory', () => {
    it('generates consistent hierarchical query keys', () => {
      expect(CACHE_STORAGE_KEY).toBe('TASKHUB_OFFLINE_QUERY_CACHE');

      expect(queryKeys.workspaces.all).toEqual(['workspaces']);
      expect(queryKeys.workspaces.list()).toEqual(['workspaces', 'list']);
      expect(queryKeys.workspaces.detail(1)).toEqual(['workspaces', 'detail', 1]);

      expect(queryKeys.projects.list(2)).toEqual(['projects', 'list', { workspaceId: 2 }]);
      expect(queryKeys.projects.detail(10)).toEqual(['projects', 'detail', 10]);

      expect(queryKeys.sprints.list(10)).toEqual(['sprints', 'list', { projectId: 10 }]);
      expect(queryKeys.sprints.active(10)).toEqual(['sprints', 'active', { projectId: 10 }]);
      expect(queryKeys.sprints.detail(101)).toEqual(['sprints', 'detail', 101]);

      expect(queryKeys.tasks.list({ project_id: 10 })).toEqual([
        'tasks',
        'list',
        { project_id: 10 },
      ]);
      expect(queryKeys.tasks.sprintTasks(10, 101)).toEqual([
        'tasks',
        'sprint',
        { projectId: 10, sprintId: 101 },
      ]);
      expect(queryKeys.tasks.backlog(10)).toEqual(['tasks', 'backlog', { projectId: 10 }]);
      expect(queryKeys.tasks.epics(10)).toEqual(['tasks', 'epics', { projectId: 10 }]);
      expect(queryKeys.tasks.detail(77)).toEqual(['tasks', 'detail', 77]);
      expect(queryKeys.tasks.history(77)).toEqual(['tasks', 'history', 77]);

      expect(queryKeys.agentRuns.list({ task_id: 77 })).toEqual([
        'agentRuns',
        'list',
        { task_id: 77 },
      ]);
      expect(queryKeys.agentRuns.detail(201)).toEqual(['agentRuns', 'detail', 201]);
      expect(queryKeys.agentRuns.logs(201)).toEqual(['agentRuns', 'logs', 201]);
    });
  });

  describe('Scrum Hierarchy & Sprint Rollup Invariant', () => {
    it('strictly excludes Epics from sprint rollup and execution calculations', () => {
      const mixedTasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 10,
          title: 'Parent Epic Planning Container',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'high',
          story_points: 13, // Must NOT be counted in sprint total
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 10,
          sprint_id: 101,
          epic_id: 1,
          title: 'Child Story A',
          issue_type: 'story',
          status: 'done',
          priority: 'medium',
          story_points: 5,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 3,
          workspace_id: 1,
          project_id: 10,
          sprint_id: 101,
          epic_id: 1,
          title: 'Child Task B',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'high',
          story_points: 3,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 4,
          workspace_id: 1,
          project_id: 10,
          sprint_id: 101,
          epic_id: 1,
          title: 'Child Bug C',
          issue_type: 'bug',
          status: 'todo',
          priority: 'urgent',
          story_points: 2,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      const stats = calculateSprintStats(mixedTasks);

      // Total story points must be exactly 5 + 3 + 2 = 10 (not 10 + 13 = 23)
      expect(stats.totalPoints).toBe(10);
      expect(stats.donePoints).toBe(5);
      expect(stats.inProgressPoints).toBe(3);
      expect(stats.todoPoints).toBe(2);
      expect(stats.totalTasks).toBe(3);
      expect(stats.doneTasks).toBe(1);
    });
  });
});
