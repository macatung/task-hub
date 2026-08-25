import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import TaskDetailScreen from '../../app/tasks/[id]';
import NewTaskModal from '../../app/tasks/new';
import {
  mockTasksApi,
  mockAgentRunsApi,
  mockSprintsApi,
} from '../../jest.setup';
import { Task } from '@/api/types';

// Mock Alert.alert
const alertSpy = jest.fn();
(Alert as any).alert = alertSpy;

describe('Empirical Challenge: TaskDetailScreen and NewTaskModal', () => {
  beforeEach(() => {
    (mockTasksApi as any).__resetTasksMock();
    (mockAgentRunsApi as any).__resetAgentRunsMock();
    (mockSprintsApi as any).__resetSprintsMock();
    alertSpy.mockClear();
  });

  // =========================================================================
  // 1. TaskDetailScreen Empirical Challenges
  // =========================================================================
  describe('TaskDetailScreen (apps/mobile/app/tasks/[id].tsx)', () => {
    const baseTask: Task = {
      id: 42,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      title: 'Auth Flow Optimization',
      description: 'Optimize OAuth handshake speed.',
      issue_type: 'task',
      status: 'in_progress',
      priority: 'urgent',
      story_points: 8,
      estimated_pomodoros: 6,
      completed_pomodoros: 2,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    };

    it('displays blocking dependency warning banner when incomplete prerequisites exist', () => {
      const taskWithBlocker: Task = {
        ...baseTask,
        dependencies: [
          {
            id: 1,
            task_id: 42,
            depends_on_task_id: 10,
            dependency_type: 'blocks',
            depends_on: {
              id: 10,
              title: 'Database Migration Schema',
              status: 'in_progress', // Not done -> blocker!
            },
            created_at: '',
            updated_at: '',
          },
        ],
      };

      (mockTasksApi as any).__setCurrentTask(taskWithBlocker);

      const { getByTestId, getByText } = render(<TaskDetailScreen />);

      expect(getByTestId('dependency-warning-banner')).toBeTruthy();
      expect(getByText('Blocked by Incomplete Prerequisite')).toBeTruthy();
      expect(getByText('Database Migration Schema')).toBeTruthy();
    });

    it('does NOT display blocking dependency warning banner when all prerequisites are done', () => {
      const taskWithCompletedPrereqs: Task = {
        ...baseTask,
        dependencies: [
          {
            id: 1,
            task_id: 42,
            depends_on_task_id: 10,
            dependency_type: 'blocks',
            depends_on: {
              id: 10,
              title: 'Database Migration Schema',
              status: 'done', // Done -> not blocking
            },
            created_at: '',
            updated_at: '',
          },
        ],
      };

      (mockTasksApi as any).__setCurrentTask(taskWithCompletedPrereqs);

      const { queryByTestId } = render(<TaskDetailScreen />);
      expect(queryByTestId('dependency-warning-banner')).toBeNull();
    });

    it('handles fallback to Task #ID when prerequisite depends_on title is undefined', () => {
      const taskWithIdOnlyBlocker: Task = {
        ...baseTask,
        dependencies: [
          {
            id: 1,
            task_id: 42,
            depends_on_task_id: 88,
            dependency_type: 'blocks',
            depends_on: {
              id: 88,
              title: '',
              status: 'todo',
            },
            created_at: '',
            updated_at: '',
          },
        ],
      };

      (mockTasksApi as any).__setCurrentTask(taskWithIdOnlyBlocker);

      const { getByTestId } = render(<TaskDetailScreen />);
      expect(getByTestId('dependency-warning-banner')).toBeTruthy();
    });

    it('pomodoro stepper increments completed_pomodoros via updateTask mutation', () => {
      (mockTasksApi as any).__setCurrentTask(baseTask);

      const { getByTestId, getByText } = render(<TaskDetailScreen />);

      expect(getByText('🍅 2/6')).toBeTruthy();

      fireEvent.press(getByTestId('pomodoro-increment-btn'));

      expect(mockTasksApi.mockUpdateTaskMutateFn).toHaveBeenCalledWith({
        id: 42,
        payload: { completed_pomodoros: 3 },
      });
    });

    it('pomodoro focus timer toggles active state', () => {
      (mockTasksApi as any).__setCurrentTask(baseTask);

      const { getByTestId, getByText } = render(<TaskDetailScreen />);

      expect(getByText('Start 25m Focus')).toBeTruthy();

      fireEvent.press(getByTestId('pomodoro-timer-btn'));
      expect(getByText('Running (25m)')).toBeTruthy();

      fireEvent.press(getByTestId('pomodoro-timer-btn'));
      expect(getByText('Start 25m Focus')).toBeTruthy();
    });

    it('renders Quick Dispatch button when no agent run exists, and triggers dispatch alert', () => {
      (mockTasksApi as any).__setCurrentTask(baseTask);
      (mockAgentRunsApi as any).__setAgentRuns([]);

      const { getByTestId, getByText } = render(<TaskDetailScreen />);

      const dispatchBtn = getByTestId('dispatch-agent-btn');
      expect(dispatchBtn).toBeTruthy();
      expect(getByText('Dispatch AI Agent')).toBeTruthy();

      fireEvent.press(dispatchBtn);
      expect(alertSpy).toHaveBeenCalledWith(
        'Dispatch Agent',
        'Remote agent runner dispatch initiated.'
      );
    });

    it('renders review button when latest agent run is needs_review', () => {
      (mockTasksApi as any).__setCurrentTask(baseTask);
      (mockAgentRunsApi as any).__setAgentRuns([
        {
          id: 501,
          task_id: 42,
          status: 'needs_review',
          provider: 'claude-3-5-sonnet',
          created_at: '',
          updated_at: '',
        },
      ]);

      const { getByText, queryByTestId } = render(<TaskDetailScreen />);

      expect(queryByTestId('dispatch-agent-btn')).toBeNull();
      expect(getByText('Review Handoff & Evidence')).toBeTruthy();
    });

    it('renders view logs button when latest agent run is running', () => {
      (mockTasksApi as any).__setCurrentTask(baseTask);
      (mockAgentRunsApi as any).__setAgentRuns([
        {
          id: 502,
          task_id: 42,
          status: 'running',
          provider: 'gpt-4o',
          created_at: '',
          updated_at: '',
        },
      ]);

      const { getByText, queryByTestId } = render(<TaskDetailScreen />);

      expect(queryByTestId('dispatch-agent-btn')).toBeNull();
      expect(getByText('View Live Execution Logs')).toBeTruthy();
    });
  });

  // =========================================================================
  // 2. NewTaskModal Empirical Challenges
  // =========================================================================
  describe('NewTaskModal (apps/mobile/app/tasks/new.tsx)', () => {
    beforeEach(() => {
      (mockTasksApi as any).__setEpicsList([
        {
          id: 10,
          workspace_id: 1,
          project_id: 1,
          title: 'Milestone 4 Epic',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'high',
          created_at: '',
          updated_at: '',
        },
      ]);

      (mockSprintsApi as any).__setSprintsList([
        {
          id: 101,
          project_id: 1,
          name: 'Sprint 1',
          goal: 'Core UI',
          status: 'active',
          created_at: '',
          updated_at: '',
        },
      ]);
    });

    it('enforces validation error when submitting with empty title', async () => {
      const { getByTestId, getByText } = render(<NewTaskModal />);

      // Submit without entering title
      fireEvent.press(getByTestId('submit-create-task-btn'));

      expect(getByText('Task title is required.')).toBeTruthy();
      expect(mockTasksApi.mockCreateTaskFn).not.toHaveBeenCalled();
    });

    it('enforces validation error when submitting whitespace-only title', async () => {
      const { getByTestId, getByText } = render(<NewTaskModal />);

      // Enter spaces
      fireEvent.changeText(getByTestId('input-title'), '    ');
      fireEvent.press(getByTestId('submit-create-task-btn'));

      expect(getByText('Task title is required.')).toBeTruthy();
      expect(mockTasksApi.mockCreateTaskFn).not.toHaveBeenCalled();
    });

    it('allows Fibonacci story point selection and sends correct value', async () => {
      const { getByTestId } = render(<NewTaskModal />);

      // Enter valid title
      fireEvent.changeText(getByTestId('input-title'), 'Refactor auth state');

      // Select Fibonacci point 8
      fireEvent.press(getByTestId('point-pill-8'));

      // Submit form
      fireEvent.press(getByTestId('submit-create-task-btn'));

      await waitFor(() => {
        expect(mockTasksApi.mockCreateTaskFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Refactor auth state',
            story_points: 8,
          })
        );
      });
    });

    it('allows setting story points to None (null)', async () => {
      const { getByTestId } = render(<NewTaskModal />);

      fireEvent.changeText(getByTestId('input-title'), 'Investigate memory leak');
      fireEvent.press(getByTestId('point-pill-none'));

      fireEvent.press(getByTestId('submit-create-task-btn'));

      await waitFor(() => {
        expect(mockTasksApi.mockCreateTaskFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Investigate memory leak',
            story_points: null,
          })
        );
      });
    });

    it('hides sprint and epic pickers and enforces sprint_id=null when Epic is selected', async () => {
      const { getByTestId, queryByTestId } = render(<NewTaskModal />);

      // Initially issue_type is 'story', pickers are present
      expect(getByTestId('select-sprint')).toBeTruthy();
      expect(getByTestId('select-epic')).toBeTruthy();

      // Select Sprint 1
      fireEvent.press(getByTestId('sprint-pill-101'));

      // Switch issue type to 'EPIC'
      fireEvent.press(getByTestId('issue-type-epic'));

      // Verify sprint and epic pickers are removed from DOM
      expect(queryByTestId('select-sprint')).toBeNull();
      expect(queryByTestId('select-epic')).toBeNull();

      // Enter title and submit
      fireEvent.changeText(getByTestId('input-title'), 'New Major Initiative Epic');
      fireEvent.press(getByTestId('submit-create-task-btn'));

      // Verify sprint_id and epic_id are null
      await waitFor(() => {
        expect(mockTasksApi.mockCreateTaskFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Major Initiative Epic',
            issue_type: 'epic',
            sprint_id: null,
            epic_id: null,
          })
        );
      });
    });

    it('estimated pomodoro stepper increments and decrements with min limit 1', async () => {
      const { getByTestId, getByText } = render(<NewTaskModal />);

      // Default is 2
      expect(getByText('2')).toBeTruthy();

      // Increment to 3
      fireEvent.press(getByTestId('stepper-inc-btn'));
      expect(getByText('3')).toBeTruthy();

      // Decrement twice (to 2, then to 1)
      fireEvent.press(getByTestId('stepper-dec-btn'));
      expect(getByText('2')).toBeTruthy();
      fireEvent.press(getByTestId('stepper-dec-btn'));
      expect(getByText('1')).toBeTruthy();

      // Decrement again -> clamped at 1
      fireEvent.press(getByTestId('stepper-dec-btn'));
      expect(getByText('1')).toBeTruthy();

      fireEvent.changeText(getByTestId('input-title'), 'Write unit tests');
      fireEvent.press(getByTestId('submit-create-task-btn'));

      await waitFor(() => {
        expect(mockTasksApi.mockCreateTaskFn).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Write unit tests',
            estimated_pomodoros: 1,
          })
        );
      });
    });
  });
});
