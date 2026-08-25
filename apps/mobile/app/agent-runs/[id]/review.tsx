import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAgentRun, useApproveHandoff, useRejectHandoff } from '@/api/useAgentRuns';
import { EvidenceCard } from '@/components/telemetry/EvidenceCard';
import { BiometricsService } from '@/services/biometrics';
import { VerificationEvidence } from '@/api/types';
import { colors } from '@/theme/colors';

export default function HandoffReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runId = id ? Number(id) : 0;
  const router = useRouter();

  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: run, isLoading } = useAgentRun(runId);
  const approveMutation = useApproveHandoff();
  const rejectMutation = useRejectHandoff();

  const rawEvidence = Array.isArray(run?.evidence) ? run.evidence[0] : run?.evidence;
  const evidence: VerificationEvidence = rawEvidence || {
    tests_passed: 0,
    tests_failed: 0,
    tests_total: 0,
  };

  const hasFailingTests = evidence.tests_failed > 0;

  const handleBiometricApprove = async () => {
    if (!run?.task_id) {
      setErrorMessage('Missing associated task ID for this agent run.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await BiometricsService.guardSensitiveAction(
        async () => {
          await approveMutation.mutateAsync(run.task_id!);
        },
        'Confirm approval for agent run handoff'
      );

      Alert.alert('Handoff Approved', 'Task marked verified and moved to Done.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Biometric verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      setErrorMessage('Rejection feedback reason is required.');
      return;
    }

    if (!run?.task_id) {
      setErrorMessage('Missing associated task ID for this agent run.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await rejectMutation.mutateAsync({
        taskId: run.task_id,
        reason: rejectReason.trim(),
      });

      Alert.alert('Handoff Rejected', 'Task returned to in_progress with feedback notes.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Rejection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !run) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.phantom.cyan} />
        <Text style={styles.loadingText}>Loading handoff review #{id}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="review-back-btn"
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Handoff Review</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner} testID="handoff-error-banner">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Task Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>TARGET WORK ITEM</Text>
          <Text style={styles.taskTitle}>
            {run?.task?.issue_key ? `[${run.task.issue_key}] ` : ''}
            {run?.task?.title || `Task #${run?.task_id}`}
          </Text>
          {run?.summary && (
            <Text style={styles.summaryText}>{run.summary}</Text>
          )}
        </View>

        {/* Verification Evidence Inspector */}
        <EvidenceCard evidence={evidence} status={run?.status} />

        {/* Rejection Form vs Actions */}
        {rejectMode ? (
          <View style={styles.rejectCard} testID="reject-form">
            <Text style={styles.inputLabel}>Feedback for Agent Runner:</Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Detail required fixes, missing tests, or bugs..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              testID="reject-reason-input"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={() => setRejectMode(false)}
                testID="reject-cancel-btn"
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.dangerBtn]}
                onPress={handleRejectSubmit}
                disabled={isSubmitting}
                testID="reject-confirm-btn"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.dangerBtnText}>Submit Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Action Bar */}
      {!rejectMode && (
        <View style={styles.bottomBar} testID="handoff-actions">
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={() => setRejectMode(true)}
            disabled={isSubmitting}
            testID="reject-action-btn"
          >
            <Text style={styles.rejectBtnText}>Reject Handoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.approveBtn,
              hasFailingTests ? styles.btnDisabled : null,
            ]}
            onPress={handleBiometricApprove}
            disabled={isSubmitting || hasFailingTests}
            testID="approve-biometrics-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.midnight[950]} />
            ) : (
              <Text style={styles.approveBtnText}>
                {hasFailingTests ? 'Fix Tests First' : 'Biometric Approve 🔐'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
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
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 35, 60, 0.15)',
    borderLeftWidth: 3,
    borderColor: colors.status.failed,
    padding: 10,
    borderRadius: 6,
  },
  errorText: {
    color: colors.status.failed,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  taskTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  rejectCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  reasonInput: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    color: colors.textPrimary,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectBtnText: {
    color: colors.status.failed,
    fontWeight: '700',
    fontSize: 14,
  },
  approveBtn: {
    backgroundColor: colors.phantom.cyan,
  },
  approveBtnText: {
    color: colors.midnight[950],
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  cancelBtn: {
    backgroundColor: colors.surfaceHighlight,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: colors.status.failed,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
