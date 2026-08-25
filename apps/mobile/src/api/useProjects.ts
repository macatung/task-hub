import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryClient';
import { CreateProjectPayload } from './types';

export function useProjects(workspaceId?: number) {
  return useQuery({
    queryKey: queryKeys.projects.list(workspaceId),
    queryFn: async () => {
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
  });
}

export function useProject(id?: number) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id!),
    queryFn: async () => {
      const res = await apiClient.getProject(id!);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      apiClient.createProject(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}
