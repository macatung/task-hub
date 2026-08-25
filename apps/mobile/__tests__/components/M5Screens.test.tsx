import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AgentRunConsoleScreen from '../../app/agent-runs/[id]';
import HandoffReviewScreen from '../../app/agent-runs/[id]/review';
import TelemetryScreen from '../../app/(tabs)/telemetry';
import { mockAgentRunsApi } from '../../jest.setup';
import { AgentRun } from '@/api/types';

// Mock Alert.alert
const alertSpy = jest.fn();
(Alert as any).alert = alertSpy;

describe('Milestone 5 Screen Integration Tests', () => {
  const sampleRun: AgentRun = {
    id: 42,
    task_id: 101,
    runner_id: 1,
    provider: 'antigravity',
    model: 'gemini-2.5-pro',
    status: 'needs_review',
    execution_mode: 'auto_pilot',
    summary: 'Implemented features and passed all tests.',
    task: {
      id: 101,
      workspace_id: 1,
      project_id: 1,
      issue_key: 'THC-42',
      title: 'Real-time SSE telemetry integration',
      issue_type: 'task',
      status: 'in_progress',
      priority: 'high',
      created_at: '',
      updated_at: '',
    },
    evidence: {
      tests_passed: 122,
      tests_failed: 0,
      tests_total: 122,
      commit_sha: 'a1b2c3d4e5f6',
      changed_files: ['src/services/sseStreamClient.ts'],
    },
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
  };

  beforeEach(() => {
    (mockAgentRunsApi as any).__resetAgentRunsMock();
    (mockAgentRunsApi as any).__setCurrentAgentRun(sampleRun);
    (LocalAuthentication as any).__resetMock();
    alertSpy.mockClear();
  });

  describe('1. AgentRunConsoleScreen (app/agent-runs/[id].tsx)', () => {
    it('renders agent run console with metadata, issue key, log viewer, and review action', () => {
      const { getByText, getByTestId } = render(<AgentRunConsoleScreen />);

      expect(getByText('Run #42')).toBeTruthy();
      expect(getByText('antigravity · gemini-2.5-pro')).toBeTruthy();
      expect(getByText('THC-42')).toBeTruthy();
      expect(getByText('Real-time SSE telemetry integration')).toBeTruthy();
      expect(getByTestId('log-stream-view')).toBeTruthy();
      expect(getByTestId('open-review-btn')).toBeTruthy();
      expect(getByText('Review Handoff & Evidence 🔐')).toBeTruthy();
    });

    it('opens ReviewHandoffModal when review button is clicked', () => {
      const { getByTestId } = render(<AgentRunConsoleScreen />);

      fireEvent.press(getByTestId('open-review-btn'));
      expect(getByTestId('review-handoff-modal')).toBeTruthy();
    });

    it('renders cancel button and triggers cancel alert when run is running', () => {
      const runningRun: AgentRun = {
        ...sampleRun,
        status: 'running',
      };
      (mockAgentRunsApi as any).__setCurrentAgentRun(runningRun);

      const { getByTestId, getByText } = render(<AgentRunConsoleScreen />);

      const cancelBtn = getByTestId('cancel-run-btn');
      expect(cancelBtn).toBeTruthy();
      expect(getByText('Cancel Execution')).toBeTruthy();

      fireEvent.press(cancelBtn);
      expect(alertSpy).toHaveBeenCalledWith(
        'Cancel Agent Run',
        'Are you sure you want to cancel this agent execution?',
        expect.any(Array)
      );
    });
  });

  describe('2. HandoffReviewScreen (app/agent-runs/[id]/review.tsx)', () => {
    it('renders target work item, summary, evidence card, and action buttons', () => {
      const { getByText, getByTestId } = render(<HandoffReviewScreen />);

      expect(getByText('Handoff Review')).toBeTruthy();
      expect(getByText('TARGET WORK ITEM')).toBeTruthy();
      expect(getByText('[THC-42] Real-time SSE telemetry integration')).toBeTruthy();
      expect(getByText('Implemented features and passed all tests.')).toBeTruthy();
      expect(getByTestId('evidence-card')).toBeTruthy();
      expect(getByTestId('reject-action-btn')).toBeTruthy();
      expect(getByTestId('approve-biometrics-btn')).toBeTruthy();
    });

    it('approves handoff with biometric verification prompt and success alert', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({ success: true });

      const { getByTestId } = render(<HandoffReviewScreen />);

      fireEvent.press(getByTestId('approve-biometrics-btn'));

      await waitFor(() => {
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
        expect(mockAgentRunsApi.mockApproveHandoffFn).toHaveBeenCalledWith(101);
        expect(alertSpy).toHaveBeenCalledWith(
          'Handoff Approved',
          'Task marked verified and moved to Done.',
          expect.any(Array)
        );
      });
    });

    it('switches to reject mode, enters reason, and submits rejection', async () => {
      const { getByTestId } = render(<HandoffReviewScreen />);

      fireEvent.press(getByTestId('reject-action-btn'));
      expect(getByTestId('reject-form')).toBeTruthy();

      fireEvent.changeText(
        getByTestId('reject-reason-input'),
        'Need additional edge case tests.'
      );
      fireEvent.press(getByTestId('reject-confirm-btn'));

      await waitFor(() => {
        expect(mockAgentRunsApi.mockRejectHandoffFn).toHaveBeenCalledWith({
          taskId: 101,
          reason: 'Need additional edge case tests.',
        });
        expect(alertSpy).toHaveBeenCalledWith(
          'Handoff Rejected',
          'Task returned to in_progress with feedback notes.',
          expect.any(Array)
        );
      });
    });
  });

  describe('3. TelemetryScreen (app/(tabs)/telemetry.tsx)', () => {
    beforeEach(() => {
      (mockAgentRunsApi as any).__setAgentRuns([
        sampleRun,
        {
          id: 43,
          task_id: 102,
          runner_id: 2,
          provider: 'claude_code',
          model: 'claude-3-7-sonnet',
          status: 'running',
          execution_mode: 'supervised',
          task: { id: 102, issue_key: 'THC-43', title: 'Diff viewer styling' },
          created_at: '',
          updated_at: '',
        },
      ]);
    });

    it('renders runner metrics grid, filter pills, and agent run cards', () => {
      const { getByText, getByTestId } = render(<TelemetryScreen />);

      expect(getByText('Agent Telemetry')).toBeTruthy();
      expect(getByText('Ready')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();
      expect(getByText('Review')).toBeTruthy();
      expect(getByText('Verified')).toBeTruthy();
      expect(getByText('Failed')).toBeTruthy();

      expect(getByTestId('telemetry-run-card-42')).toBeTruthy();
      expect(getByTestId('telemetry-run-card-43')).toBeTruthy();
      expect(getByText('Run #42')).toBeTruthy();
      expect(getByText('Run #43')).toBeTruthy();
    });

    it('filters agent runs by status pill', () => {
      const { getByTestId, queryByTestId } = render(<TelemetryScreen />);

      // Filter active (should only show run 43)
      fireEvent.press(getByTestId('telemetry-filter-active'));
      expect(queryByTestId('telemetry-run-card-43')).toBeTruthy();
      expect(queryByTestId('telemetry-run-card-42')).toBeNull();

      // Filter needs_review (should only show run 42)
      fireEvent.press(getByTestId('telemetry-filter-needs_review'));
      expect(queryByTestId('telemetry-run-card-42')).toBeTruthy();
      expect(queryByTestId('telemetry-run-card-43')).toBeNull();

      // Filter failed (empty state)
      fireEvent.press(getByTestId('telemetry-filter-failed'));
      expect(getByTestId('telemetry-empty-card')).toBeTruthy();
    });
  });
});
