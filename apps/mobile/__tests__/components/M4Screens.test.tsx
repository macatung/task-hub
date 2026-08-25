import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DashboardScreen from '../../app/(tabs)/index';
import SprintsScreen from '../../app/(tabs)/sprints';
import TasksScreen from '../../app/(tabs)/tasks';
import TaskDetailScreen from '../../app/tasks/[id]';
import NewTaskModal from '../../app/tasks/new';
import { Task, Sprint, Project } from '@/api/types';

describe('Milestone 4 Screen Integration Tests (Tier 1 & 2)', () => {
  describe('1. DashboardScreen (app/(tabs)/index.tsx)', () => {
    it('renders workspace selector, active sprint summary, quick action cards, and project grid', () => {
      const { getByText, getByTestId } = render(<DashboardScreen />);

      expect(getByTestId('workspace-selector-trigger')).toBeTruthy();
      expect(getByText('ACTIVE SPRINT')).toBeTruthy();
      expect(getByText('Sprint 1: Architecture')).toBeTruthy();
      expect(getByText('New Task')).toBeTruthy();
      expect(getByText('Backlog')).toBeTruthy();
      expect(getByText('Telemetry')).toBeTruthy();
      expect(getByText('Task Hub Core')).toBeTruthy();
    });
  });

  describe('2. SprintsScreen (app/(tabs)/sprints.tsx)', () => {
    it('renders sprint switcher, scrum integrity badge, and sprint board kanban', () => {
      const { getByText, getByTestId } = render(<SprintsScreen />);

      expect(getByText('Sprint 1: Architecture ⚡')).toBeTruthy();
      expect(getByText('Non-Epic Scrum Invariant: Points and cards exclude parent Epics.')).toBeTruthy();
      expect(getByTestId('sprint-board')).toBeTruthy();
    });
  });

  describe('3. TasksScreen (app/(tabs)/tasks.tsx)', () => {
    it('renders segmented controls and switches between All Tasks, Epic Tree, and Backlog', () => {
      const { getByText, getByTestId } = render(<TasksScreen />);

      expect(getByText('Task Explorer')).toBeTruthy();
      expect(getByText('All Tasks')).toBeTruthy();
      expect(getByText('Epic Tree')).toBeTruthy();
      expect(getByText('Backlog')).toBeTruthy();

      // Switch to Epic Tree
      fireEvent.press(getByTestId('segment-btn-hierarchy'));
      expect(getByTestId('epic-hierarchy-container')).toBeTruthy();

      // Switch to Backlog
      fireEvent.press(getByTestId('segment-btn-backlog'));
      expect(getByTestId('backlog-list-container')).toBeTruthy();
    });
  });

  describe('4. TaskDetailScreen (app/tasks/[id].tsx)', () => {
    it('renders task details with status, priority, pomodoro tracker, and markdown renderer', () => {
      const { getByTestId, getByText } = render(<TaskDetailScreen />);

      expect(getByTestId('task-detail-screen')).toBeTruthy();
      expect(getByTestId('task-detail-title').props.children).toBe('Implement Task Detail Screen');
      expect(getByTestId('task-detail-status')).toBeTruthy();
      expect(getByTestId('pomodoro-tracker-section')).toBeTruthy();
      expect(getByTestId('task-detail-markdown')).toBeTruthy();
      expect(getByText('Dispatch AI Agent')).toBeTruthy();
    });
  });

  describe('5. NewTaskModal (app/tasks/new.tsx)', () => {
    it('renders task creation form modal with all required fields', () => {
      const { getByTestId, getByText } = render(<NewTaskModal />);

      expect(getByTestId('new-task-form')).toBeTruthy();
      expect(getByTestId('select-issue-type')).toBeTruthy();
      expect(getByTestId('input-title')).toBeTruthy();
      expect(getByTestId('input-description')).toBeTruthy();
      expect(getByTestId('select-priority')).toBeTruthy();
      expect(getByTestId('select-points')).toBeTruthy();
      expect(getByTestId('submit-create-task-btn')).toBeTruthy();
      expect(getByText('Create Work Item')).toBeTruthy();
    });
  });
});
