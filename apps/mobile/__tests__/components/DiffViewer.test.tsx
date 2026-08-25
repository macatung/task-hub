import React from 'react';
import { render } from '@testing-library/react-native';
import { DiffViewer } from '@/components/diff/DiffViewer';

describe('DiffViewer Component (Tier 1 & 2)', () => {
  const sampleDiff = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,4 +10,5 @@
 const timeout = 5000;
-const oldSecret = 'insecure';
+const newSecret = 'hardware_backed_keychain';
+const biometricEnforced = true;
 export default timeout;`;

  describe('Tier 1: Syntax Highlighting & Line Classification', () => {
    it('renders file path and diff statistics badges correctly', () => {
      const { getByTestId } = render(
        <DiffViewer diffText={sampleDiff} filePath="src/auth.ts" />
      );

      expect(getByTestId('diff-file-path').props.children).toBe('src/auth.ts');
      expect(getByTestId('diff-additions-count').props.children).toBe('+2');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-1');
    });

    it('renders chunk header line with @@ marker', () => {
      const { getByTestId } = render(<DiffViewer diffText={sampleDiff} />);
      const chunkLine = getByTestId('diff-line-2');
      expect(chunkLine).toBeTruthy();
    });

    it('renders additions with emerald highlight and deletions with red highlight', () => {
      const { getByTestId } = render(<DiffViewer diffText={sampleDiff} />);
      const deletionLine = getByTestId('diff-line-4');
      const additionLine1 = getByTestId('diff-line-5');
      const additionLine2 = getByTestId('diff-line-6');

      expect(deletionLine).toBeTruthy();
      expect(additionLine1).toBeTruthy();
      expect(additionLine2).toBeTruthy();
    });

    it('renders default title "Unified Diff" when no filePath is passed', () => {
      const { getByTestId } = render(<DiffViewer diffText={sampleDiff} />);
      expect(getByTestId('diff-file-path').props.children).toBe('Unified Diff');
    });
  });

  describe('Tier 2: Empty & Corner Cases', () => {
    it('renders empty state when diffText is empty string', () => {
      const { getByTestId } = render(<DiffViewer diffText="" />);
      expect(getByTestId('diff-empty-state')).toBeTruthy();
    });

    it('renders empty state when diffText is undefined or null', () => {
      const { getByTestId } = render(<DiffViewer diffText={undefined} />);
      expect(getByTestId('diff-empty-state')).toBeTruthy();
    });

    it('renders empty state when diffText contains only whitespace', () => {
      const { getByTestId } = render(<DiffViewer diffText={'   \n  \t '} />);
      expect(getByTestId('diff-empty-state')).toBeTruthy();
    });

    it('handles diff with only additions cleanly', () => {
      const additionsOnly = `+line 1\n+line 2\n+line 3`;
      const { getByTestId } = render(<DiffViewer diffText={additionsOnly} />);

      expect(getByTestId('diff-additions-count').props.children).toBe('+3');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-0');
    });

    it('handles diff with only deletions cleanly', () => {
      const deletionsOnly = `-deleted line 1\n-deleted line 2`;
      const { getByTestId } = render(<DiffViewer diffText={deletionsOnly} />);

      expect(getByTestId('diff-additions-count').props.children).toBe('+0');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-2');
    });

    it('handles diff with diff --git header lines without failing', () => {
      const gitDiff = `diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n+new line`;
      const { getByTestId } = render(<DiffViewer diffText={gitDiff} />);

      expect(getByTestId('diff-line-0')).toBeTruthy();
      expect(getByTestId('diff-additions-count').props.children).toBe('+1');
    });
  });
});
