import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { ReviewHandoffModal } from '@/components/telemetry/ReviewHandoffModal';
import { EvidenceCard } from '@/components/telemetry/EvidenceCard';
import { LogStreamView } from '@/components/telemetry/LogStreamView';
import { AgentRun, AgentRunLog, VerificationEvidence } from '@/api/types';

describe('Milestone 5 Empirical Challenger Suite (Critic & Specialist)', () => {
  beforeEach(() => {
    (LocalAuthentication as any).__resetMock();
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* CHALLENGE 1: ReviewHandoffModal Approval Invariant & Safety Locks         */
  /* -------------------------------------------------------------------------- */
  describe('Challenge 1: Handoff Approval & Failing Tests Locks', () => {
    const baseRun: AgentRun = {
      id: 501,
      task_id: 1001,
      runner_id: 2,
      provider: 'antigravity',
      model: 'gemini-2.5-flash',
      status: 'needs_review',
      execution_mode: 'auto_pilot',
      created_at: '2026-08-25T10:00:00Z',
      updated_at: '2026-08-25T10:05:00Z',
    };

    it('Scenario 1.1: Blocks approval when tests_failed = 1 ("Fix Tests First")', () => {
      const failingRun: AgentRun = {
        ...baseRun,
        evidence: {
          tests_passed: 49,
          tests_failed: 1,
          tests_total: 50,
        },
      };

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
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
      expect(onApprove).not.toHaveBeenCalled();
    });

    it('Scenario 1.2: Blocks approval when tests_failed is large (e.g. 500 failed)', () => {
      const massFailureRun: AgentRun = {
        ...baseRun,
        evidence: {
          tests_passed: 0,
          tests_failed: 500,
          tests_total: 500,
        },
      };

      const onApprove = jest.fn();
      const { getByTestId, getByText } = render(
        <ReviewHandoffModal
          visible={true}
          run={massFailureRun}
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

    it('Scenario 1.3: Correctly extracts failing tests from Array evidence format', () => {
      const arrayEvidenceRun: AgentRun = {
        ...baseRun,
        evidence: [
          {
            tests_passed: 10,
            tests_failed: 3,
            tests_total: 13,
            commit_sha: '123456789abc',
          },
        ],
      };

      const onApprove = jest.fn();
      const { getByTestId, getByText } = render(
        <ReviewHandoffModal
          visible={true}
          run={arrayEvidenceRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(getByTestId('evidence-failed-val').props.children).toBe(3);
      const approveBtn = getByTestId('approve-biometrics-btn');
      expect(approveBtn.props.accessibilityState?.disabled).toBe(true);
      expect(getByText('Fix Tests First')).toBeTruthy();
    });

    it('Scenario 1.4: Allows approval when tests_failed = 0 and prompts biometrics', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({ success: true });

      const cleanRun: AgentRun = {
        ...baseRun,
        evidence: {
          tests_passed: 120,
          tests_failed: 0,
          tests_total: 120,
        },
      };

      const onApprove = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      const { getByTestId, getByText } = render(
        <ReviewHandoffModal
          visible={true}
          run={cleanRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={onClose}
        />
      );

      expect(getByText('Biometric Approve 🔐')).toBeTruthy();
      const approveBtn = getByTestId('approve-biometrics-btn');
      expect(approveBtn.props.accessibilityState?.disabled).toBeFalsy();

      fireEvent.press(approveBtn);

      await waitFor(() => {
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
        expect(onApprove).toHaveBeenCalledWith(501);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('Scenario 1.5: Handles biometric error/cancellation without executing onApprove', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({ success: false, error: 'User dismissed biometric prompt' });

      const cleanRun: AgentRun = {
        ...baseRun,
        evidence: { tests_passed: 10, tests_failed: 0, tests_total: 10 },
      };

      const onApprove = jest.fn();
      const onClose = jest.fn();

      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={cleanRun}
          onApprove={onApprove}
          onReject={jest.fn()}
          onClose={onClose}
        />
      );

      fireEvent.press(getByTestId('approve-biometrics-btn'));

      await waitFor(() => {
        expect(getByTestId('handoff-error-banner')).toBeTruthy();
        expect(onApprove).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CHALLENGE 2: Rejection Form Validation & Mutation                         */
  /* -------------------------------------------------------------------------- */
  describe('Challenge 2: Rejection Form Validation & Mutation Handling', () => {
    const testRun: AgentRun = {
      id: 602,
      task_id: 1002,
      provider: 'antigravity',
      model: 'gemini-2.5-flash',
      execution_mode: 'auto_pilot',
      status: 'needs_review',
      created_at: '2026-08-25T10:00:00Z',
      updated_at: '2026-08-25T10:05:00Z',
      evidence: { tests_passed: 10, tests_failed: 0, tests_total: 10 },
    };

    it('Scenario 2.1: Rejects empty string rejection reason', () => {
      const onReject = jest.fn();
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={testRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={jest.fn()}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));
      expect(getByTestId('reject-form')).toBeTruthy();

      // Attempt submit without typing reason
      fireEvent.press(getByTestId('reject-confirm-btn'));

      expect(getByTestId('handoff-error-banner')).toBeTruthy();
      expect(onReject).not.toHaveBeenCalled();
    });

    it('Scenario 2.2: Rejects whitespace-only rejection reason ("   \\n\\t  ")', () => {
      const onReject = jest.fn();
      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={testRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={jest.fn()}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));
      fireEvent.changeText(getByTestId('reject-reason-input'), '   \n\t  \n  ');
      fireEvent.press(getByTestId('reject-confirm-btn'));

      expect(getByTestId('handoff-error-banner')).toBeTruthy();
      expect(onReject).not.toHaveBeenCalled();
    });

    it('Scenario 2.3: Accepts complex multiline feedback and trims leading/trailing spaces', async () => {
      const onReject = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      const { getByTestId } = render(
        <ReviewHandoffModal
          visible={true}
          run={testRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={onClose}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));

      const feedback = `  
Line 1: Missing boundary test for null input.
Line 2: Performance regression on large dataset (O(N^2)).
Line 3: Please fix and rerun test suite. 🚀
      `;

      fireEvent.changeText(getByTestId('reject-reason-input'), feedback);
      fireEvent.press(getByTestId('reject-confirm-btn'));

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith(602, feedback.trim());
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('Scenario 2.4: Displays error banner when onReject API call rejects/fails', async () => {
      const onReject = jest.fn().mockRejectedValue(new Error('Network gateway timeout (504)'));
      const onClose = jest.fn();

      const { getByTestId, getByText } = render(
        <ReviewHandoffModal
          visible={true}
          run={testRun}
          onApprove={jest.fn()}
          onReject={onReject}
          onClose={onClose}
        />
      );

      fireEvent.press(getByTestId('reject-action-btn'));
      fireEvent.changeText(getByTestId('reject-reason-input'), 'Failed test case');
      fireEvent.press(getByTestId('reject-confirm-btn'));

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith(602, 'Failed test case');
        expect(getByTestId('handoff-error-banner')).toBeTruthy();
        expect(getByText('Network gateway timeout (504)')).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CHALLENGE 3: LogStreamView Filtering, Regex Immunity & Autoscroll          */
  /* -------------------------------------------------------------------------- */
  describe('Challenge 3: LogStreamView Filters, Search & Viewport Controls', () => {
    const testLogs: AgentRunLog[] = [
      { id: 1, run_id: 1, stream: 'stdout', content: '[INFO] Initializing task workspace...', occurred_at: '10:00:01' },
      { id: 2, run_id: 1, stream: 'stdout', content: '[DEBUG] Cache hit for dependency graph (30ms)', occurred_at: '10:00:02' },
      { id: 3, run_id: 1, stream: 'stderr', content: '[ERROR] Missing optional module @task-hub/native-bridge', occurred_at: '10:00:03' },
      { id: 4, run_id: 1, stream: 'stderr', content: '[CRITICAL] Connection timeout on socket port 9002', occurred_at: '10:00:04' },
      { id: 5, run_id: 1, stream: 'system', content: '[SYSTEM] Agent container transitioned to running state', occurred_at: '10:00:05' },
      { id: 6, run_id: 1, stream: 'stdout', content: 'Regex chars test: (foo|bar)* [tag] $100 ?', occurred_at: '10:00:06' },
    ];

    it('Scenario 3.1: Filters stream correctly for STDOUT, STDERR, SYSTEM, and ALL', () => {
      const { getByTestId, getByText, queryByText } = render(
        <LogStreamView logs={testLogs} />
      );

      // Default: ALL
      expect(getByText('6 lines')).toBeTruthy();

      // STDOUT filter
      fireEvent.press(getByTestId('filter-stdout-btn'));
      expect(getByText('3 lines')).toBeTruthy();
      expect(getByText('[INFO] Initializing task workspace...')).toBeTruthy();
      expect(queryByText('[ERROR] Missing optional module @task-hub/native-bridge')).toBeNull();
      expect(queryByText('[SYSTEM] Agent container transitioned to running state')).toBeNull();

      // STDERR filter
      fireEvent.press(getByTestId('filter-stderr-btn'));
      expect(getByText('2 lines')).toBeTruthy();
      expect(getByText('[ERROR] Missing optional module @task-hub/native-bridge')).toBeTruthy();
      expect(getByText('[CRITICAL] Connection timeout on socket port 9002')).toBeTruthy();
      expect(queryByText('[INFO] Initializing task workspace...')).toBeNull();

      // SYSTEM filter
      fireEvent.press(getByTestId('filter-system-btn'));
      expect(getByText('1 lines')).toBeTruthy();
      expect(getByText('[SYSTEM] Agent container transitioned to running state')).toBeTruthy();
      expect(queryByText('[CRITICAL] Connection timeout on socket port 9002')).toBeNull();

      // Back to ALL
      fireEvent.press(getByTestId('filter-all-btn'));
      expect(getByText('6 lines')).toBeTruthy();
    });

    it('Scenario 3.2: Handles regex characters in search query without throwing syntax errors', () => {
      const { getByTestId, getByText, queryByText } = render(
        <LogStreamView logs={testLogs} />
      );

      // Search with unescaped regex special characters
      fireEvent.changeText(getByTestId('log-search-input'), '(foo|bar)*');
      expect(getByText('Regex chars test: (foo|bar)* [tag] $100 ?')).toBeTruthy();
      expect(queryByText('[INFO] Initializing task workspace...')).toBeNull();

      // Search with brackets
      fireEvent.changeText(getByTestId('log-search-input'), '[CRITICAL]');
      expect(getByText('[CRITICAL] Connection timeout on socket port 9002')).toBeTruthy();
      expect(queryByText('Regex chars test: (foo|bar)* [tag] $100 ?')).toBeNull();
    });

    it('Scenario 3.3: Case-insensitive search query matching', () => {
      const { getByTestId, getByText, queryByText } = render(
        <LogStreamView logs={testLogs} />
      );

      fireEvent.changeText(getByTestId('log-search-input'), 'dependency GRAPH');
      expect(getByText('[DEBUG] Cache hit for dependency graph (30ms)')).toBeTruthy();
      expect(queryByText('[CRITICAL] Connection timeout on socket port 9002')).toBeNull();
    });

    it('Scenario 3.4: Shows empty state message when search query matches nothing', () => {
      const { getByTestId, getByText } = render(
        <LogStreamView logs={testLogs} />
      );

      fireEvent.changeText(getByTestId('log-search-input'), 'non_existent_token_xyz_999');
      expect(getByTestId('logs-empty-state')).toBeTruthy();
      expect(getByText('No log lines matching query')).toBeTruthy();
    });

    it('Scenario 3.5: Autoscroll toggle state and callback invocation', () => {
      const onToggleAutoScroll = jest.fn();
      const { getByTestId, getByText } = render(
        <LogStreamView logs={testLogs} autoScroll={true} onToggleAutoScroll={onToggleAutoScroll} />
      );

      expect(getByText('🔒 Auto-Scroll')).toBeTruthy();
      fireEvent.press(getByTestId('autoscroll-toggle-btn'));
      expect(onToggleAutoScroll).toHaveBeenCalledTimes(1);

      const viewFree = render(
        <LogStreamView logs={testLogs} autoScroll={false} onToggleAutoScroll={onToggleAutoScroll} />
      );
      expect(viewFree.getByText('🔓 Free Scroll')).toBeTruthy();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CHALLENGE 4: EvidenceCard Edge Cases & Diff Viewer                        */
  /* -------------------------------------------------------------------------- */
  describe('Challenge 4: EvidenceCard Boundaries & PR Links', () => {
    it('Scenario 4.1: Calculates 0% pass rate when tests_total = 0 without NaN error', () => {
      const zeroEvidence: VerificationEvidence = {
        tests_passed: 0,
        tests_failed: 0,
        tests_total: 0,
      };

      const { getByText } = render(<EvidenceCard evidence={zeroEvidence} />);
      expect(getByText('0%')).toBeTruthy();
      expect(getByText('TESTS PASSED')).toBeTruthy();
    });

    it('Scenario 4.2: Opens PR link via Linking.openURL for both pull_request_url and pr_url', () => {
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

      const evidenceA: VerificationEvidence = {
        tests_passed: 10,
        tests_failed: 0,
        tests_total: 10,
        pull_request_url: 'https://github.com/org/repo/pull/99',
      };

      const viewA = render(<EvidenceCard evidence={evidenceA} />);
      fireEvent.press(viewA.getByTestId('evidence-pr-link'));
      expect(openSpy).toHaveBeenCalledWith('https://github.com/org/repo/pull/99');

      const evidenceB: VerificationEvidence = {
        tests_passed: 10,
        tests_failed: 0,
        tests_total: 10,
        pr_url: 'https://github.com/org/repo/pull/100',
      };

      const viewB = render(<EvidenceCard evidence={evidenceB} />);
      fireEvent.press(viewB.getByTestId('evidence-pr-link'));
      expect(openSpy).toHaveBeenCalledWith('https://github.com/org/repo/pull/100');

      openSpy.mockRestore();
    });
  });
});
