import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { VerificationEvidence, AgentRunStatus } from '@/api/types';
import { DiffViewer } from '../diff/DiffViewer';
import { colors } from '@/theme/colors';

export interface EvidenceCardProps {
  evidence?: VerificationEvidence | VerificationEvidence[] | null;
  status?: AgentRunStatus;
  testID?: string;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  evidence,
  status = 'needs_review',
  testID = 'evidence-card',
}) => {
  const [showDiff, setShowDiff] = useState(false);

  const raw = Array.isArray(evidence) ? evidence[0] : evidence;
  const data: VerificationEvidence = raw || {
    tests_passed: 0,
    tests_failed: 0,
    tests_total: 0,
  };

  const hasFailingTests = data.tests_failed > 0;
  const passRate =
    data.tests_total > 0
      ? Math.round((data.tests_passed / data.tests_total) * 100)
      : 0;

  const handleOpenPR = () => {
    const url = data.pull_request_url || data.pr_url;
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Verification Evidence</Text>
          <Text style={styles.subtitle}>Automated Test & Diff Audit</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            hasFailingTests ? styles.statusPillFailed : styles.statusPillPassed,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              hasFailingTests
                ? { color: colors.status.failed }
                : { color: colors.status.done },
            ]}
          >
            {hasFailingTests ? 'FAILING TESTS' : 'TESTS PASSED'}
          </Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricBox} testID="evidence-passed-box">
          <Text
            style={[styles.metricValue, { color: colors.status.done }]}
            testID="evidence-passed-val"
          >
            {data.tests_passed}
          </Text>
          <Text style={styles.metricLabel}>Passed</Text>
        </View>

        <View style={styles.metricBox} testID="evidence-failed-box">
          <Text
            style={[
              styles.metricValue,
              { color: hasFailingTests ? colors.status.failed : colors.textMuted },
            ]}
            testID="evidence-failed-val"
          >
            {data.tests_failed}
          </Text>
          <Text style={styles.metricLabel}>Failed</Text>
        </View>

        <View style={styles.metricBox} testID="evidence-total-box">
          <Text style={styles.metricValue} testID="evidence-total-val">
            {data.tests_total}
          </Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: colors.phantom.cyan }]}>
            {passRate}%
          </Text>
          <Text style={styles.metricLabel}>Rate</Text>
        </View>
      </View>

      {/* Meta Information */}
      <View style={styles.metaSection}>
        {data.commit_sha && (
          <View style={styles.metaRow} testID="evidence-commit-sha">
            <Text style={styles.metaLabel}>Commit SHA:</Text>
            <Text style={styles.monoValue}>{data.commit_sha.substring(0, 8)}</Text>
          </View>
        )}

        {(data.pull_request_url || data.pr_url) && (
          <TouchableOpacity
            style={styles.metaRow}
            onPress={handleOpenPR}
            testID="evidence-pr-link"
          >
            <Text style={styles.metaLabel}>Pull Request:</Text>
            <Text style={[styles.monoValue, { color: colors.phantom.blue }]}>
              {data.pull_request_url || data.pr_url} ↗
            </Text>
          </TouchableOpacity>
        )}

        {data.changed_files && data.changed_files.length > 0 && (
          <View style={styles.metaRow} testID="evidence-changed-files">
            <Text style={styles.metaLabel}>Changed Files:</Text>
            <Text style={styles.metaValue}>{data.changed_files.length} files</Text>
          </View>
        )}
      </View>

      {/* Diffs Viewer Toggle */}
      {data.diff && (
        <View style={styles.diffSection}>
          <TouchableOpacity
            style={styles.diffToggleBtn}
            onPress={() => setShowDiff((prev) => !prev)}
            testID="evidence-diff-toggle"
          >
            <Text style={styles.diffToggleText}>
              {showDiff ? '▲ Hide Code Diffs' : '▼ Inspect Code Diffs'}
            </Text>
          </TouchableOpacity>

          {showDiff && (
            <DiffViewer diffText={data.diff} filePath={data.changed_files?.[0]} />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillPassed: {
    backgroundColor: 'rgba(0, 245, 160, 0.12)',
    borderColor: colors.status.done,
  },
  statusPillFailed: {
    backgroundColor: 'rgba(239, 35, 60, 0.15)',
    borderColor: colors.status.failed,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  metaSection: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  monoValue: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: colors.phantom.cyan,
  },
  diffSection: {
    marginTop: 10,
  },
  diffToggleBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  diffToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
