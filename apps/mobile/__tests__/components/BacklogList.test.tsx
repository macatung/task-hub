import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BacklogList } from '@/components/tasks/BacklogList';
import { Task } from '@/api/types';

describe('BacklogList Component (Tier 1, 2 & 3)', () => {
  const mockTasks: Task[] = [
    // Parent Epic - MUST be strictly filtered out of backlog execution list
    {
      id: 100,
      workspace_id: 1,
      project_id: 1,
      title: 'Parent Epic Planning Item',
      issue_type: 'epic',
      status: 'todo',
      priority: 'high',
      story_points: 21,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    // Backlog tasks
    {
      id: 101,
      workspace_id: 1,
      project_id: 1,
      title: 'Implement Dark Mode tokens',
      issue_type: 'task',
      status: 'todo',
      priority: 'medium',
      story_points: 5,
      issue_key: 'TH-101',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 102,
      workspace_id: 1,
      project_id: 1,
      title: 'Fix offline sync conflict resolution',
      issue_type: 'bug',
      status: 'todo',
      priority: 'urgent',
      story_points: 8,
      issue_key: 'TH-102',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 103,
      workspace_id: 1,
      project_id: 1,
      title: 'Add Mermaid diagrams zoom control',
      issue_type: 'story',
      status: 'todo',
      priority: 'low',
      story_points: 3,
      issue_key: 'TH-103',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ];

  it('renders backlog items strictly excluding Epics and calculates total points correctly', () => {
    const { getByTestId, queryByText, getByText } = render(
      <BacklogList tasks={mockTasks} activeSprintId={5} />
    );

    expect(getByTestId('backlog-list-container')).toBeTruthy();
    expect(getByTestId('backlog-item-101')).toBeTruthy();
    expect(getByTestId('backlog-item-102')).toBeTruthy();
    expect(getByTestId('backlog-item-103')).toBeTruthy();

    // Epic 100 must NOT appear
    expect(queryByText('Parent Epic Planning Item')).toBeNull();

    // Total points: 5 + 8 + 3 = 16 pts, 3 items
    expect(getByText('3 items · 16 pts')).toBeTruthy();
  });

  it('filters backlog tasks based on search input query', () => {
    const { getByPlaceholderText, queryByText, getByText } = render(
      <BacklogList tasks={mockTasks} />
    );

    const searchInput = getByPlaceholderText('Search backlog tasks...');
    fireEvent.changeText(searchInput, 'Dark Mode');

    expect(getByText('Implement Dark Mode tokens')).toBeTruthy();
    expect(queryByText('Fix offline sync conflict resolution')).toBeNull();
  });

  it('invokes onMoveToSprint when quick Sprint action button is pressed', () => {
    const onMoveToSprint = jest.fn();
    const { getByTestId } = render(
      <BacklogList tasks={mockTasks} activeSprintId={5} onMoveToSprint={onMoveToSprint} />
    );

    fireEvent.press(getByTestId('move-to-sprint-btn-101'));
    expect(onMoveToSprint).toHaveBeenCalledWith([101], 5);
  });

  it('renders empty state message when there are no backlog tasks', () => {
    const onNewTask = jest.fn();
    const { getByText, getByTestId } = render(<BacklogList tasks={[]} onNewTask={onNewTask} />);

    expect(getByText('Backlog is empty')).toBeTruthy();
    fireEvent.press(getByTestId('empty-create-task-btn'));
    expect(onNewTask).toHaveBeenCalled();
  });

  it('triggers onTaskPress when clicking a backlog item', () => {
    const onTaskPress = jest.fn();
    const { getByTestId } = render(
      <BacklogList tasks={mockTasks} onTaskPress={onTaskPress} />
    );

    fireEvent.press(getByTestId('backlog-item-102'));
    expect(onTaskPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 102, title: 'Fix offline sync conflict resolution' })
    );
  });
});
