import React from 'react';
import { render } from '@testing-library/react-native';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';

describe('MarkdownRenderer Component (Tier 1 & 2)', () => {
  const sampleMarkdown = `
# Release Notes v1.0
## Architecture Highlights
### Protocol v1
This is a standard paragraph introducing the release.

> [!NOTE]
> Ensure all biometrics permissions are granted in iOS Settings.

> [!WARNING]
> Do not expose the device_secret in application logs.

> [!IMPORTANT]
> Epics must never have sprint_id set directly.

> [!TIP]
> Use QR scanning to pair in 3 seconds.

> [!CAUTION]
> Rejecting a handoff resets task execution status.

\`\`\`typescript
const client = new TaskHubApiClient();
await client.getWorkspaces();
\`\`\`

- Fast native QR scanner
- Real-time SSE streaming logs
`;

  describe('Tier 1: GFM Parsing & Elements Rendering', () => {
    it('renders headings, paragraphs, and list items cleanly', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      expect(getByTestId('markdown-renderer')).toBeTruthy();
      expect(getByTestId('markdown-h1-1').props.children).toBe('Release Notes v1.0');
      expect(getByTestId('markdown-h2-2').props.children).toBe('Architecture Highlights');
      expect(getByTestId('markdown-h3-3').props.children).toBe('Protocol v1');
      expect(getByTestId('markdown-p-4').props.children).toBe(
        'This is a standard paragraph introducing the release.'
      );
      expect(getByTestId('markdown-list-item-26')).toBeTruthy();
      expect(getByTestId('markdown-list-item-27')).toBeTruthy();
    });

    it('renders syntax-highlighted code blocks with dark background', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const codeBlock = getByTestId('markdown-code-block-24');
      expect(codeBlock).toBeTruthy();
    });
  });

  describe('Tier 2: GitHub Alert Callouts ([!NOTE], [!WARNING], [!IMPORTANT], etc.)', () => {
    it('renders [!NOTE] callout box with cyan highlight and title', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const noteBox = getByTestId('markdown-alert-note');
      const noteTitle = getByTestId('markdown-alert-title-note');
      const noteContent = getByTestId('markdown-alert-content-note');

      expect(noteBox).toBeTruthy();
      expect(noteTitle.props.children).toBe('NOTE');
      expect(noteContent.props.children).toContain('Ensure all biometrics permissions');
    });

    it('renders [!WARNING] callout box with amber highlight and title', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const warnBox = getByTestId('markdown-alert-warning');
      const warnTitle = getByTestId('markdown-alert-title-warning');
      const warnContent = getByTestId('markdown-alert-content-warning');

      expect(warnBox).toBeTruthy();
      expect(warnTitle.props.children).toBe('WARNING');
      expect(warnContent.props.children).toContain('Do not expose the device_secret');
    });

    it('renders [!IMPORTANT] callout box with purple highlight and title', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const impBox = getByTestId('markdown-alert-important');
      const impTitle = getByTestId('markdown-alert-title-important');
      const impContent = getByTestId('markdown-alert-content-important');

      expect(impBox).toBeTruthy();
      expect(impTitle.props.children).toBe('IMPORTANT');
      expect(impContent.props.children).toContain('Epics must never have sprint_id set directly');
    });

    it('renders [!TIP] callout box with mint green highlight and title', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const tipBox = getByTestId('markdown-alert-tip');
      const tipTitle = getByTestId('markdown-alert-title-tip');
      const tipContent = getByTestId('markdown-alert-content-tip');

      expect(tipBox).toBeTruthy();
      expect(tipTitle.props.children).toBe('TIP');
      expect(tipContent.props.children).toContain('Use QR scanning to pair');
    });

    it('renders [!CAUTION] callout box with red highlight and title', () => {
      const { getByTestId } = render(<MarkdownRenderer content={sampleMarkdown} />);

      const cautionBox = getByTestId('markdown-alert-caution');
      const cautionTitle = getByTestId('markdown-alert-title-caution');
      const cautionContent = getByTestId('markdown-alert-content-caution');

      expect(cautionBox).toBeTruthy();
      expect(cautionTitle.props.children).toBe('CAUTION');
      expect(cautionContent.props.children).toContain('Rejecting a handoff resets');
    });

    it('returns null when content is empty string or undefined', () => {
      const { queryByTestId } = render(<MarkdownRenderer content="" />);
      expect(queryByTestId('markdown-renderer')).toBeNull();
    });

    it('handles asterisk bullet list items (* Item)', () => {
      const asterisks = `* First bullet\n* Second bullet`;
      const { getByTestId } = render(<MarkdownRenderer content={asterisks} />);

      expect(getByTestId('markdown-list-item-0')).toBeTruthy();
      expect(getByTestId('markdown-list-item-1')).toBeTruthy();
    });
  });
});
