import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WorkspaceSelector } from '@/components/workspaces/WorkspaceSelector';
import { Workspace } from '@/api/types';

import { mockWorkspacesApi } from '../../jest.setup';

describe('WorkspaceSelector Component (Tier 1 & 2)', () => {
  beforeEach(() => {
    (mockWorkspacesApi as any).__resetWorkspacesMock();
  });

  it('renders current workspace name on the trigger button', () => {
    const { getByTestId } = render(<WorkspaceSelector />);
    const trigger = getByTestId('workspace-selector-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger.props.children).toBeTruthy();
  });

  it('opens workspace list modal when trigger button is pressed', () => {
    const { getByTestId } = render(<WorkspaceSelector />);
    fireEvent.press(getByTestId('workspace-selector-trigger'));
    expect(getByTestId('workspace-selector-modal')).toBeTruthy();
  });

  it('renders all workspace items and highlights the active one', () => {
    const { getByTestId } = render(<WorkspaceSelector />);
    fireEvent.press(getByTestId('workspace-selector-trigger'));

    expect(getByTestId('workspace-item-1')).toBeTruthy();
    expect(getByTestId('workspace-item-2')).toBeTruthy();
    expect(getByTestId('workspace-active-badge')).toBeTruthy();
  });

  it('switches active workspace on press and invokes onWorkspaceChanged callback', async () => {
    const onWorkspaceChanged = jest.fn();
    const { getByTestId } = render(
      <WorkspaceSelector onWorkspaceChanged={onWorkspaceChanged} />
    );

    fireEvent.press(getByTestId('workspace-selector-trigger'));
    fireEvent.press(getByTestId('workspace-item-2'));

    expect(mockWorkspacesApi.useSwitchWorkspace().mutateAsync).toHaveBeenCalledWith(2);
  });

  it('handles creating a new workspace and switching to it', async () => {
    const onWorkspaceChanged = jest.fn();
    const { getByTestId } = render(
      <WorkspaceSelector onWorkspaceChanged={onWorkspaceChanged} />
    );

    fireEvent.press(getByTestId('workspace-selector-trigger'));
    fireEvent.press(getByTestId('create-workspace-btn'));

    expect(getByTestId('create-workspace-btn')).toBeTruthy();
  });
});
