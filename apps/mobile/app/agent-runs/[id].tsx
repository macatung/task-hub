import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAgentRun, useCancelAgentRun } from '@/api/useAgentRuns';
import { useAgentTelemetryStream } from '@/hooks/useAgentTelemetryStream';
import { LogStreamView } from '@/components/telemetry/LogStreamView';
import { EvidenceCard } from '@/components/telemetry/EvidenceCard';
import { ReviewHandoffModal } from '@/components/telemetry/ReviewHandoffModal';
import { useApproveHandoff, useRejectHandoff } from '@/api/useAgentRuns';
import { colors } from '@/theme/colors';

export default function AgentRunConsoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runId = id ? Number(id) : 0;
  const router = useRouter();

  const [showReviewModal, setShowReviewModal] = useState(false);

  const { data: run, isLoading, refetch } = useAgentRun(runId);
  const activeRunId = run?.id || runId;
  const stream = useAgentTelemetryStream({ runId: activeRunId, enabled: !!activeRunId });

  const cancelMutation = useCancelAgentRun();
  const approveMutation = useApproveHandoff();
  const rejectMutation = useRejectHandoff();

  const activeStatus = stream.latestStatus || run?.status || 'queued';

  const getConnectionPill = () => {
    switch (stream.connectionState) {
      case 'connected':
        return {
          label: 'LIVE',
          bg: 'rgba(0, 245, 160, 0.15)',
          text: colors.status.done,
          border: colors.status.done,
        };
      case 'reconnecting':
        return {
          label: 'RECONNECTING',
          bg: 'rgba(255, 209, 102, 0.15)',
          text: colors.talisman.yellow,
          border: colors.talisman.yellow,
        };
      case 'connecting':
        return {
          label: 'CONNECTING',
          bg: 'rgba(0, 187, 249, 0.15)',
          text: colors.phantom.blue,
          border: colors.phantom.blue,
        };
      case 'disconnected':
      default:
        return {
          label: 'OFFLINE',
          bg: colors.surfaceHighlight,
          text: colors.textMuted,
          border: colors.border,
        };
    }
  };

  const handleCancelRun = () => {
    Alert.alert(
      'Cancel Agent Run',
      'Are you sure you want to cancel this agent execution?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            await cancelMutation.mutateAsync({
              runId,
              reason: 'Cancelled by user from mobile console',
            });
            refetch();
          },
        },
      ]
    );
  };

  const pill = getConnectionPill();

  if (isLoading && !run) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.phantom.cyan} />
        <Text style={styles.loadingText}>Loading agent run #{id}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="agent-run-back-btn"
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Run #{activeRunId}</Text>
          <Text style={styles.headerSubtitle}>
            {run?.provider || 'agent'} · {run?.model || 'default'}
          </Text>
        </View>

        <View
          style={[
            styles.statusPill,
            { backgroundColor: pill.bg, borderColor: pill.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: pill.text }]} />
          <Text style={[styles.statusPillText, { color: pill.text }]}>
            {pill.label}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollBody}
      >
        {/* Run Metadata Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaCardHeader}>
            <View style={styles.taskTitleRow}>
              {run?.task?.issue_key && (
                <View style={styles.issueKeyPill}>
                  <Text style={styles.issueKeyText}>{run.task.issue_key}</Text>
                </View>
              )}
              <Text style={styles.taskTitle} numberOfLines={1}>
                {run?.task?.title || `Agent Run #${runId}`}
              </Text>
            </View>

            <View style={styles.runStatusBadge}>
              <Text style={styles.runStatusText}>
                {activeStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          {stream.latestStep && (
            <View style={styles.stepRow}>
              <Text style={styles.stepLabel}>Active Step:</Text>
              <Text style={styles.stepText}>{stream.latestStep}</Text>
            </View>
          )}
        </View>

        {/* Evidence Card if Available */}
        {(stream.evidence || run?.evidence) && (
          <EvidenceCard
            evidence={stream.evidence || run?.evidence}
            status={activeStatus}
          />
        )}

        {/* Live Stream Log Viewer */}
        <View style={styles.logViewerWrapper}>
          <LogStreamView
            logs={stream.logs}
            connectionState={stream.connectionState}
            autoScroll={stream.autoScroll}
            onToggleAutoScroll={stream.toggleAutoScroll}
            onClearLogs={stream.clearLogs}
          />
        </View>
      </ScrollView>

      {/* Floating Action Bottom Bar */}
      <View style={styles.bottomBar}>
        {activeStatus === 'needs_review' ? (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => setShowReviewModal(true)}
            testID="open-review-btn"
          >
            <Text style={styles.reviewBtnText}>
              Review Handoff & Evidence 🔐
            </Text>
          </TouchableOpacity>
        ) : activeStatus === 'running' || activeStatus === 'queued' ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelRun}
            disabled={cancelMutation.isPending}
            testID="cancel-run-btn"
          >
            <Text style={styles.cancelBtnText}>
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Execution'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Embedded Review Modal */}
      {run && (
        <ReviewHandoffModal
          visible={showReviewModal}
          run={run}
          onApprove={async () => {
            if (run.task_id) {
              await approveMutation.mutateAsync(run.task_id);
              refetch();
            }
          }}
          onReject={async (_id, reason) => {
            if (run.task_id) {
              await rejectMutation.mutateAsync({
                taskId: run.task_id,
                reason,
              });
              refetch();
            }
          }}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.midnight[950],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.midnight[950],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 6,
  },
  backBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  scrollBody: {
    padding: 14,
    gap: 12,
  },
  metaCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  issueKeyPill: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  issueKeyText: {
    color: colors.phantom.cyan,
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
  },
  taskTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  runStatusBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  runStatusText: {
    color: colors.phantom.cyan,
    fontSize: 10,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  stepText: {
    color: colors.talisman.gold,
    fontSize: 11,
    fontFamily: 'Courier',
  },
  logViewerWrapper: {
    height: 380,
  },
  bottomBar: {
    padding: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  reviewBtn: {
    backgroundColor: colors.phantom.cyan,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: colors.midnight[950],
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: 'rgba(239, 35, 60, 0.15)',
    borderWidth: 1,
    borderColor: colors.status.failed,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.status.failed,
    fontSize: 13,
    fontWeight: '700',
  },
});
