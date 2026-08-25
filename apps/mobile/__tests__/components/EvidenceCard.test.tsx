import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { EvidenceCard } from '@/components/telemetry/EvidenceCard';
import { VerificationEvidence } from '@/api/types';

describe('EvidenceCard Component (Milestone 5)', () => {
  const passingEvidence: VerificationEvidence = {
    tests_passed: 120,
    tests_failed: 0,
    tests_total: 120,
    commit_sha: 'abcdef123456',
    pull_request_url: 'https://github.com/org/repo/pull/42',
    changed_files: ['src/services/sseStreamClient.ts', 'src/hooks/useAgentTelemetryStream.ts'],
    diff: 'diff --git a/file.ts b/file.ts\n+const a = 1;',
  };

  const failingEvidence: VerificationEvidence = {
    tests_passed: 100,
    tests_failed: 5,
    tests_total: 105,
    commit_sha: 'deadbeef7890',
    pr_url: 'https://github.com/org/repo/pull/43',
    changed_files: ['src/services/api.ts'],
  };

  it('renders test metrics, pass rate, commit sha, and changed files count for passing run', () => {
    const { getByTestId, getByText } = render(
      <EvidenceCard evidence={passingEvidence} />
    );

    expect(getByTestId('evidence-passed-val').props.children).toBe(120);
    expect(getByTestId('evidence-failed-val').props.children).toBe(0);
    expect(getByTestId('evidence-total-val').props.children).toBe(120);
    expect(getByText('100%')).toBeTruthy();
    expect(getByText('TESTS PASSED')).toBeTruthy();
    expect(getByTestId('evidence-commit-sha')).toBeTruthy();
    expect(getByTestId('evidence-changed-files')).toBeTruthy();
    expect(getByText('2 files')).toBeTruthy();
  });

  it('renders "FAILING TESTS" pill and highlights failed count when tests_failed > 0', () => {
    const { getByTestId, getByText } = render(
      <EvidenceCard evidence={failingEvidence} />
    );

    expect(getByTestId('evidence-failed-val').props.children).toBe(5);
    expect(getByText('FAILING TESTS')).toBeTruthy();
    expect(getByText('95%')).toBeTruthy();
  });

  it('opens pull request URL in browser when PR link is clicked', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

    const { getByTestId } = render(
      <EvidenceCard evidence={passingEvidence} />
    );

    fireEvent.press(getByTestId('evidence-pr-link'));
    expect(openUrlSpy).toHaveBeenCalledWith('https://github.com/org/repo/pull/42');

    openUrlSpy.mockRestore();
  });

  it('toggles DiffViewer visibility on diff button press', () => {
    const { getByTestId, queryByTestId } = render(
      <EvidenceCard evidence={passingEvidence} />
    );

    // Initially diff viewer is not visible
    expect(queryByTestId('diff-viewer')).toBeNull();

    // Press diff toggle
    fireEvent.press(getByTestId('evidence-diff-toggle'));
    expect(getByTestId('diff-viewer')).toBeTruthy();

    // Press again to collapse
    fireEvent.press(getByTestId('evidence-diff-toggle'));
    expect(queryByTestId('diff-viewer')).toBeNull();
  });

  it('handles array evidence structure gracefully', () => {
    const { getByTestId, getByText } = render(
      <EvidenceCard evidence={[passingEvidence]} />
    );

    expect(getByTestId('evidence-passed-val').props.children).toBe(120);
    expect(getByText('TESTS PASSED')).toBeTruthy();
  });

  it('renders gracefully with zero metrics when evidence is undefined or null', () => {
    const { getByTestId } = render(<EvidenceCard evidence={null} />);

    expect(getByTestId('evidence-passed-val').props.children).toBe(0);
    expect(getByTestId('evidence-failed-val').props.children).toBe(0);
    expect(getByTestId('evidence-total-val').props.children).toBe(0);
  });
});
