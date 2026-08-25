import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EpicHierarchy } from '@/components/tasks/EpicHierarchy';
import { Task } from '@/api/types';

describe('EpicHierarchy Component (Tier 1, 2 & 3)', () => {
  const mockEpics: Task[] = [
    {
      id: 10,
      workspace_id: 1,
      project_id: 1,
      title: 'Epic: Authentication & Key Management',
      issue_type: 'epic',
      status: 'in_progress',
      priority: 'urgent',
      issue_key: 'TH-10',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 20,
      workspace_id: 1,
      project_id: 1,
      title: 'Epic: Rich Renderers',
      issue_type: 'epic',
      status: 'todo',
      priority: 'high',
      issue_key: 'TH-20',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ];

  const mockTasks: Task[] = [
    // Children of Epic 10
    {
      id: 11,
      workspace_id: 1,
      project_id: 1,
      epic_id: 10,
      title: 'Child Story: Biometrics FaceID gate',
      issue_type: 'story',
      status: 'done',
      priority: 'urgent',
      story_points: 5,
      issue_key: 'TH-11',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 12,
      workspace_id: 1,
      project_id: 1,
      epic_id: 10,
      title: 'Child Task: Hardware Keychain storage',
      issue_type: 'task',
      status: 'in_progress',
      priority: 'high',
      story_points: 8,
      issue_key: 'TH-12',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    // Child of Epic 20
    {
      id: 21,
      workspace_id: 1,
      project_id: 1,
      epic_id: 20,
      title: 'Child Task: Diff Viewer component',
      issue_type: 'task',
      status: 'done',
      priority: 'medium',
      story_points: 3,
      issue_key: 'TH-21',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    // Standalone Task (no parent epic)
    {
      id: 31,
      workspace_id: 1,
      project_id: 1,
      epic_id: null,
      title: 'Standalone: Update app icon and splash screen',
      issue_type: 'task',
      status: 'todo',
      priority: 'low',
      story_points: 2,
      issue_key: 'TH-31',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ];

  it('renders epics list with story points rollup and progress bar', () => {
    const { getByTestId } = render(
      <EpicHierarchy epics={mockEpics} allTasks={mockTasks} />
    );

    expect(getByTestId('epic-hierarchy-container')).toBeTruthy();
    expect(getByTestId('epic-card-10')).toBeTruthy();
    expect(getByTestId('epic-card-20')).toBeTruthy();
    expect(getByTestId('epic-progress-bar-10')).toBeTruthy();
  });

  it('expands epic on press and reveals child tasks', () => {
    const { getByTestId } = render(
      <EpicHierarchy epics={mockEpics} allTasks={mockTasks} />
    );

    fireEvent.press(getByTestId('epic-toggle-btn-10'));
    expect(getByTestId('epic-child-list-10')).toBeTruthy();
  });

  it('handles empty state when no epics or tasks exist', () => {
    const { getByText } = render(
      <EpicHierarchy epics={[]} allTasks={[]} />
    );
    expect(getByText('No epics or tasks found in this project.')).toBeTruthy();
  });

  it('renders standalone tasks section when present', () => {
    const { getByText } = render(
      <EpicHierarchy epics={mockEpics} allTasks={mockTasks} />
    );
    expect(getByText('Standalone Tasks (1)')).toBeTruthy();
    expect(getByText('Standalone: Update app icon and splash screen')).toBeTruthy();
  });

  it('triggers onTaskPress when clicking a child task or standalone task', () => {
    const onTaskPress = jest.fn();
    const { getByTestId, getByText } = render(
      <EpicHierarchy epics={mockEpics} allTasks={mockTasks} onTaskPress={onTaskPress} />
    );

    fireEvent.press(getByTestId('standalone-task-31'));
    expect(onTaskPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 31 })
    );
  });
});
