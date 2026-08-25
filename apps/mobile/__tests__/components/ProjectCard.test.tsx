import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProjectCard } from '@/components/workspaces/ProjectCard';
import { Project } from '@/api/types';

describe('ProjectCard Component (Tier 1 & 2)', () => {
  const baseProject: Project = {
    id: 101,
    workspace_id: 1,
    title: 'Task Hub Mobile App',
    slug: 'task-hub-mobile',
    key: 'THM',
    description: 'React Native iOS and Android companion client',
    category: 'Mobile',
    color: '#00f5d4',
    status: 'active',
    tasks_count: 24,
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
  };

  it('renders project title, key, and task count correctly', () => {
    const { getByTestId } = render(<ProjectCard project={baseProject} />);

    expect(getByTestId('project-title').props.children).toBe('Task Hub Mobile App');
    expect(getByTestId('project-key')).toBeTruthy();
    expect(getByTestId('project-status-badge')).toBeTruthy();
    expect(getByTestId('project-task-count').props.children).toContain('24 tasks');
  });

  it('triggers onPress callback with project data when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<ProjectCard project={baseProject} onPress={onPress} />);

    fireEvent.press(getByTestId('project-card-101'));
    expect(onPress).toHaveBeenCalledWith(baseProject);
  });

  it('renders ARCHIVED status for archived projects', () => {
    const archivedProj: Project = { ...baseProject, id: 102, status: 'archived' };
    const { getByTestId } = render(<ProjectCard project={archivedProj} />);

    expect(getByTestId('project-status-badge')).toBeTruthy();
  });

  it('renders fallback title when only name is provided', () => {
    const unnamedProj: Project = {
      ...baseProject,
      id: 103,
      title: undefined,
      name: 'Legacy Project Name',
    };
    const { getByTestId } = render(<ProjectCard project={unnamedProj} />);
    expect(getByTestId('project-title').props.children).toBe('Legacy Project Name');
  });

  it('handles project with 1 task singular formatting', () => {
    const singleTaskProj: Project = { ...baseProject, id: 104, tasks_count: 1 };
    const { getByTestId } = render(<ProjectCard project={singleTaskProj} />);
    expect(getByTestId('project-task-count').props.children).toContain('1 task');
  });
});
