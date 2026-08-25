/**
 * Authenticated Task Hub REST API Client (Fetch-based)
 * Automatically injects Bearer credentials and X-Workspace-Id header from SecureStorageService.
 * Implements token eviction on 401 Unauthorized, structured error normalization, and exponential backoff retry.
 */

import {
  Workspace,
  Project,
  Sprint,
  SprintWithRollup,
  Task,
  AgentRun,
  AgentRunLog,
  ApiResponse,
  ApiError,
  TaskQueryParams,
  CreateTaskPayload,
  UpdateTaskPayload,
  AgentRunQueryParams,
  CreateSprintPayload,
  UpdateSprintPayload,
  StartSprintPayload,
  CompleteSprintPayload,
  MoveTasksPayload,
  CreateProjectPayload,
  CreateWorkspacePayload,
  DispatchEpicPayload,
  DispatchTaskPayload,
  HandoffPayload,
} from './types';
import { SecureStorageService } from '../services/secureStorage';
import { env, normalizeApiUrl } from '../config/env';

export interface ApiClientConfig {
  baseUrl?: string;
  token?: string | null;
  workspaceId?: number | null;
  maxRetries?: number;
}

export class TaskHubApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private workspaceId: number | null = null;
  private maxRetries: number;

  constructor(config?: ApiClientConfig) {
    this.baseUrl = normalizeApiUrl(config?.baseUrl || env.apiUrl);
    this.token = config?.token || null;
    this.workspaceId = config?.workspaceId || null;
    this.maxRetries = config?.maxRetries ?? 0;
  }

  public setToken(token: string | null): void {
    this.token = token;
  }

  public setWorkspaceId(workspaceId: number | null): void {
    this.workspaceId = workspaceId;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = normalizeApiUrl(url);
  }

  public async getEffectiveToken(): Promise<string | null> {
    if (this.token) return this.token;
    return SecureStorageService.getToken();
  }

  public async getEffectiveWorkspaceId(): Promise<number | null> {
    if (this.workspaceId !== null && this.workspaceId !== undefined) {
      return this.workspaceId;
    }
    const stored = await SecureStorageService.getConfig('workspace_id');
    return stored ? Number(stored) : null;
  }

  public async getEffectiveBaseUrl(): Promise<string> {
    if (this.baseUrl && this.baseUrl !== normalizeApiUrl(env.apiUrl)) {
      return this.baseUrl;
    }
    const stored = await SecureStorageService.getConfig('api_url');
    return stored ? normalizeApiUrl(stored) : this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const activeBaseUrl = await this.getEffectiveBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${activeBaseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = await this.getEffectiveToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const wsId = await this.getEffectiveWorkspaceId();
    if (wsId && !headers['X-Workspace-Id']) {
      headers['X-Workspace-Id'] = String(wsId);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        // Body might be empty or non-JSON
      }

      if (!response.ok) {
        // Handle 401 Unauthorized: token eviction from hardware secure storage
        if (response.status === 401) {
          try {
            await SecureStorageService.deleteToken();
          } catch {
            // Ignore eviction errors
          }
        }

        const error: ApiError = new Error(
          json?.message || `HTTP ${response.status}: ${response.statusText}`
        ) as ApiError;

        error.status = response.status;
        error.errors = json?.errors;
        error.error_code = json?.error_code;
        error.response = { status: response.status, data: json };

        // Retry policy for 5xx errors on idempotent GET
        const isGet = !options.method || options.method.toUpperCase() === 'GET';
        if (isGet && response.status >= 500 && retryCount < this.maxRetries) {
          const delay = Math.pow(2, retryCount) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw error;
      }

      if (json && typeof json === 'object' && 'data' in json) {
        return json as ApiResponse<T>;
      }

      return { data: json as T, success: true };
    } catch (err: any) {
      if (err.status !== undefined) {
        throw err; // Already formatted ApiError
      }

      // Network disconnect / offline error retry
      const isGet = !options.method || options.method.toUpperCase() === 'GET';
      if (isGet && retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      const networkError: ApiError = new Error(
        err.message || 'Network request failed or server unreachable'
      ) as ApiError;
      networkError.status = 0;
      throw networkError;
    }
  }

  // --- Workspaces ---

  async getWorkspaces(): Promise<ApiResponse<Workspace[]>> {
    return this.request<Workspace[]>('/api/v1/workspaces');
  }

  async createWorkspace(payload: CreateWorkspacePayload): Promise<ApiResponse<Workspace>> {
    return this.request<Workspace>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async switchWorkspace(workspaceId: number): Promise<ApiResponse<Workspace>> {
    const res = await this.request<Workspace>(`/api/v1/workspaces/${workspaceId}/switch`, {
      method: 'POST',
    });
    this.setWorkspaceId(workspaceId);
    await SecureStorageService.saveConfig('workspace_id', String(workspaceId));
    if (res.data?.name) {
      await SecureStorageService.saveConfig('workspace_name', res.data.name);
    }
    return res;
  }

  // --- Projects ---

  async getProjects(workspaceId?: number): Promise<ApiResponse<Project[]>> {
    if (workspaceId) {
      return this.request<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`);
    }
    return this.request<Project[]>('/api/v1/projects');
  }

  async getProject(id: number): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/api/v1/projects/${id}`);
  }

  async createProject(payload: CreateProjectPayload): Promise<ApiResponse<Project>> {
    return this.request<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Sprints ---

  async getSprints(projectId?: number | 'all'): Promise<ApiResponse<SprintWithRollup[]>> {
    const query = projectId && projectId !== 'all' ? `?project_id=${projectId}` : '';
    return this.request<SprintWithRollup[]>(`/api/v1/sprints${query}`);
  }

  async getSprint(id: number): Promise<ApiResponse<SprintWithRollup>> {
    return this.request<SprintWithRollup>(`/api/v1/sprints/${id}`);
  }

  async createSprint(payload: CreateSprintPayload): Promise<ApiResponse<Sprint>> {
    return this.request<Sprint>('/api/v1/sprints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateSprint(id: number, payload: UpdateSprintPayload): Promise<ApiResponse<Sprint>> {
    return this.request<Sprint>(`/api/v1/sprints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async startSprint(id: number, payload?: StartSprintPayload): Promise<ApiResponse<Sprint>> {
    return this.request<Sprint>(`/api/v1/sprints/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async completeSprint(id: number, payload?: CompleteSprintPayload): Promise<ApiResponse<Sprint>> {
    return this.request<Sprint>(`/api/v1/sprints/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async deleteSprint(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/sprints/${id}`, {
      method: 'DELETE',
    });
  }

  async moveTasks(payload: MoveTasksPayload): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/v1/sprints/move-tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Tasks ---

  async getTasks(params?: TaskQueryParams): Promise<ApiResponse<Task[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.workspace_id) searchParams.set('workspace_id', String(params.workspace_id));
      if (params.project_id) searchParams.set('project_id', String(params.project_id));
      if (params.sprint_id !== undefined) searchParams.set('sprint_id', String(params.sprint_id));
      if (params.status) searchParams.set('status', params.status);
      if (params.priority) searchParams.set('priority', params.priority);
      if (params.issue_type) searchParams.set('issue_type', params.issue_type);
      if (params.epic_id) searchParams.set('epic_id', String(params.epic_id));
      if (params.today) searchParams.set('today', '1');
    }
    const query = searchParams.toString();
    return this.request<Task[]>(`/api/v1/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: number): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/api/v1/tasks/${id}`);
  }

  async getTaskHistory(id: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/v1/tasks/${id}/history`);
  }

  async createTask(payload: CreateTaskPayload): Promise<ApiResponse<Task>> {
    return this.request<Task>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTask(id: number, payload: UpdateTaskPayload): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/api/v1/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteTask(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Agent Runs & Telemetry Workflows ---

  async getAgentRuns(params?: AgentRunQueryParams): Promise<ApiResponse<AgentRun[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.task_id) searchParams.set('task_id', String(params.task_id));
      if (params.runner_id) searchParams.set('runner_id', String(params.runner_id));
      if (params.status) searchParams.set('status', params.status);
    }
    const query = searchParams.toString();
    return this.request<AgentRun[]>(`/api/v1/tasks/agent-runs${query ? `?${query}` : ''}`);
  }

  async getAgentRun(id: number): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>(`/api/v1/tasks/agent-runs/${id}`);
  }

  async getAgentRunLogs(runId: number): Promise<ApiResponse<AgentRunLog[]>> {
    const res = await this.request<AgentRun>(`/api/v1/tasks/agent-runs/${runId}`);
    return { data: (res.data?.logs as AgentRunLog[]) || [], success: true };
  }

  async createAgentRun(payload: any): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>('/api/v1/tasks/agent-runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async dispatchTask(taskId: number, payload?: DispatchTaskPayload): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>(`/api/v1/tasks/${taskId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async dispatchEpic(epicId: number, payload: DispatchEpicPayload): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>(`/api/v1/tasks/${epicId}/dispatch-sequence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitHandoff(runId: number, payload: HandoffPayload): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>(`/api/v1/tasks/agent-runs/${runId}/handoff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async approveHandoff(taskId: number): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/api/v1/tasks/work-items/${taskId}/approve`, {
      method: 'POST',
    });
  }

  async rejectHandoff(taskId: number, reason: string): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/api/v1/tasks/work-items/${taskId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async cancelAgentRun(runId: number, reason?: string): Promise<ApiResponse<AgentRun>> {
    return this.request<AgentRun>(`/api/v1/tasks/agent-runs/${runId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }
}

export const apiClient = new TaskHubApiClient();
