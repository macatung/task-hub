import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryClient';
import { Workspace, CreateWorkspacePayload } from './types';
import { SecureStorageService } from '../services/secureStorage';

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return res.data || [];
    },
  });
}

export function useCurrentWorkspace() {
  const { data: workspaces, isLoading, error, refetch } = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);

  useEffect(() => {
    SecureStorageService.getConfig('workspace_id').then((idStr) => {
      if (idStr) {
        setWorkspaceId(Number(idStr));
      } else if (workspaces && workspaces.length > 0) {
        setWorkspaceId(workspaces[0].id);
      }
    });
  }, [workspaces]);

  const currentWorkspace: Workspace | undefined =
    workspaces?.find((w) => w.id === workspaceId) ||
    (workspaces && workspaces.length > 0 ? workspaces[0] : undefined);

  return {
    currentWorkspace,
    workspaceId,
    workspaces,
    isLoading,
    error,
    refetch,
  };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWorkspacePayload) =>
      apiClient.createWorkspace(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: number) => {
      const res = await apiClient.switchWorkspace(workspaceId);
      apiClient.setWorkspaceId(workspaceId);
      await SecureStorageService.saveConfig('workspace_id', String(workspaceId));
      if (res.data?.name) {
        await SecureStorageService.saveConfig('workspace_name', res.data.name);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
    },
  });
}
