import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

export interface MarkdownRendererProps {
  content: string;
}

interface AlertCallout {
  type: 'note' | 'warning' | 'important' | 'tip' | 'caution';
  title: string;
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) {
    return null;
  }

  // Parse lines and identify alert callouts, headings, code blocks, lists, paragraphs
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let inAlert = false;
  let currentAlert: AlertCallout | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeText = codeBlockBuffer.join('\n');
        renderedElements.push(
          <View key={`code-${i}`} style={styles.codeBlock} testID={`markdown-code-block-${i}`}>
            <Text style={styles.codeBlockText}>{codeText}</Text>
          </View>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // GitHub Alert Callouts: e.g. > [!NOTE], > [!WARNING], > [!IMPORTANT]
    const alertMatch = line.match(/^>\s*\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i);
    if (alertMatch) {
      const type = alertMatch[1].toLowerCase() as AlertCallout['type'];
      inAlert = true;
      currentAlert = {
        type,
        title: alertMatch[1].toUpperCase(),
        content: '',
      };
      continue;
    }

    if (inAlert && currentAlert) {
      if (line.startsWith('>')) {
        const text = line.replace(/^>\s?/, '');
        currentAlert.content += (currentAlert.content ? '\n' : '') + text;
        continue;
      } else {
        // End of alert callout
        renderedElements.push(renderAlert(currentAlert, i));
        inAlert = false;
        currentAlert = null;
      }
    }

    // Headings
    if (line.startsWith('# ')) {
      renderedElements.push(
        <Text key={`h1-${i}`} style={styles.h1} testID={`markdown-h1-${i}`}>
          {line.substring(2)}
        </Text>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      renderedElements.push(
        <Text key={`h2-${i}`} style={styles.h2} testID={`markdown-h2-${i}`}>
          {line.substring(3)}
        </Text>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      renderedElements.push(
        <Text key={`h3-${i}`} style={styles.h3} testID={`markdown-h3-${i}`}>
          {line.substring(4)}
        </Text>
      );
      continue;
    }

    // Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      renderedElements.push(
        <View key={`li-${i}`} style={styles.listItem} testID={`markdown-list-item-${i}`}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{line.trim().substring(2)}</Text>
        </View>
      );
      continue;
    }

    // Regular paragraphs
    if (line.trim().length > 0) {
      renderedElements.push(
        <Text key={`p-${i}`} style={styles.paragraph} testID={`markdown-p-${i}`}>
          {line}
        </Text>
      );
    }
  }

  // Flush any trailing alert callout
  if (inAlert && currentAlert) {
    renderedElements.push(renderAlert(currentAlert, lines.length));
  }

  // Flush any open code block
  if (inCodeBlock && codeBlockBuffer.length > 0) {
    renderedElements.push(
      <View key="trailing-code" style={styles.codeBlock}>
        <Text style={styles.codeBlockText}>{codeBlockBuffer.join('\n')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="markdown-renderer">
      {renderedElements}
    </View>
  );
};

function renderAlert(alert: AlertCallout, key: number) {
  let borderColor: string = colors.phantom.cyan;
  let bgColor = 'rgba(0, 245, 212, 0.08)';
  let icon = 'ℹ️';

  switch (alert.type) {
    case 'warning':
      borderColor = colors.talisman.gold;
      bgColor = 'rgba(245, 158, 11, 0.08)';
      icon = '⚠️';
      break;
    case 'important':
      borderColor = colors.phantom.purple;
      bgColor = 'rgba(157, 78, 221, 0.08)';
      icon = '⚡';
      break;
    case 'caution':
      borderColor = colors.talisman.seal;
      bgColor = 'rgba(239, 35, 60, 0.08)';
      icon = '🚨';
      break;
    case 'tip':
      borderColor = colors.phantom.mint;
      bgColor = 'rgba(0, 245, 160, 0.08)';
      icon = '💡';
      break;
  }

  return (
    <View
      key={`alert-${key}`}
      style={[styles.alertContainer, { borderColor, backgroundColor: bgColor }]}
      testID={`markdown-alert-${alert.type}`}
    >
      <View style={styles.alertHeader}>
        <Text style={styles.alertIcon}>{icon}</Text>
        <Text style={[styles.alertTitle, { color: borderColor }]} testID={`markdown-alert-title-${alert.type}`}>
          {alert.title}
        </Text>
      </View>
      <Text style={styles.alertContent} testID={`markdown-alert-content-${alert.type}`}>
        {alert.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  h1: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginVertical: 10,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginVertical: 8,
  },
  h3: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginVertical: 6,
  },
  paragraph: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    color: colors.phantom.cyan,
    marginRight: 6,
    fontSize: 14,
  },
  listText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  codeBlock: {
    backgroundColor: colors.midnight[950],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginVertical: 8,
  },
  codeBlockText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: colors.phantom.mint,
  },
  alertContainer: {
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 10,
    marginVertical: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  alertContent: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
});
