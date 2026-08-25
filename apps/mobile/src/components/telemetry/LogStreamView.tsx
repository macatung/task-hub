import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AgentRunLog, ConnectionState } from '@/api/types';
import { colors } from '@/theme/colors';

export interface LogStreamViewProps {
  logs: AgentRunLog[];
  connectionState?: ConnectionState;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  onClearLogs?: () => void;
  title?: string;
  testID?: string;
}

type StreamFilter = 'all' | 'stdout' | 'stderr' | 'system';

export const LogStreamView: React.FC<LogStreamViewProps> = ({
  logs,
  connectionState = 'connected',
  autoScroll = true,
  onToggleAutoScroll,
  onClearLogs,
  title = 'Live Stream Logs',
  testID = 'log-stream-view',
}) => {
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (streamFilter !== 'all' && log.stream !== streamFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        return log.content.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [logs, streamFilter, searchQuery]);

  useEffect(() => {
    if (autoScroll && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopyLogs = async () => {
    const formatted = filteredLogs
      .map((l) => `[${l.stream.toUpperCase()} ${l.occurred_at || ''}] ${l.content}`)
      .join('');

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(formatted);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {}
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case 'stderr':
        return colors.status.failed;
      case 'system':
        return colors.talisman.gold;
      case 'stdout':
      default:
        return colors.phantom.cyan;
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.titleText}>{title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filteredLogs.length} lines</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionControls}>
          <TouchableOpacity
            style={[styles.controlBtn, autoScroll ? styles.controlBtnActive : null]}
            onPress={onToggleAutoScroll}
            testID="autoscroll-toggle-btn"
          >
            <Text
              style={[
                styles.controlBtnText,
                autoScroll ? { color: colors.phantom.cyan } : null,
              ]}
            >
              {autoScroll ? '🔒 Auto-Scroll' : '🔓 Free Scroll'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleCopyLogs}
            testID="copy-logs-btn"
          >
            <Text style={styles.controlBtnText}>
              {copyFeedback ? '✓ Copied' : '📋 Copy'}
            </Text>
          </TouchableOpacity>

          {onClearLogs && (
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={onClearLogs}
              testID="clear-logs-btn"
            >
              <Text style={styles.controlBtnText}>🗑 Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterBar}>
        <View style={styles.streamFilters}>
          {(['all', 'stdout', 'stderr', 'system'] as StreamFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, streamFilter === f ? styles.filterPillActive : null]}
              onPress={() => setStreamFilter(f)}
              testID={`filter-${f}-btn`}
            >
              <Text
                style={[
                  styles.filterPillText,
                  streamFilter === f ? styles.filterPillTextActive : null,
                ]}
              >
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Filter log lines..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="log-search-input"
        />
      </View>

      {/* Terminal Viewport */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.terminalViewport}
        contentContainerStyle={styles.terminalContent}
        testID="terminal-scroll-view"
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer} testID="logs-empty-state">
            <Text style={styles.emptyText}>
              {connectionState === 'connecting'
                ? 'Connecting to live SSE telemetry feed...'
                : searchQuery
                ? 'No log lines matching query'
                : 'Waiting for agent logs...'}
            </Text>
          </View>
        ) : (
          filteredLogs.map((log, idx) => {
            const streamColor = getStreamColor(log.stream);
            return (
              <View key={log.id ? `log-${log.id}` : `log-idx-${idx}`} style={styles.logLine}>
                <Text style={styles.lineNumber}>{idx + 1}</Text>
                <Text style={[styles.streamTag, { color: streamColor }]}>
                  [{log.stream.toUpperCase()}]
                </Text>
                <Text
                  style={[
                    styles.logText,
                    {
                      color:
                        log.stream === 'stderr'
                          ? colors.status.failed
                          : colors.textPrimary,
                    },
                  ]}
                >
                  {log.content}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.midnight[950],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flex: 1,
    minHeight: 280,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Courier',
  },
  actionControls: {
    flexDirection: 'row',
    gap: 6,
  },
  controlBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlBtnActive: {
    borderColor: colors.phantom.cyan,
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
  },
  controlBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  streamFilters: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.surfaceCard,
  },
  filterPillActive: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterPillText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: colors.textPrimary,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.midnight[900],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: colors.textPrimary,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.border,
  },
  terminalViewport: {
    flex: 1,
    backgroundColor: colors.midnight[950],
    padding: 8,
  },
  terminalContent: {
    paddingBottom: 16,
  },
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 1,
  },
  lineNumber: {
    color: colors.textMuted,
    fontFamily: 'Courier',
    fontSize: 11,
    width: 32,
    textAlign: 'right',
    marginRight: 8,
    opacity: 0.5,
  },
  streamTag: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  logText: {
    flex: 1,
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 16,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Courier',
  },
});
