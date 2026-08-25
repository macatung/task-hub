import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Task } from '@/api/types';

describe('TaskCard Component (Tier 1 & 2)', () => {
  const baseTask: Task = {
    id: 42,
    workspace_id: 1,
    project_id: 10,
    sprint_id: 5,
    title: 'Implement SSE resilient client',
    description: 'Add auto-reconnect backoff and cursor resumption',
    issue_type: 'task',
    status: 'in_progress',
    priority: 'urgent',
    story_points: 5,
    estimated_pomodoros: 4,
    completed_pomodoros: 2,
    parent_epic: {
      id: 1,
      title: 'Mobile Real-Time Telemetry',
    },
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
  };

  describe('Tier 1: Card Rendering & Visual Indicators', () => {
    it('renders task title, issue type badge, and points correctly', () => {
      const { getByTestId } = render(<TaskCard task={baseTask} />);

      expect(getByTestId('task-title').props.children).toBe('Implement SSE resilient client');
      expect(getByTestId('issue-type-badge').props.children).toBe('TASK');
      expect(getByTestId('story-points-badge')).toBeTruthy();
      expect(getByTestId('priority-indicator')).toBeTruthy();
    });

    it('renders pomodoro progress indicator when estimates are present', () => {
      const { getByTestId } = render(<TaskCard task={baseTask} />);
      const pomodoroBadge = getByTestId('pomodoro-badge');
      expect(pomodoroBadge).toBeTruthy();
    });

    it('renders parent epic indicator when bound to an epic', () => {
      const { getByTestId } = render(<TaskCard task={baseTask} />);
      const epicLabel = getByTestId('parent-epic-label');
      expect(epicLabel).toBeTruthy();
      expect(epicLabel.props.children).toContain('Mobile Real-Time Telemetry');
    });

    it('triggers onPress with the task object when pressed', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(<TaskCard task={baseTask} onPress={onPress} />);

      fireEvent.press(getByTestId('task-card-42'));
      expect(onPress).toHaveBeenCalledWith(baseTask);
    });

    it('renders status text formatted in uppercase with underscores replaced', () => {
      const { getByTestId } = render(<TaskCard task={baseTask} />);
      expect(getByTestId('status-badge').props.children.props.children).toBe('IN PROGRESS');
    });
  });

  describe('Tier 2: Edge Cases & Different Issue Types', () => {
    it('renders Story issue type badge', () => {
      const storyTask: Task = { ...baseTask, id: 43, issue_type: 'story' };
      const { getByTestId } = render(<TaskCard task={storyTask} />);
      expect(getByTestId('issue-type-badge').props.children).toBe('STORY');
    });

    it('renders Bug issue type badge with high priority', () => {
      const bugTask: Task = { ...baseTask, id: 44, issue_type: 'bug', priority: 'high' };
      const { getByTestId } = render(<TaskCard task={bugTask} />);
      expect(getByTestId('issue-type-badge').props.children).toBe('BUG');
    });

    it('renders Epic issue type badge without parent epic label', () => {
      const epicTask: Task = { ...baseTask, id: 45, issue_type: 'epic', parent_epic: null };
      const { getByTestId, queryByTestId } = render(<TaskCard task={epicTask} />);
      expect(getByTestId('issue-type-badge').props.children).toBe('EPIC');
      expect(queryByTestId('parent-epic-label')).toBeNull();
    });

    it('renders low priority indicator correctly', () => {
      const lowTask: Task = { ...baseTask, id: 47, priority: 'low' };
      const { getByTestId } = render(<TaskCard task={lowTask} />);
      expect(getByTestId('priority-indicator')).toBeTruthy();
    });

    it('renders medium priority indicator correctly', () => {
      const medTask: Task = { ...baseTask, id: 48, priority: 'medium' };
      const { getByTestId } = render(<TaskCard task={medTask} />);
      expect(getByTestId('priority-indicator')).toBeTruthy();
    });

    it('renders cleanly without story points or pomodoros', () => {
      const bareTask: Task = {
        ...baseTask,
        id: 46,
        story_points: undefined,
        estimated_pomodoros: undefined,
        completed_pomodoros: undefined,
        parent_epic: null,
      };
      const { queryByTestId } = render(<TaskCard task={bareTask} />);
      expect(queryByTestId('story-points-badge')).toBeNull();
      expect(queryByTestId('pomodoro-badge')).toBeNull();
      expect(queryByTestId('parent-epic-label')).toBeNull();
    });
  });
});
