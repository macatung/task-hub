import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LogStreamView } from '@/components/telemetry/LogStreamView';
import { AgentRunLog } from '@/api/types';

describe('LogStreamView Component (Milestone 5)', () => {
  const sampleLogs: AgentRunLog[] = [
    {
      id: 1,
      run_id: 42,
      stream: 'stdout',
      content: 'Starting agent runner process...',
      occurred_at: '2026-08-25T08:00:00Z',
    },
    {
      id: 2,
      run_id: 42,
      stream: 'stdout',
      content: 'Analyzing codebase requirements...',
      occurred_at: '2026-08-25T08:00:01Z',
    },
    {
      id: 3,
      run_id: 42,
      stream: 'stderr',
      content: 'Warning: Deprecated API in node modules',
      occurred_at: '2026-08-25T08:00:02Z',
    },
    {
      id: 4,
      run_id: 42,
      stream: 'system',
      content: 'System checkpoint saved successfully',
      occurred_at: '2026-08-25T08:00:03Z',
    },
  ];

  it('renders all logs with line numbers, stream tags, and total count', () => {
    const { getByText, getByTestId } = render(
      <LogStreamView logs={sampleLogs} />
    );

    expect(getByTestId('log-stream-view')).toBeTruthy();
    expect(getByText('4 lines')).toBeTruthy();
    expect(getByText('Starting agent runner process...')).toBeTruthy();
    expect(getByText('Analyzing codebase requirements...')).toBeTruthy();
    expect(getByText('Warning: Deprecated API in node modules')).toBeTruthy();
    expect(getByText('System checkpoint saved successfully')).toBeTruthy();
    expect(getByText('[STDOUT]')).toBeTruthy();
    expect(getByText('[STDERR]')).toBeTruthy();
    expect(getByText('[SYSTEM]')).toBeTruthy();
  });

  it('filters logs by stream type (stdout, stderr, system)', () => {
    const { getByTestId, getByText, queryByText } = render(
      <LogStreamView logs={sampleLogs} />
    );

    // Filter stderr
    fireEvent.press(getByTestId('filter-stderr-btn'));
    expect(getByText('Warning: Deprecated API in node modules')).toBeTruthy();
    expect(queryByText('Starting agent runner process...')).toBeNull();
    expect(queryByText('System checkpoint saved successfully')).toBeNull();

    // Filter system
    fireEvent.press(getByTestId('filter-system-btn'));
    expect(getByText('System checkpoint saved successfully')).toBeTruthy();
    expect(queryByText('Warning: Deprecated API in node modules')).toBeNull();

    // Filter stdout
    fireEvent.press(getByTestId('filter-stdout-btn'));
    expect(getByText('Starting agent runner process...')).toBeTruthy();
    expect(queryByText('Warning: Deprecated API in node modules')).toBeNull();

    // Filter all
    fireEvent.press(getByTestId('filter-all-btn'));
    expect(getByText('Starting agent runner process...')).toBeTruthy();
    expect(getByText('Warning: Deprecated API in node modules')).toBeTruthy();
  });

  it('filters log lines by search query text input', () => {
    const { getByTestId, getByText, queryByText } = render(
      <LogStreamView logs={sampleLogs} />
    );

    fireEvent.changeText(getByTestId('log-search-input'), 'checkpoint');
    expect(getByText('System checkpoint saved successfully')).toBeTruthy();
    expect(queryByText('Starting agent runner process...')).toBeNull();
  });

  it('toggles auto-scroll mode and calls callback', () => {
    const onToggleAutoScroll = jest.fn();
    const { getByTestId, getByText } = render(
      <LogStreamView
        logs={sampleLogs}
        autoScroll={true}
        onToggleAutoScroll={onToggleAutoScroll}
      />
    );

    expect(getByText('🔒 Auto-Scroll')).toBeTruthy();

    fireEvent.press(getByTestId('autoscroll-toggle-btn'));
    expect(onToggleAutoScroll).toHaveBeenCalled();
  });

  it('invokes onClearLogs callback when clear button is clicked', () => {
    const onClearLogs = jest.fn();
    const { getByTestId } = render(
      <LogStreamView logs={sampleLogs} onClearLogs={onClearLogs} />
    );

    fireEvent.press(getByTestId('clear-logs-btn'));
    expect(onClearLogs).toHaveBeenCalled();
  });

  it('handles copy logs to clipboard with visual feedback', async () => {
    const { getByTestId, getByText } = render(
      <LogStreamView logs={sampleLogs} />
    );

    fireEvent.press(getByTestId('copy-logs-btn'));
    expect(getByText('✓ Copied')).toBeTruthy();
  });

  it('renders connecting empty state when connectionState is connecting and logs are empty', () => {
    const { getByText } = render(
      <LogStreamView logs={[]} connectionState="connecting" />
    );

    expect(getByText('Connecting to live SSE telemetry feed...')).toBeTruthy();
  });

  it('renders waiting empty state when connectionState is connected and logs are empty', () => {
    const { getByText } = render(
      <LogStreamView logs={[]} connectionState="connected" />
    );

    expect(getByText('Waiting for agent logs...')).toBeTruthy();
  });
});
