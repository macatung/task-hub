import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReviewHandoffModal } from '@/components/telemetry/ReviewHandoffModal';
import { AgentRun } from '@/api/types';
import * as LocalAuthentication from 'expo-local-authentication';

describe('ReviewHandoffModal Component (Tier 1, 2 & 3)', () => {
  const passingRun: AgentRun = {
    id: 101,
    task_id: 42,
    runner_id: 1,
    provider: 'antigravity',
    model: 'gemini-2.5-pro',
    status: 'needs_review',
    execution_mode: 'auto_pilot',
    evidence: {
      tests_passed: 110,
      tests_failed: 0,
      tests_total: 110,
      commit_sha: 'a1b2c3d4e5f6',
      changed_files: ['src/services/secureStorage.ts', 'src/services/biometrics.ts'],
    },
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
  };

  const failingRun: AgentRun = {
    ...passingRun,
    id: 102,
    evidence: {
      tests_passed: 105,
      tests_failed: 5,
      tests_total: 110,
      commit_sha: 'deadbeef1234',
      changed_files: ['src/api/client.ts'],
    },
  };

  beforeEach(() => {
    (LocalAuthentication as any).__resetMock();
  });

  describe('Tier 1: Verification Evidence Breakdown', () => {
    it('renders test pass/fail counts, total tests, commit sha, and changed file metrics', () => {
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={jest.fn()}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(getByTestId('evidence-passed-val').props.children).toBe(110);
      expect(getByTestId('evidence-failed-val').props.children).toBe(0);
      expect(getByTestId('evidence-total-val').props.children).toBe(110);
      expect(getByTestId('evidence-commit-sha')).toBeTruthy();
      expect(getByTestId('evidence-changed-files')).toBeTruthy();
    });

    it('renders cleanly when run has no evidence object (fallback defaults to 0)', () => {
      const runNoEvidence = { ...passingRun, evidence: undefined };
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={runNoEvidence}
          onApprove={jest.fn()}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(getByTestId('evidence-passed-val').props.children).toBe(0);
      expect(getByTestId('evidence-failed-val').props.children).toBe(0);
      expect(getByTestId('evidence-total-val').props.children).toBe(0);
    });
  });

  describe('Tier 2 & 3: Biometric Approval Gate & Rejection Flow', () => {
    it('prompts biometric confirmation and calls onApprove on success', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({ success: true });

      const onApprove = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={onClose}
        />
      );

      fireEvent.press(getByTestId('approve-biometrics-btn'));

      await waitFor(() => {
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
        expect(onApprove).toHaveBeenCalledWith(101);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('disables approve button and displays "Fix Tests First" when there are failing tests', () => {
      const onApprove = jest.fn();
      const { getByTestId, getByText } = render(
        <ReviewHandoffModal
          visible={true}
          run={failingRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const approveBtn = getByTestId('approve-biometrics-btn');
      expect(approveBtn.props.accessibilityState?.disabled).toBe(true);
      expect(getByText('Fix Tests First')).toBeTruthy();

      fireEvent.press(approveBtn);
      expect(onApprove).not.toHaveBeenCalled();
    });

    it('displays error banner when biometric approval fails or is cancelled', async () => {
      (LocalAuthentication as any).__setMockResult({ success: false, error: 'user_cancelled' });

      const onApprove = jest.fn();
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      fireEvent.press(getByTestId('approve-biometrics-btn'));

      await waitFor(() => {
        expect(getByTestId('handoff-error-banner')).toBeTruthy();
        expect(onApprove).not.toHaveBeenCalled();
      });
    });

    it('opens rejection form and submits rejection reason to onReject', async () => {
      const onReject = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={onClose}
        />
      );

      // Press Reject action button
      fireEvent.press(getByTestId('reject-action-btn'));

      // Rejection form should now be visible
      expect(getByTestId('reject-form')).toBeTruthy();

      // Enter rejection reason
      fireEvent.changeText(
        getByTestId('reject-reason-input'),
        'Need additional unit tests for edge cases.'
      );

      // Submit rejection
      fireEvent.press(getByTestId('reject-confirm-btn'));

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith(
          101,
          'Need additional unit tests for edge cases.'
        );
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error banner when submitting rejection with empty reason', () => {
      const onReject = jest.fn();
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={jest.fn()}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));
      fireEvent.press(getByTestId('reject-confirm-btn'));

      expect(getByTestId('handoff-error-banner')).toBeTruthy();
      expect(onReject).not.toHaveBeenCalled();
    });

    it('cancels rejection and returns to main action view', () => {
      const { getByTestId, queryByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={jest.fn()}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));
      expect(getByTestId('reject-form')).toBeTruthy();

      fireEvent.press(getByTestId('reject-cancel-btn'));
      expect(queryByTestId('reject-form')).toBeNull();
      expect(getByTestId('handoff-actions')).toBeTruthy();
    });

    it('closes modal when close button is clicked', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={passingRun}
          onApprove={jest.fn()}
          onReject={jest.fn()}
          onClose={onClose}
        />
      );

      fireEvent.press(getByTestId('close-modal-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
