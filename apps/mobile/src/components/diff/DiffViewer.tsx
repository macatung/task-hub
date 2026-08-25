import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

export interface DiffViewerProps {
  diffText?: string;
  filePath?: string;
}

interface DiffLine {
  type: 'addition' | 'deletion' | 'chunk' | 'header' | 'context';
  text: string;
  oldLineNumber?: number | string;
  newLineNumber?: number | string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, filePath }) => {
  const isWhitespaceOnly = !diffText || diffText.trim().length === 0 || diffText.trim().replace(/\\n|\\t|\\r/g, '').trim().length === 0;
  if (isWhitespaceOnly) {
    return (
      <View style={styles.emptyContainer} testID="diff-empty-state">
        <Text style={styles.emptyText}>No changes to display</Text>
      </View>
    );
  }

  const lines = diffText.trim().split('\n');
  const parsedLines: DiffLine[] = [];
  let additionsCount = 0;
  let deletionsCount = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      parsedLines.push({ type: 'chunk', text: line });
    } else if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff --git')) {
      parsedLines.push({ type: 'header', text: line });
    } else if (line.startsWith('+')) {
      additionsCount++;
      parsedLines.push({ type: 'addition', text: line });
    } else if (line.startsWith('-')) {
      deletionsCount++;
      parsedLines.push({ type: 'deletion', text: line });
    } else {
      parsedLines.push({ type: 'context', text: line });
    }
  }

  return (
    <View style={styles.container} testID="diff-viewer">
      {/* File Header & Diff Stats */}
      <View style={styles.diffHeader} testID="diff-header">
        <Text style={styles.filePath} numberOfLines={1} testID="diff-file-path">
          {filePath || 'Unified Diff'}
        </Text>
        <View style={styles.statBadges}>
          <Text style={styles.additionsStat} testID="diff-additions-count">
            {`+${additionsCount}`}
          </Text>
          <Text style={styles.deletionsStat} testID="diff-deletions-count">
            {`-${deletionsCount}`}
          </Text>
        </View>
      </View>

      {/* Code Lines Container */}
      <ScrollView horizontal style={styles.scrollArea}>
        <View style={styles.linesContainer} testID="diff-lines-container">
          {parsedLines.map((line, idx) => {
            let rowStyle: any = styles.contextRow;
            let textStyle: any = styles.contextText;
            let testId = `diff-line-${idx}`;

            if (line.type === 'addition') {
              rowStyle = styles.additionRow;
              textStyle = styles.additionText;
            } else if (line.type === 'deletion') {
              rowStyle = styles.deletionRow;
              textStyle = styles.deletionText;
            } else if (line.type === 'chunk') {
              rowStyle = styles.chunkRow;
              textStyle = styles.chunkText;
            } else if (line.type === 'header') {
              rowStyle = styles.headerRow;
              textStyle = styles.headerText;
            }

            return (
              <View key={idx} style={[styles.lineRow, rowStyle]} testID={testId}>
                <Text style={[styles.codeText, textStyle]}>{line.text}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.midnight[950],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginVertical: 8,
  },
  diffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  filePath: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Courier',
    flex: 1,
  },
  statBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  additionsStat: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.status.done,
  },
  deletionsStat: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.status.failed,
  },
  scrollArea: {
    maxHeight: 400,
  },
  linesContainer: {
    minWidth: '100%',
    paddingVertical: 4,
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
  additionRow: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
  },
  additionText: {
    color: '#00f5a0',
  },
  deletionRow: {
    backgroundColor: 'rgba(255, 0, 84, 0.15)',
  },
  deletionText: {
    color: '#ff0054',
  },
  chunkRow: {
    backgroundColor: 'rgba(0, 187, 249, 0.12)',
  },
  chunkText: {
    color: '#00bbf9',
    fontWeight: '700',
  },
  headerRow: {
    backgroundColor: colors.surfaceHighlight,
  },
  headerText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  contextRow: {
    backgroundColor: 'transparent',
  },
  contextText: {
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
