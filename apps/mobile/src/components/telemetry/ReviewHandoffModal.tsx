import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { AgentRun, VerificationEvidence } from '@/api/types';
import { BiometricsService } from '@/services/biometrics';
import { colors } from '@/theme/colors';

export interface ReviewHandoffModalProps {
  visible: boolean;
  run: AgentRun;
  onApprove: (runId: number) => Promise<void>;
  onReject: (runId: number, reason: string) => Promise<void>;
  onClose: () => void;
}

export const ReviewHandoffModal: React.FC<ReviewHandoffModalProps> = ({
  visible,
  run,
  onApprove,
  onReject,
  onClose,
}) => {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rawEvidence = Array.isArray(run.evidence) ? run.evidence[0] : run.evidence;
  const evidence: VerificationEvidence = rawEvidence || {
    tests_passed: 0,
    tests_failed: 0,
    tests_total: 0,
  };

  const hasFailingTests = evidence.tests_failed > 0;

  const handleApproveWithBiometrics = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await BiometricsService.guardSensitiveAction(
        async () => {
          await onApprove(run.id);
        },
        'Confirm approval for agent run handoff'
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric verification or approval failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg('Rejection reason is required');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onReject(run.id, rejectReason.trim());
      setRejectMode(false);
      setRejectReason('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Rejection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="review-handoff-modal">
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Handoff Review</Text>
            <TouchableOpacity onPress={onClose} testID="close-modal-btn">
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMsg && (
            <View style={styles.errorBanner} testID="handoff-error-banner">
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Test Evidence Breakdown */}
          <View style={styles.evidenceSection} testID="evidence-section">
            <Text style={styles.sectionTitle}>Verification Evidence</Text>

            <View style={styles.evidenceStatsRow}>
              <View style={styles.evidenceStatBox} testID="evidence-passed-box">
                <Text style={[styles.statValue, { color: colors.status.done }]} testID="evidence-passed-val">
                  {evidence.tests_passed}
                </Text>
                <Text style={styles.statLabel}>Passed</Text>
              </View>

              <View style={styles.evidenceStatBox} testID="evidence-failed-box">
                <Text style={[styles.statValue, { color: hasFailingTests ? colors.status.failed : colors.textMuted }]} testID="evidence-failed-val">
                  {evidence.tests_failed}
                </Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>

              <View style={styles.evidenceStatBox} testID="evidence-total-box">
                <Text style={styles.statValue} testID="evidence-total-val">
                  {evidence.tests_total}
                </Text>
                <Text style={styles.statLabel}>Total Tests</Text>
              </View>
            </View>

            {evidence.commit_sha && (
              <Text style={styles.metaRow} testID="evidence-commit-sha">
                Commit: <Text style={styles.monoText}>{evidence.commit_sha.substring(0, 7)}</Text>
              </Text>
            )}

            {evidence.changed_files && evidence.changed_files.length > 0 && (
              <Text style={styles.metaRow} testID="evidence-changed-files">
                Files Changed: {evidence.changed_files.length}
              </Text>
            )}
          </View>

          {/* Reject Mode Form */}
          {rejectMode ? (
            <View style={styles.rejectContainer} testID="reject-form">
              <Text style={styles.inputLabel}>Reason for Rejection:</Text>
              <TextInput
                style={styles.reasonInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Explain what needs fixing..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
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
          ) : (
            /* Action Buttons (Approve / Reject) */
            <View style={styles.actionRow} testID="handoff-actions">
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => setRejectMode(true)}
                disabled={isSubmitting}
                testID="reject-action-btn"
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.approveBtn,
                  hasFailingTests ? styles.btnDisabled : null,
                ]}
                onPress={handleApproveWithBiometrics}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 13, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.textMuted,
    padding: 4,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 35, 60, 0.15)',
    borderLeftWidth: 3,
    borderColor: colors.status.failed,
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  errorText: {
    color: colors.status.failed,
    fontSize: 12,
    fontWeight: '600',
  },
  evidenceSection: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  evidenceStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  evidenceStatBox: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metaRow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  monoText: {
    fontFamily: 'Courier',
    color: colors.phantom.cyan,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
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
  rejectContainer: {
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
    minHeight: 70,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
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
