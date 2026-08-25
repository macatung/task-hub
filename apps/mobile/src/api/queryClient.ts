/**
 * TanStack React Query v5 Client Configuration & Offline Persistence Persister
 * Backed by @react-native-async-storage/async-storage for mobile offline data access.
 */

import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { TaskQueryParams, AgentRunQueryParams } from './types';

export const CACHE_STORAGE_KEY = 'TASKHUB_OFFLINE_QUERY_CACHE';

/**
 * AsyncStorage persister instance configured for React Native.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_STORAGE_KEY,
  throttleTime: 1000,
});

/**
 * Standard TanStack QueryClient with production caching defaults.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes stale time for general lists
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection retention for offline persistence
      retry: (failureCount, error: any) => {
        // Do not retry 4xx client errors
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Centralized, type-safe query key factories for precise cache targeting and invalidations.
 */
export const queryKeys = {
  workspaces: {
    all: ['workspaces'] as const,
    list: () => [...queryKeys.workspaces.all, 'list'] as const,
    current: () => [...queryKeys.workspaces.all, 'current'] as const,
    detail: (id: number) => [...queryKeys.workspaces.all, 'detail', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (workspaceId?: number | null) =>
      [...queryKeys.projects.all, 'list', { workspaceId }] as const,
    detail: (id: number) => [...queryKeys.projects.all, 'detail', id] as const,
  },
  sprints: {
    all: ['sprints'] as const,
    list: (projectId?: number | null) =>
      [...queryKeys.sprints.all, 'list', { projectId }] as const,
    active: (projectId?: number | null) =>
      [...queryKeys.sprints.all, 'active', { projectId }] as const,
    detail: (id: number) => [...queryKeys.sprints.all, 'detail', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (params?: TaskQueryParams) => [...queryKeys.tasks.all, 'list', params] as const,
    sprintTasks: (projectId?: number | null, sprintId?: number | null) =>
      [...queryKeys.tasks.all, 'sprint', { projectId, sprintId }] as const,
    backlog: (projectId?: number | null) =>
      [...queryKeys.tasks.all, 'backlog', { projectId }] as const,
    epics: (projectId?: number | null) =>
      [...queryKeys.tasks.all, 'epics', { projectId }] as const,
    detail: (id: number) => [...queryKeys.tasks.all, 'detail', id] as const,
    history: (id: number) => [...queryKeys.tasks.all, 'history', id] as const,
  },
  agentRuns: {
    all: ['agentRuns'] as const,
    list: (params?: AgentRunQueryParams) =>
      [...queryKeys.agentRuns.all, 'list', params] as const,
    detail: (id: number) => [...queryKeys.agentRuns.all, 'detail', id] as const,
    logs: (runId: number) => [...queryKeys.agentRuns.all, 'logs', runId] as const,
  },
};
