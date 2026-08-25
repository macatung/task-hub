import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MermaidDiagram } from '@/components/diagram/MermaidDiagram';
import { mockWebViewModule } from '../../jest.setup';

describe('MermaidDiagram Component (Tier 1 & 2)', () => {
  const sampleChart = `
    graph TD
      A[Mobile App] -->|HTTPS| B(Task Hub API)
      A -->|SSE| C(Live Log Stream)
      B --> D[(PostgreSQL)]
  `;

  beforeEach(() => {
    mockWebViewModule.__resetMock();
  });

  describe('Tier 1: WebView Integration & Message Bridge', () => {
    it('renders WebView with dark-mode Mermaid script injection', () => {
      const { getByTestId } = render(
        <MermaidDiagram chart={sampleChart} title="System Topology" />
      );

      expect(getByTestId('mermaid-diagram-container')).toBeTruthy();
      expect(getByTestId('mermaid-webview')).toBeTruthy();
    });

    it('renders custom diagram title', () => {
      const { getByText } = render(
        <MermaidDiagram chart={sampleChart} title="Custom Data Flow" />
      );
      expect(getByText('📊 Custom Data Flow')).toBeTruthy();
    });

    it('receives height postMessage from WebView and auto-adjusts container height', () => {
      const { getByTestId } = render(<MermaidDiagram chart={sampleChart} />);
      expect(getByTestId('mermaid-webview')).toBeTruthy();

      act(() => {
        mockWebViewModule.__simulateMessage(JSON.stringify({ type: 'height', height: 420 }));
      });

      const wrapper = getByTestId('mermaid-webview-wrapper');
      expect(wrapper.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ height: 440 })])
      );
    });

    it('toggles to raw code fallback view when Code button is pressed', () => {
      const { getByTestId, queryByTestId } = render(<MermaidDiagram chart={sampleChart} />);

      // Initially WebView is visible
      expect(getByTestId('mermaid-webview')).toBeTruthy();

      // Press toggle button
      fireEvent.press(getByTestId('toggle-code-btn'));

      // Raw code container is now visible, WebView is hidden
      expect(getByTestId('mermaid-raw-code-container')).toBeTruthy();
      expect(getByTestId('mermaid-raw-code').props.children).toBe(sampleChart);
      expect(queryByTestId('mermaid-webview')).toBeNull();

      // Press toggle again to return to Diagram
      fireEvent.press(getByTestId('toggle-code-btn'));
      expect(getByTestId('mermaid-webview')).toBeTruthy();
    });
  });

  describe('Tier 2: Zoom Controls & Error Fallbacks', () => {
    it('increases zoom percentage when zoom in is clicked', () => {
      const { getByTestId } = render(<MermaidDiagram chart={sampleChart} />);

      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('100%');

      fireEvent.press(getByTestId('zoom-in-btn'));
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('125%');

      fireEvent.press(getByTestId('zoom-in-btn'));
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('150%');
    });

    it('decreases zoom percentage and resets to 100%', () => {
      const { getByTestId } = render(<MermaidDiagram chart={sampleChart} />);

      fireEvent.press(getByTestId('zoom-out-btn'));
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('75%');

      fireEvent.press(getByTestId('zoom-reset-btn'));
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('100%');
    });

    it('clamps maximum zoom percentage to 300%', () => {
      const { getByTestId } = render(<MermaidDiagram chart={sampleChart} />);

      for (let i = 0; i < 15; i++) {
        fireEvent.press(getByTestId('zoom-in-btn'));
      }
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('300%');
    });

    it('clamps minimum zoom percentage to 50%', () => {
      const { getByTestId } = render(<MermaidDiagram chart={sampleChart} />);

      for (let i = 0; i < 10; i++) {
        fireEvent.press(getByTestId('zoom-out-btn'));
      }
      expect(getByTestId('zoom-reset-btn').props.children.props.children).toBe('50%');
    });

    it('switches to fallback code view if WebView reports a Mermaid syntax error', () => {
      const { getByTestId, queryByTestId } = render(<MermaidDiagram chart="broken syntax" />);
      expect(getByTestId('mermaid-webview')).toBeTruthy();

      act(() => {
        mockWebViewModule.__simulateMessage(
          JSON.stringify({ type: 'error', message: 'Parse error on line 1' })
        );
      });

      // Should automatically fall back to raw code container
      expect(getByTestId('mermaid-raw-code-container')).toBeTruthy();
      expect(queryByTestId('mermaid-webview')).toBeNull();
    });
  });
});
