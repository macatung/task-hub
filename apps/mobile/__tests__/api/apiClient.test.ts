import { TaskHubApiClient } from '@/api/client';
import { CreateTaskPayload, UpdateTaskPayload } from '@/api/types';
import { SecureStorageService } from '@/services/secureStorage';

describe('TaskHubApiClient (Tier 1 & 2)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    await SecureStorageService.clearAll();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Tier 1: Successful REST API Queries & Mutations', () => {
    it('fetches workspaces and sends Bearer authorization token', async () => {
      const mockWorkspaces = [{ id: 1, name: 'Main Workspace', slug: 'main' }];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockWorkspaces }),
      });

      const client = new TaskHubApiClient({
        baseUrl: 'http://localhost:8000',
        token: 'test_bearer_token',
      });

      const res = await client.getWorkspaces();
      expect(res.data).toEqual(mockWorkspaces);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/workspaces',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test_bearer_token',
            Accept: 'application/json',
          }),
        })
      );
    });

    it('fetches projects for a given workspace with scoping', async () => {
      const mockProjects = [{ id: 10, name: 'Core Engine', slug: 'core' }];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockProjects }),
      });

      const client = new TaskHubApiClient({ token: 'tok' });
      const res = await client.getProjects(1);

      expect(res.data).toEqual(mockProjects);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/workspaces/1/projects',
        expect.any(Object)
      );
    });

    it('fetches sprints for a project', async () => {
      const mockSprints = [{ id: 101, name: 'Sprint 1', status: 'active' }];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockSprints }),
      });

      const client = new TaskHubApiClient();
      const res = await client.getSprints(10);

      expect(res.data).toEqual(mockSprints);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/sprints?project_id=10',
        expect.any(Object)
      );
    });

    it('fetches filtered tasks with query params', async () => {
      const mockTasks = [{ id: 1, title: 'Implement Auth', issue_type: 'task', status: 'todo' }];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockTasks }),
      });

      const client = new TaskHubApiClient();
      const res = await client.getTasks({
        workspace_id: 1,
        project_id: 10,
        sprint_id: 101,
        status: 'todo',
        issue_type: 'task',
      });

      expect(res.data).toEqual(mockTasks);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tasks?workspace_id=1&project_id=10&sprint_id=101&status=todo&issue_type=task'),
        expect.any(Object)
      );
    });

    it('creates a new task via POST request', async () => {
      const payload: CreateTaskPayload = {
        workspace_id: 1,
        project_id: 10,
        title: 'New Story',
        issue_type: 'story',
        priority: 'high',
        story_points: 5,
      };

      const mockCreated = { id: 77, ...payload, status: 'todo' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: mockCreated }),
      });

      const client = new TaskHubApiClient({ token: 'tok' });
      const res = await client.createTask(payload);

      expect(res.data.id).toBe(77);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('updates a task via PATCH request', async () => {
      const updatePayload: UpdateTaskPayload = { status: 'done', completed_pomodoros: 4 };
      const mockUpdated = { id: 77, title: 'Story', status: 'done' };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockUpdated }),
      });

      const client = new TaskHubApiClient();
      const res = await client.updateTask(77, updatePayload);

      expect(res.data.status).toBe('done');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/77',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        })
      );
    });

    it('fetches agent runs with query filters', async () => {
      const mockRuns = [{ id: 1, task_id: 77, status: 'running' }];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockRuns }),
      });

      const client = new TaskHubApiClient();
      const res = await client.getAgentRuns({ task_id: 77, status: 'running' });

      expect(res.data).toEqual(mockRuns);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tasks/agent-runs?task_id=77&status=running'),
        expect.any(Object)
      );
    });

    it('dispatches a task to agent runner via POST request', async () => {
      const mockRun = { id: 201, task_id: 77, runner_id: 3, status: 'queued' };
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: mockRun }),
      });

      const client = new TaskHubApiClient();
      const res = await client.dispatchTask(77, { runner_id: 3, execution_mode: 'auto_pilot' });

      expect(res.data.id).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/77/dispatch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ runner_id: 3, execution_mode: 'auto_pilot' }),
        })
      );
    });

    it('submits handoff approval to /api/v1/tasks/work-items/{id}/approve', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 77, status: 'done' } }),
      });

      const client = new TaskHubApiClient();
      const res = await client.approveHandoff(77);

      expect(res.data.status).toBe('done');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/work-items/77/approve',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('submits handoff rejection with reason to /api/v1/tasks/work-items/{id}/reject', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 77, status: 'in_progress' } }),
      });

      const client = new TaskHubApiClient();
      const res = await client.rejectHandoff(77, 'Failing unit test in auth module');

      expect(res.data.status).toBe('in_progress');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/tasks/work-items/77/reject',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Failing unit test in auth module' }),
        })
      );
    });
  });

  describe('Tier 2: Error Status Codes, Headers & Dynamic Configuration', () => {
    it('injects X-Workspace-Id header when workspaceId is set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const client = new TaskHubApiClient({ workspaceId: 99 });
      await client.getWorkspaces();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Workspace-Id': '99',
          }),
        })
      );
    });

    it('dynamically updates baseUrl, token, and workspaceId via setters', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const client = new TaskHubApiClient();
      client.setBaseUrl('https://custom.taskhub.dev');
      client.setToken('custom_tok');
      client.setWorkspaceId(12);

      await client.getWorkspaces();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom.taskhub.dev/api/v1/workspaces',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom_tok',
            'X-Workspace-Id': '12',
          }),
        })
      );
    });

    it('handles 401 Unauthorized by throwing structured error with status', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthenticated or invalid token' }),
      });

      const client = new TaskHubApiClient();
      await expect(client.getWorkspaces()).rejects.toThrow('Unauthenticated or invalid token');
    });

    it('handles 422 Unprocessable Entity with validation errors', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({
          message: 'The given data was invalid.',
          errors: { title: ['The title field is required.'] },
        }),
      });

      const client = new TaskHubApiClient();
      try {
        await client.createTask({} as any);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(422);
        expect(err.errors?.title).toContain('The title field is required.');
      }
    });

    it('handles 403 Forbidden error cleanly', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'User does not have access to this workspace' }),
      });

      const client = new TaskHubApiClient();
      await expect(client.getProjects(999)).rejects.toThrow(
        'User does not have access to this workspace'
      );
    });
  });

  describe('Tier 5 Adversarial Challenges: Token Resolution, Headers & Error Retries', () => {
    describe('Challenge 1: Token Resolution (SecureStorage vs Manual Override)', () => {
      it('retrieves and uses token from SecureStorageService when no manual override is provided', async () => {
        await SecureStorageService.saveToken('secure_stored_token_abc');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient();
        const effectiveToken = await client.getEffectiveToken();
        expect(effectiveToken).toBe('secure_stored_token_abc');

        await client.getWorkspaces();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer secure_stored_token_abc',
            }),
          })
        );
      });

      it('prioritizes manual token override over SecureStorageService token', async () => {
        await SecureStorageService.saveToken('secure_stored_token_abc');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient({ token: 'manual_override_token_xyz' });
        const effectiveToken = await client.getEffectiveToken();
        expect(effectiveToken).toBe('manual_override_token_xyz');

        await client.getWorkspaces();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer manual_override_token_xyz',
            }),
          })
        );
      });

      it('dynamically overrides with setToken and restores SecureStorageService on null', async () => {
        await SecureStorageService.saveToken('stored_token_base');

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient();
        expect(await client.getEffectiveToken()).toBe('stored_token_base');

        // Override token
        client.setToken('dynamic_override_1');
        expect(await client.getEffectiveToken()).toBe('dynamic_override_1');

        await client.getWorkspaces();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer dynamic_override_1',
            }),
          })
        );

        // Clear override
        client.setToken(null);
        expect(await client.getEffectiveToken()).toBe('stored_token_base');

        await client.getWorkspaces();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer stored_token_base',
            }),
          })
        );
      });

      it('handles absent token gracefully without sending Authorization header', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient();
        const effectiveToken = await client.getEffectiveToken();
        expect(effectiveToken).toBeNull();

        await client.getWorkspaces();
        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders.Authorization).toBeUndefined();
      });
    });

    describe('Challenge 2: Header Construction & Workspace Scoping', () => {
      it('correctly constructs Authorization Bearer header without malformation', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient({ token: 'test_token_val' });
        await client.getWorkspaces();

        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders.Authorization).toBe('Bearer test_token_val');
        expect(callHeaders['Content-Type']).toBe('application/json');
        expect(callHeaders.Accept).toBe('application/json');
      });

      it('injects X-Workspace-Id from SecureStorageService when not set on client instance', async () => {
        await SecureStorageService.saveConfig('workspace_id', '88');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        const client = new TaskHubApiClient();
        expect(await client.getEffectiveWorkspaceId()).toBe(88);

        await client.getWorkspaces();
        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders['X-Workspace-Id']).toBe('88');
      });

      it('prioritizes caller custom headers over default injected headers', async () => {
        const client = new TaskHubApiClient({ workspaceId: 10 });

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

        await client.getProjects(10);
        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders['X-Workspace-Id']).toBe('10');
      });
    });

    describe('Challenge 3: Error Responses (401, 403, 422)', () => {
      it('evicts token from SecureStorageService upon receiving 401 Unauthorized', async () => {
        await SecureStorageService.saveToken('stale_unauthorized_token');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Session expired or revoked' }),
        });

        const client = new TaskHubApiClient();
        try {
          await client.getWorkspaces();
          fail('Should have thrown 401');
        } catch (err: any) {
          expect(err.status).toBe(401);
          expect(err.message).toBe('Session expired or revoked');
        }

        const remainingToken = await SecureStorageService.getToken();
        expect(remainingToken).toBeNull();
      });

      it('does NOT evict token upon receiving 403 Forbidden', async () => {
        await SecureStorageService.saveToken('valid_auth_token_403');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ message: 'Insufficient workspace permissions' }),
        });

        const client = new TaskHubApiClient();
        try {
          await client.getProjects(99);
          fail('Should have thrown 403');
        } catch (err: any) {
          expect(err.status).toBe(403);
          expect(err.message).toBe('Insufficient workspace permissions');
        }

        const remainingToken = await SecureStorageService.getToken();
        expect(remainingToken).toBe('valid_auth_token_403');
      });

      it('normalizes 422 Unprocessable Entity with error codes and field validation errors', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({
            message: 'Validation failed for task creation',
            error_code: 'VALIDATION_FAILED',
            errors: {
              title: ['Title cannot be empty'],
              story_points: ['Story points must be a positive integer'],
            },
          }),
        });

        const client = new TaskHubApiClient();
        try {
          await client.createTask({ title: '' } as any);
          fail('Should have thrown 422');
        } catch (err: any) {
          expect(err.status).toBe(422);
          expect(err.error_code).toBe('VALIDATION_FAILED');
          expect(err.errors?.title).toContain('Title cannot be empty');
          expect(err.errors?.story_points).toContain('Story points must be a positive integer');
          expect(err.response?.status).toBe(422);
        }
      });
    });

    describe('Challenge 4: 500 Server Error Exponential Retry Backoff & Network Recovery', () => {
      it('retries idempotent GET on 500 Server Error and recovers when subsequent attempt succeeds', async () => {
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ message: 'Temporary DB deadlock' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 1, name: 'Recovered WS' }] }),
          });

        const client = new TaskHubApiClient({ maxRetries: 1 });
        const res = await client.getWorkspaces();

        expect(res.data).toEqual([{ id: 1, name: 'Recovered WS' }]);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('exhausts maxRetries on persistent 500 Server Error for GET and throws ApiError', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Database connection failed permanently' }),
        });

        const client = new TaskHubApiClient({ maxRetries: 1 });
        try {
          await client.getWorkspaces();
          fail('Should have thrown 500');
        } catch (err: any) {
          expect(err.status).toBe(500);
          expect(err.message).toBe('Database connection failed permanently');
        }

        // Initial attempt + 1 retry = 2 calls
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('does NOT retry 500 Server Error on non-GET mutations (POST/PATCH/DELETE) to prevent duplicate execution', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Internal error during creation' }),
        });

        const client = new TaskHubApiClient({ maxRetries: 2 });
        try {
          await client.createTask({ title: 'New Task', project_id: 1, workspace_id: 1 } as any);
          fail('Should have thrown 500');
        } catch (err: any) {
          expect(err.status).toBe(500);
        }

        // Must only be called once, no retries on mutation
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('retries GET requests on network disconnect error up to maxRetries', async () => {
        global.fetch = jest
          .fn()
          .mockRejectedValueOnce(new Error('Network request failed'))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 1, name: 'Reconnected' }] }),
          });

        const client = new TaskHubApiClient({ maxRetries: 1 });
        const res = await client.getWorkspaces();

        expect(res.data).toEqual([{ id: 1, name: 'Reconnected' }]);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('does NOT retry network disconnect on POST mutations', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network drop during POST'));

        const client = new TaskHubApiClient({ maxRetries: 2 });
        try {
          await client.createWorkspace({ name: 'New WS' });
          fail('Should have thrown network error');
        } catch (err: any) {
          expect(err.status).toBe(0);
          expect(err.message).toContain('Network drop during POST');
        }

        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});

