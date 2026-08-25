import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryClient';
import {
  AgentRunQueryParams,
  DispatchTaskPayload,
  DispatchEpicPayload,
  HandoffPayload,
} from './types';

export function useAgentRuns(params?: AgentRunQueryParams) {
  return useQuery({
    queryKey: queryKeys.agentRuns.list(params),
    queryFn: async () => {
      const res = await apiClient.getAgentRuns(params);
      return res.data || [];
    },
  });
}

export function useAgentRun(id?: number) {
  return useQuery({
    queryKey: queryKeys.agentRuns.detail(id!),
    queryFn: async () => {
      const res = await apiClient.getAgentRun(id!);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAgentRunLogs(runId?: number) {
  return useQuery({
    queryKey: queryKeys.agentRuns.logs(runId!),
    queryFn: async () => {
      const res = await apiClient.getAgentRunLogs(runId!);
      return res.data || [];
    },
    enabled: !!runId,
  });
}

export function useDispatchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload?: DispatchTaskPayload }) =>
      apiClient.dispatchTask(taskId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useDispatchEpic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ epicId, payload }: { epicId: number; payload: DispatchEpicPayload }) =>
      apiClient.dispatchEpic(epicId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useSubmitHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, payload }: { runId: number; payload: HandoffPayload }) =>
      apiClient.submitHandoff(runId, payload).then((res) => res.data),
    onSuccess: (_data, { runId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.detail(runId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useApproveHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => apiClient.approveHandoff(taskId).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
    },
  });
}

export function useRejectHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: number; reason: string }) =>
      apiClient.rejectHandoff(taskId, reason).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
    },
  });
}

export function useCancelAgentRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, reason }: { runId: number; reason?: string }) =>
      apiClient.cancelAgentRun(runId, reason).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
    },
  });
}
