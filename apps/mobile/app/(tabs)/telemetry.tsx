import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Radio } from 'lucide-react-native';
import { useAgentRuns } from '@/api/useAgentRuns';
import { useCurrentWorkspace } from '@/api/useWorkspaces';
import { AgentRun, AgentRunStatus } from '@/api/types';
import { colors } from '@/theme/colors';

type StatusFilter = 'all' | 'active' | 'needs_review' | 'verified' | 'failed';

export default function TelemetryScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { currentWorkspace } = useCurrentWorkspace();
  const { data: runs = [], isLoading, refetch } = useAgentRuns();

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') {
        return (
          run.status === 'running' ||
          run.status === 'queued' ||
          run.status === 'preparing'
        );
      }
      return run.status === statusFilter;
    });
  }, [runs, statusFilter]);

  const metrics = useMemo(() => {
    return {
      active: runs.filter((r) => r.status === 'running' || r.status === 'queued')
        .length,
      needsReview: runs.filter((r) => r.status === 'needs_review').length,
      verified: runs.filter((r) => r.status === 'verified').length,
      failed: runs.filter((r) => r.status === 'failed').length,
    };
  }, [runs]);

  const getStatusBadge = (status: AgentRunStatus) => {
    switch (status) {
      case 'running':
        return {
          label: 'RUNNING',
          color: colors.phantom.cyan,
          bg: 'rgba(0, 245, 212, 0.12)',
        };
      case 'needs_review':
        return {
          label: 'NEEDS REVIEW',
          color: colors.talisman.yellow,
          bg: 'rgba(255, 209, 102, 0.12)',
        };
      case 'verified':
        return {
          label: 'VERIFIED',
          color: colors.status.done,
          bg: 'rgba(0, 245, 160, 0.12)',
        };
      case 'failed':
        return {
          label: 'FAILED',
          color: colors.status.failed,
          bg: 'rgba(239, 35, 60, 0.12)',
        };
      case 'queued':
      default:
        return {
          label: status.toUpperCase(),
          color: colors.textMuted,
          bg: colors.surfaceHighlight,
        };
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Agent Telemetry</Text>
          <Text style={styles.headerSubtitle}>
            {currentWorkspace?.name || 'Workspace'} · Live SSE Stream
          </Text>
        </View>
        <View style={styles.liveIndicator}>
          <Radio size={12} color={colors.phantom.mint} />
          <Text style={styles.liveText}>Ready</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.phantom.cyan}
          />
        }
      >
        {/* Metric Overview Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.phantom.cyan }]}>
              {metrics.active}
            </Text>
            <Text style={styles.metricLabel}>Active</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.talisman.yellow }]}>
              {metrics.needsReview}
            </Text>
            <Text style={styles.metricLabel}>Review</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.status.done }]}>
              {metrics.verified}
            </Text>
            <Text style={styles.metricLabel}>Verified</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.status.failed }]}>
              {metrics.failed}
            </Text>
            <Text style={styles.metricLabel}>Failed</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {(['all', 'active', 'needs_review', 'verified', 'failed'] as StatusFilter[]).map(
            (f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  statusFilter === f ? styles.filterPillActive : null,
                ]}
                onPress={() => setStatusFilter(f)}
                testID={`telemetry-filter-${f}`}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === f ? styles.filterPillTextActive : null,
                  ]}
                >
                  {f === 'needs_review'
                    ? 'Needs Review'
                    : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        {/* Runs List */}
        {filteredRuns.length === 0 ? (
          <View style={styles.emptyCard} testID="telemetry-empty-card">
            <Text style={styles.emptyTitle}>No Agent Runs Found</Text>
            <Text style={styles.emptySubtitle}>
              {statusFilter !== 'all'
                ? `No runs currently in status "${statusFilter}".`
                : 'Dispatch an agent from a task card to see telemetry.'}
            </Text>
          </View>
        ) : (
          filteredRuns.map((run: AgentRun) => {
            const badge = getStatusBadge(run.status);
            const rawEvidence = Array.isArray(run.evidence)
              ? run.evidence[0]
              : run.evidence;

            return (
              <View
                key={`run-${run.id}`}
                style={styles.runCard}
                testID={`telemetry-run-card-${run.id}`}
              >
                <View style={styles.runCardHeader}>
                  <View style={styles.runTitleCol}>
                    <View style={styles.issueKeyRow}>
                      {run.task?.issue_key && (
                        <Text style={styles.issueKey}>{run.task.issue_key}</Text>
                      )}
                      <Text style={styles.runIdText}>Run #{run.id}</Text>
                    </View>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {run.task?.title || run.summary || `Agent Run #${run.id}`}
                    </Text>
                  </View>

                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.runCardMeta}>
                  <Text style={styles.providerText}>
                    {run.provider} · {run.model || 'default'}
                  </Text>

                  {rawEvidence && (
                    <Text
                      style={[
                        styles.evidenceText,
                        {
                          color:
                            rawEvidence.tests_failed > 0
                              ? colors.status.failed
                              : colors.status.done,
                        },
                      ]}
                    >
                      {rawEvidence.tests_passed}/{rawEvidence.tests_total} Tests
                    </Text>
                  )}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.consoleBtn}
                    onPress={() => router.push(`/agent-runs/${run.id}` as any)}
                    testID={`run-console-btn-${run.id}`}
                  >
                    <Text style={styles.consoleBtnText}>Live Console ↗</Text>
                  </TouchableOpacity>

                  {run.status === 'needs_review' && (
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() =>
                        router.push(`/agent-runs/${run.id}/review` as any)
                      }
                      testID={`run-review-btn-${run.id}`}
                    >
                      <Text style={styles.reviewBtnText}>Review Handoff 🔐</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.midnight[950],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveText: {
    color: colors.phantom.mint,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollBody: {
    padding: 14,
    gap: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  filterScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceCard,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.phantom.cyan,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.phantom.cyan,
  },
  runCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  runCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  runTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  issueKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  issueKey: {
    color: colors.phantom.cyan,
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
  },
  runIdText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  taskTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  runCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  providerText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  evidenceText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  consoleBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  consoleBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  reviewBtn: {
    flex: 1,
    backgroundColor: colors.phantom.cyan,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: colors.midnight[950],
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    backgroundColor: colors.surfaceCard,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 12,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
