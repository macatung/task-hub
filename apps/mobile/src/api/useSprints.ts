import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryClient';
import {
  SprintWithRollup,
  CreateSprintPayload,
  UpdateSprintPayload,
  StartSprintPayload,
  CompleteSprintPayload,
  MoveTasksPayload,
} from './types';
import { useSprintTasks } from './useTasks';
import { calculateSprintStats } from '../utils/sprintStats';

export function useSprints(projectId?: number | 'all') {
  return useQuery({
    queryKey: queryKeys.sprints.list(projectId === 'all' ? null : projectId),
    queryFn: async () => {
      const res = await apiClient.getSprints(projectId);
      return res.data || [];
    },
    enabled: projectId !== undefined,
  });
}

export function useActiveSprint(projectId?: number) {
  const { data: sprints, isLoading, error, refetch } = useSprints(projectId);
  const activeSprint: SprintWithRollup | undefined = sprints?.find(
    (s) => s.status === 'active'
  );

  return {
    activeSprint,
    sprints,
    isLoading,
    error,
    refetch,
  };
}

export function useSprintWithRollup(sprintId?: number, projectId?: number) {
  const { data: sprints, isLoading: sprintsLoading, error: sprintsError } = useSprints(projectId);
  const { data: sprintTasks, isLoading: tasksLoading, error: tasksError } = useSprintTasks(
    projectId,
    sprintId
  );

  const sprint = sprints?.find((s) => s.id === sprintId);
  const stats = calculateSprintStats(sprintTasks || []);

  const sprintWithRollup: SprintWithRollup | undefined = sprint
    ? {
        ...sprint,
        total_points: stats.totalPoints,
        done_points: stats.donePoints,
        in_progress_points: stats.inProgressPoints,
        todo_points: stats.todoPoints,
        total_tasks: stats.totalTasks,
        done_tasks: stats.doneTasks,
        tasks: sprintTasks,
      }
    : undefined;

  return {
    sprint: sprintWithRollup,
    stats,
    isLoading: sprintsLoading || tasksLoading,
    error: sprintsError || tasksError,
  };
}

export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSprintPayload) =>
      apiClient.createSprint(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
    },
  });
}

export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSprintPayload }) =>
      apiClient.updateSprint(id, payload).then((res) => res.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.detail(id) });
    },
  });
}

export function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sprintId, payload }: { sprintId: number; payload?: StartSprintPayload }) =>
      apiClient.startSprint(sprintId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sprintId,
      payload,
    }: {
      sprintId: number;
      payload?: CompleteSprintPayload;
    }) => apiClient.completeSprint(sprintId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useMoveTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MoveTasksPayload) =>
      apiClient.moveTasks(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}
