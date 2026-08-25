import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SprintBoard } from '@/components/tasks/SprintBoard';
import { Task, Sprint } from '@/api/types';

describe('SprintBoard Component (Tier 1, 2 & 3)', () => {
  const mockSprint: Sprint = {
    id: 10,
    project_id: 1,
    name: 'Sprint 24: Core Security',
    goal: 'Ship biometrics & mobile QR pairing',
    status: 'active',
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
  };

  const mockTasks: Task[] = [
    // 1 Parent Epic (13 points) - MUST BE STRICTLY EXCLUDED FROM STATS & BOARD
    {
      id: 1,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      title: 'Epic: Mobile Security & Authentication',
      issue_type: 'epic',
      status: 'in_progress',
      priority: 'urgent',
      story_points: 13,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    // Child Work Items (Total: 3 + 5 + 8 + 3 = 19 points)
    {
      id: 2,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      epic_id: 1,
      title: 'Story: Expo SecureStore Keychain wrapper',
      issue_type: 'story',
      status: 'done',
      priority: 'high',
      story_points: 3,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 3,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      epic_id: 1,
      title: 'Story: FaceID Biometric authorization prompt',
      issue_type: 'story',
      status: 'done',
      priority: 'high',
      story_points: 5,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 4,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      epic_id: 1,
      title: 'Task: QR Scanner camera view with barcode detector',
      issue_type: 'task',
      status: 'in_progress',
      priority: 'medium',
      story_points: 8,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 5,
      workspace_id: 1,
      project_id: 1,
      sprint_id: 10,
      epic_id: 1,
      title: 'Bug: Fix token whitespace trimming',
      issue_type: 'bug',
      status: 'todo',
      priority: 'urgent',
      story_points: 3,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ];

  describe('Tier 1: Scrum Hierarchy & Non-Epic Story Point Rollup Invariant', () => {
    it('calculates total sprint points strictly from child tasks (19 pts), completely excluding the 13 pt Epic', () => {
      const { getByTestId, queryByText } = render(
        <SprintBoard sprint={mockSprint} tasks={mockTasks} />
      );

      // Total points must be 19 (3+5+8+3), NOT 32 (19+13)
      const totalPoints = getByTestId('total-points-val');
      expect(totalPoints.props.children).toBe(19);

      // Done points must be 8 (3+5)
      const donePoints = getByTestId('done-points-val');
      expect(donePoints.props.children).toBe(8);

      // In progress points must be 8 (task 4), NOT 21 (task 4 + Epic 1)
      const inProgressPoints = getByTestId('in-progress-points-val');
      expect(inProgressPoints.props.children).toBe(8);

      // Todo points must be 3 (task 5)
      const todoPoints = getByTestId('todo-points-val');
      expect(todoPoints.props.children).toBe(3);

      // Verify the parent Epic card does NOT exist on the board
      expect(queryByText('Epic: Mobile Security & Authentication')).toBeNull();
    });

    it('renders all four Kanban columns with accurate child task allocations', () => {
      const { getByTestId, getByText } = render(
        <SprintBoard sprint={mockSprint} tasks={mockTasks} />
      );

      expect(getByTestId('column-todo')).toBeTruthy();
      expect(getByTestId('column-in-progress')).toBeTruthy();
      expect(getByTestId('column-review')).toBeTruthy();
      expect(getByTestId('column-done')).toBeTruthy();

      expect(getByText('TODO (1)')).toBeTruthy();
      expect(getByText('IN PROGRESS (1)')).toBeTruthy();
      expect(getByText('DONE (2)')).toBeTruthy();
    });

    it('renders sprint header with title and goal text', () => {
      const { getByText } = render(<SprintBoard sprint={mockSprint} tasks={mockTasks} />);
      expect(getByText('Sprint 24: Core Security')).toBeTruthy();
      expect(getByText('Ship biometrics & mobile QR pairing')).toBeTruthy();
    });
  });

  describe('Tier 2 & 3: Interactions, Edge Cases & Pairwise Combinations', () => {
    it('triggers onTaskPress when a task card in any column is clicked', () => {
      const onTaskPress = jest.fn();
      const { getByTestId } = render(
        <SprintBoard sprint={mockSprint} tasks={mockTasks} onTaskPress={onTaskPress} />
      );

      const taskCard = getByTestId('task-card-4');
      fireEvent.press(taskCard);

      expect(onTaskPress).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 4,
          title: 'Task: QR Scanner camera view with barcode detector',
        })
      );
    });

    it('handles empty task list gracefully with all 0 stats', () => {
      const { getByTestId } = render(<SprintBoard sprint={mockSprint} tasks={[]} />);

      expect(getByTestId('total-points-val').props.children).toBe(0);
      expect(getByTestId('done-points-val').props.children).toBe(0);
      expect(getByTestId('in-progress-points-val').props.children).toBe(0);
      expect(getByTestId('todo-points-val').props.children).toBe(0);
    });

    it('handles sprint containing only Epics by displaying 0 points and 0 cards', () => {
      const onlyEpics: Task[] = [
        {
          id: 99,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          title: 'Standalone Epic',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'urgent',
          story_points: 50,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      const { getByTestId } = render(<SprintBoard sprint={mockSprint} tasks={onlyEpics} />);

      expect(getByTestId('total-points-val').props.children).toBe(0);
      expect(getByTestId('in-progress-points-val').props.children).toBe(0);
    });

    it('handles tasks without story points (null/undefined) safely without NaN', () => {
      const unestimatedTasks: Task[] = [
        {
          id: 10,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          title: 'Unestimated Spike',
          issue_type: 'story',
          status: 'todo',
          priority: 'medium',
          story_points: null,
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      const { getByTestId } = render(<SprintBoard sprint={mockSprint} tasks={unestimatedTasks} />);

      expect(getByTestId('total-points-val').props.children).toBe(0);
    });

    it('allocates review status tasks into review column', () => {
      const reviewTasks: Task[] = [
        {
          id: 60,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 10,
          title: 'Under Review Task',
          issue_type: 'task',
          status: 'review',
          priority: 'low',
          story_points: 2,
          created_at: '',
          updated_at: '',
        },
      ];

      const { getByTestId, getByText } = render(
        <SprintBoard sprint={mockSprint} tasks={reviewTasks} />
      );

      expect(getByText('REVIEW (1)')).toBeTruthy();
      expect(getByTestId('task-card-60')).toBeTruthy();
    });

    it('renders sprint board without goal description gracefully', () => {
      const sprintNoGoal: Sprint = { ...mockSprint, goal: undefined };
      const { queryByText, getByText } = render(
        <SprintBoard sprint={sprintNoGoal} tasks={mockTasks} />
      );

      expect(getByText('Sprint 24: Core Security')).toBeTruthy();
      expect(queryByText('Ship biometrics & mobile QR pairing')).toBeNull();
    });
  });
});
