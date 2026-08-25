import { QueryClient } from '@tanstack/react-query';
import { queryKeys, queryClient as defaultQueryClient, CACHE_STORAGE_KEY } from '@/api/queryClient';
import { calculateSprintStats } from '@/utils/sprintStats';
import { Task, UpdateTaskPayload } from '@/api/types';

describe('Adversarial Challenge: State Management, Query Keys & Optimistic Hooks', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 2,
          gcTime: 1000 * 60 * 60 * 24,
          retry: (failureCount, error: any) => {
            if (error?.status && error.status >= 400 && error.status < 500) {
              return false;
            }
            return failureCount < 2;
          },
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
        },
      },
    });
  });

  afterEach(() => {
    testQueryClient.clear();
    jest.clearAllMocks();
  });

  describe('1. Challenge Query Key Hierarchy & Prefix Invalidation', () => {
    it('hierarchically invalidates child queries when parent domain key is invalidated', () => {
      // Seed test query caches across domain hierarchy
      testQueryClient.setQueryData(queryKeys.workspaces.list(), [{ id: 1, name: 'WS1' }]);
      testQueryClient.setQueryData(queryKeys.workspaces.detail(1), { id: 1, name: 'WS1' });
      testQueryClient.setQueryData(queryKeys.projects.list(1), [{ id: 10, title: 'Proj1' }]);
      testQueryClient.setQueryData(queryKeys.projects.detail(10), { id: 10, title: 'Proj1' });
      testQueryClient.setQueryData(queryKeys.sprints.list(10), [{ id: 101, name: 'Sprint 1' }]);
      testQueryClient.setQueryData(queryKeys.sprints.detail(101), { id: 101, name: 'Sprint 1' });
      testQueryClient.setQueryData(queryKeys.tasks.list({ project_id: 10 }), [{ id: 7, title: 'Task 7' }]);
      testQueryClient.setQueryData(queryKeys.tasks.sprintTasks(10, 101), [{ id: 7, title: 'Task 7' }]);
      testQueryClient.setQueryData(queryKeys.tasks.detail(7), { id: 7, title: 'Task 7' });
      testQueryClient.setQueryData(queryKeys.agentRuns.list({ task_id: 7 }), [{ id: 201 }]);

      // Verify all are initially fresh (not invalidated)
      expect(testQueryClient.getQueryState(queryKeys.tasks.list({ project_id: 10 }))?.isInvalidated).toBe(false);
      expect(testQueryClient.getQueryState(queryKeys.tasks.sprintTasks(10, 101))?.isInvalidated).toBe(false);
      expect(testQueryClient.getQueryState(queryKeys.tasks.detail(7))?.isInvalidated).toBe(false);

      // Invalidate tasks.all -> should invalidate all task queries
      testQueryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

      expect(testQueryClient.getQueryState(queryKeys.tasks.list({ project_id: 10 }))?.isInvalidated).toBe(true);
      expect(testQueryClient.getQueryState(queryKeys.tasks.sprintTasks(10, 101))?.isInvalidated).toBe(true);
      expect(testQueryClient.getQueryState(queryKeys.tasks.detail(7))?.isInvalidated).toBe(true);

      // Sprints and Projects must NOT be affected by tasks invalidation
      expect(testQueryClient.getQueryState(queryKeys.sprints.list(10))?.isInvalidated).toBe(false);
      expect(testQueryClient.getQueryState(queryKeys.projects.list(1))?.isInvalidated).toBe(false);
    });

    it('handles null and undefined parameters symmetrically in query key factories', () => {
      const keyNull = queryKeys.projects.list(null);
      const keyUndefined = queryKeys.projects.list(undefined);

      expect(keyNull).toEqual(['projects', 'list', { workspaceId: null }]);
      expect(keyUndefined).toEqual(['projects', 'list', { workspaceId: undefined }]);

      const sprintKeyNull = queryKeys.sprints.list(null);
      const sprintKeyUndefined = queryKeys.sprints.list(undefined);
      expect(sprintKeyNull).toEqual(['sprints', 'list', { projectId: null }]);
      expect(sprintKeyUndefined).toEqual(['sprints', 'list', { projectId: undefined }]);
    });

    it('verifies 4xx errors do not retry while 5xx/network errors retry up to 2 times', () => {
      const retryFn = defaultQueryClient.getDefaultOptions().queries?.retry as (
        count: number,
        err: any
      ) => boolean;

      expect(typeof retryFn).toBe('function');

      // 4xx errors must NEVER retry
      expect(retryFn(0, { status: 400 })).toBe(false);
      expect(retryFn(0, { status: 401 })).toBe(false);
      expect(retryFn(0, { status: 403 })).toBe(false);
      expect(retryFn(0, { status: 404 })).toBe(false);
      expect(retryFn(0, { status: 422 })).toBe(false);

      // 5xx and network errors retry when failureCount < 2
      expect(retryFn(0, { status: 500 })).toBe(true);
      expect(retryFn(1, { status: 500 })).toBe(true);
      expect(retryFn(2, { status: 500 })).toBe(false);

      // Network errors (no status code)
      expect(retryFn(0, new Error('Network timeout'))).toBe(true);
      expect(retryFn(1, new Error('Network timeout'))).toBe(true);
      expect(retryFn(2, new Error('Network timeout'))).toBe(false);
    });
  });

  describe('2. Challenge Sprint Rollup & Non-Epic Filtering Boundary Conditions', () => {
    it('handles mixed task lists with large epic point values without double counting', () => {
      const mixedTasks: Task[] = [
        {
          id: 100,
          workspace_id: 1,
          project_id: 1,
          title: 'Parent Epic: Core Architecture',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'urgent',
          story_points: 89, // Huge points on Epic
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 101,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          epic_id: 100,
          title: 'Story 1',
          issue_type: 'story',
          status: 'done',
          priority: 'medium',
          story_points: 8,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 102,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          epic_id: 100,
          title: 'Story 2',
          issue_type: 'story',
          status: 'verified' as any, // Status variant counted as done
          priority: 'high',
          story_points: 5,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 103,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          epic_id: 100,
          title: 'Task 3',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'low',
          story_points: 3,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 104,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          epic_id: 100,
          title: 'Task 4',
          issue_type: 'task',
          status: 'review',
          priority: 'medium',
          story_points: 2,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 105,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          epic_id: 100,
          title: 'Bug 5',
          issue_type: 'bug',
          status: 'todo',
          priority: 'urgent',
          story_points: 1,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      const stats = calculateSprintStats(mixedTasks);

      // Expected total: 8 + 5 + 3 + 2 + 1 = 19 points (excluding 89 pt Epic)
      expect(stats.totalPoints).toBe(19);
      expect(stats.donePoints).toBe(13); // 8 + 5
      expect(stats.inProgressPoints).toBe(5); // 3 (in_progress) + 2 (review)
      expect(stats.todoPoints).toBe(1); // 1 (todo)
      expect(stats.totalTasks).toBe(5);
      expect(stats.doneTasks).toBe(2);
      expect(stats.completionPercentage).toBe(Math.round((13 / 19) * 100)); // 68%
    });

    it('handles empty task list, null/undefined inputs, and all-epic lists gracefully', () => {
      expect(calculateSprintStats([])).toEqual({
        totalPoints: 0,
        donePoints: 0,
        inProgressPoints: 0,
        todoPoints: 0,
        totalTasks: 0,
        doneTasks: 0,
        completionPercentage: 0,
      });

      expect(calculateSprintStats(null as any)).toEqual({
        totalPoints: 0,
        donePoints: 0,
        inProgressPoints: 0,
        todoPoints: 0,
        totalTasks: 0,
        doneTasks: 0,
        completionPercentage: 0,
      });

      // All epics -> 0 points, 0 tasks
      const allEpics: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Epic 1',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'medium',
          story_points: 21,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];
      const epicStats = calculateSprintStats(allEpics);
      expect(epicStats.totalPoints).toBe(0);
      expect(epicStats.totalTasks).toBe(0);
    });

    it('handles tasks with null, NaN, or undefined story points', () => {
      const messyTasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Unestimated task',
          issue_type: 'task',
          status: 'done',
          priority: 'low',
          story_points: null as any,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          title: 'NaN task',
          issue_type: 'story',
          status: 'todo',
          priority: 'medium',
          story_points: NaN,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        {
          id: 3,
          workspace_id: 1,
          project_id: 1,
          title: 'Valid task',
          issue_type: 'task',
          status: 'done',
          priority: 'high',
          story_points: 5,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      const stats = calculateSprintStats(messyTasks);
      expect(stats.totalPoints).toBe(5);
      expect(stats.donePoints).toBe(5);
      expect(stats.totalTasks).toBe(3);
      expect(stats.doneTasks).toBe(2);
      expect(stats.completionPercentage).toBe(100);
    });
  });

  describe('3. Challenge Optimistic Mutation Mechanics & Cache Type Heterogeneity', () => {
    const initialTasks: Task[] = [
      {
        id: 1,
        workspace_id: 1,
        project_id: 10,
        sprint_id: 101,
        title: 'Initial Task 1',
        issue_type: 'task',
        status: 'todo',
        priority: 'medium',
        created_at: '2026-08-25T00:00:00Z',
        updated_at: '2026-08-25T00:00:00Z',
      },
      {
        id: 2,
        workspace_id: 1,
        project_id: 10,
        sprint_id: 101,
        title: 'Initial Task 2',
        issue_type: 'story',
        status: 'in_progress',
        priority: 'high',
        created_at: '2026-08-25T00:00:00Z',
        updated_at: '2026-08-25T00:00:00Z',
      },
    ];

    it('empirically demonstrates type mismatch crash when tasks.all updater executes on task detail object', () => {
      const detailKey = queryKeys.tasks.detail(1);
      testQueryClient.setQueryData(detailKey, initialTasks[0]);

      // When useUpdateTask executes unguarded:
      // queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, (old) => { if (!old) return []; return old.map(...) })
      // Because detailKey starts with 'tasks', old is a Task object (not an array), which lacks .map()
      let mapThrew = false;
      try {
        testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
          if (!old) return [];
          return old.map((t: any) => (t.id === 1 ? { ...t, status: 'done' } : t));
        });
      } catch (err: any) {
        mapThrew = true;
        expect(err.message).toContain('old.map is not a function');
      }
      expect(mapThrew).toBe(true);

      // When useCreateTask executes unguarded:
      // return [optimisticTask, ...old]
      let spreadThrew = false;
      try {
        testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
          if (!old) return [{ id: -1 }];
          return [{ id: -1 }, ...old];
        });
      } catch (err: any) {
        spreadThrew = true;
      }
      expect(spreadThrew).toBe(true);

      // When useDeleteTask executes unguarded:
      // return old.filter((t) => t.id !== id)
      let filterThrew = false;
      try {
        testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
          if (!old) return [];
          return old.filter((t: any) => t.id !== 1);
        });
      } catch (err: any) {
        filterThrew = true;
        expect(err.message).toContain('old.filter is not a function');
      }
      expect(filterThrew).toBe(true);
    });

    it('verifies safe guarded updater pattern resolves heterogeneous cache mutations cleanly', async () => {
      const listKey = queryKeys.tasks.list({ project_id: 10 });
      const detailKey = queryKeys.tasks.detail(1);

      testQueryClient.setQueryData(listKey, [...initialTasks]);
      testQueryClient.setQueryData(detailKey, initialTasks[0]);

      // Safe update pattern: guard against non-array queries (e.g. detail objects)
      const updatePayload: UpdateTaskPayload = { status: 'done', title: 'Updated Title' };
      testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) => (t.id === 1 ? { ...t, ...updatePayload } : t));
      });

      // Update detail key explicitly
      const prevDetail = testQueryClient.getQueryData<Task>(detailKey);
      if (prevDetail) {
        testQueryClient.setQueryData(detailKey, { ...prevDetail, ...updatePayload });
      }

      // Verify both list and detail updated without throwing
      expect(testQueryClient.getQueryData<Task[]>(listKey)?.[0].status).toBe('done');
      expect(testQueryClient.getQueryData<Task>(detailKey)?.status).toBe('done');
    });

    it('creates task optimistically and rolls back precisely on mutation error', async () => {
      const listKey = queryKeys.tasks.list({ project_id: 10 });
      const sprintKey = queryKeys.tasks.sprintTasks(10, 101);

      testQueryClient.setQueryData(listKey, [...initialTasks]);
      testQueryClient.setQueryData(sprintKey, [...initialTasks]);

      // Safe onMutate logic for useCreateTask
      await testQueryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previousTasks = testQueryClient.getQueriesData<Task[]>({
        queryKey: queryKeys.tasks.all,
      });

      const optimisticTask: Task = {
        id: -12345,
        workspace_id: 1,
        project_id: 10,
        sprint_id: 101,
        epic_id: null,
        title: 'Optimistic New Task',
        description: null,
        issue_type: 'task',
        status: 'todo',
        priority: 'medium',
        category: null,
        story_points: 3,
        estimated_pomodoros: null,
        completed_pomodoros: 0,
        start_date: null,
        due_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return [optimisticTask, ...old];
      });

      // Verify immediate optimistic presence in both queries
      const updatedList = testQueryClient.getQueryData<Task[]>(listKey);
      const updatedSprint = testQueryClient.getQueryData<Task[]>(sprintKey);
      expect(updatedList?.[0].title).toBe('Optimistic New Task');
      expect(updatedSprint?.[0].title).toBe('Optimistic New Task');
      expect(updatedList?.length).toBe(3);

      // Simulate network error -> onError rollback
      previousTasks.forEach(([queryKey, data]) => {
        testQueryClient.setQueryData(queryKey, data);
      });

      // Verify full rollback to original state
      const rolledBackList = testQueryClient.getQueryData<Task[]>(listKey);
      const rolledBackSprint = testQueryClient.getQueryData<Task[]>(sprintKey);
      expect(rolledBackList).toEqual(initialTasks);
      expect(rolledBackSprint).toEqual(initialTasks);
      expect(rolledBackList?.length).toBe(2);
    });

    it('deletes task optimistically and restores on mutation failure', async () => {
      const listKey = queryKeys.tasks.list({ project_id: 10 });
      testQueryClient.setQueryData(listKey, [...initialTasks]);

      // Safe onMutate for useDeleteTask
      await testQueryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previousTasks = testQueryClient.getQueriesData<Task[]>({
        queryKey: queryKeys.tasks.all,
      });

      testQueryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((t) => t.id !== 1);
      });

      // Verify optimistic removal
      const listAfterDelete = testQueryClient.getQueryData<Task[]>(listKey);
      expect(listAfterDelete?.length).toBe(1);
      expect(listAfterDelete?.[0].id).toBe(2);

      // Simulate error rollback
      previousTasks.forEach(([queryKey, data]) => {
        testQueryClient.setQueryData(queryKey, data);
      });

      // Verify restored
      const listAfterRollback = testQueryClient.getQueryData<Task[]>(listKey);
      expect(listAfterRollback?.length).toBe(2);
      expect(listAfterRollback?.[0].id).toBe(1);
    });
  });
});
