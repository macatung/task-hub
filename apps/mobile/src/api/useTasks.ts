import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './queryClient';
import {
  Task,
  TaskStatus,
  TaskQueryParams,
  CreateTaskPayload,
  UpdateTaskPayload,
} from './types';

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: async () => {
      const res = await apiClient.getTasks(params);
      return res.data || [];
    },
  });
}

export function useTask(id?: number) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id!),
    queryFn: async () => {
      const res = await apiClient.getTask(id!);
      return res.data;
    },
    enabled: !!id,
  });
}

/**
 * Retrieves Sprint execution work items, strictly filtering out Epics to enforce Scrum invariant.
 */
export function useSprintTasks(projectId?: number, sprintId?: number | null) {
  return useQuery({
    queryKey: queryKeys.tasks.sprintTasks(projectId, sprintId),
    queryFn: async () => {
      if (sprintId === undefined || sprintId === null) return [];
      const res = await apiClient.getTasks({
        project_id: projectId,
        sprint_id: sprintId,
      });
      // Invariant: Epics (issue_type === 'epic') are excluded from sprint boards & calculations
      return (res.data || []).filter((task) => task.issue_type !== 'epic');
    },
    enabled: sprintId !== undefined && sprintId !== null,
  });
}

export function useBacklogTasks(projectId?: number) {
  return useQuery({
    queryKey: queryKeys.tasks.backlog(projectId),
    queryFn: async () => {
      const res = await apiClient.getTasks({
        project_id: projectId,
        sprint_id: 'backlog',
      });
      return (res.data || []).filter((task) => task.issue_type !== 'epic');
    },
    enabled: projectId !== undefined,
  });
}

export function useEpics(projectId?: number) {
  return useQuery({
    queryKey: queryKeys.tasks.epics(projectId),
    queryFn: async () => {
      const res = await apiClient.getTasks({
        project_id: projectId,
        issue_type: 'epic',
      });
      return res.data || [];
    },
    enabled: projectId !== undefined,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      apiClient.createTask(payload).then((res) => res.data),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previousTasks = queryClient.getQueriesData<Task[]>({
        queryKey: queryKeys.tasks.all,
      });

      const optimisticTask: Task = {
        id: -Date.now(),
        workspace_id: newTask.workspace_id || 1,
        project_id: newTask.project_id,
        sprint_id: newTask.sprint_id || null,
        epic_id: newTask.epic_id || null,
        title: newTask.title,
        description: newTask.description || null,
        issue_type: newTask.issue_type || 'task',
        status: newTask.status || 'todo',
        priority: newTask.priority || 'medium',
        category: newTask.category || null,
        story_points: newTask.story_points ?? null,
        estimated_pomodoros: newTask.estimated_pomodoros ?? null,
        completed_pomodoros: 0,
        start_date: newTask.start_date || null,
        due_date: newTask.due_date || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old) => {
        if (!Array.isArray(old)) return old;
        return [optimisticTask, ...old];
      });

      return { previousTasks };
    },
    onError: (_err, _newTask, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTaskPayload }) =>
      apiClient.updateTask(id, payload).then((res) => res.data),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previousTasks = queryClient.getQueriesData<Task[]>({
        queryKey: queryKeys.tasks.all,
      });
      const previousDetail = queryClient.getQueryData<Task>(queryKeys.tasks.detail(id));

      queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) =>
          t.id === id ? { ...t, ...payload, updated_at: new Date().toISOString() } : t
        );
      });

      queryClient.setQueryData(
        queryKeys.tasks.detail(id),
        (oldDetail: Task | undefined) =>
          oldDetail ? { ...oldDetail, ...payload, updated_at: new Date().toISOString() } : oldDetail
      );

      return { previousTasks, previousDetail };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.tasks.detail(id), context.previousDetail);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiClient.deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previousTasks = queryClient.getQueriesData<Task[]>({
        queryKey: queryKeys.tasks.all,
      });

      queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((t) => t.id !== id);
      });

      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(id) });

      return { previousTasks };
    },
    onError: (_err, _id, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });
    },
  });
}

export function useToggleTaskStatus() {
  const updateTask = useUpdateTask();

  return {
    ...updateTask,
    toggleStatus: (task: Task) => {
      const nextStatus: TaskStatus =
        task.status === 'done'
          ? 'todo'
          : task.status === 'todo'
            ? 'in_progress'
            : task.status === 'in_progress'
              ? 'review'
              : 'done';
      return updateTask.mutateAsync({ id: task.id, payload: { status: nextStatus } });
    },
  };
}
