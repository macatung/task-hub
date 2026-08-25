import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Trash2,
  Clock,
  Play,
  Bot,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react-native';
import { useTask, useUpdateTask, useDeleteTask, useToggleTaskStatus } from '@/api/useTasks';
import { useAgentRuns } from '@/api/useAgentRuns';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { colors } from '@/theme/colors';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const taskId = Number(id);

  const { data: task, isLoading, error } = useTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toggleStatus } = useToggleTaskStatus();
  const { data: agentRuns } = useAgentRuns({ task_id: taskId });

  const [pomodoroRunning, setPomodoroRunning] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.phantom.cyan} />
        <Text style={styles.loadingText}>Loading task details...</Text>
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={styles.centeredContainer}>
        <AlertTriangle size={36} color={colors.status.failed} />
        <Text style={styles.errorTitle}>Failed to load task</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate dependency blockers
  const dependencies = task.dependencies || [];
  const incompletePrereqs = dependencies.filter(
    (dep) => dep.depends_on && dep.depends_on.status !== 'done'
  );
  const isBlocked = incompletePrereqs.length > 0;

  const handleDelete = () => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask.mutateAsync(task.id);
          router.back();
        },
      },
    ]);
  };

  const handleIncrementPomodoro = () => {
    const current = task.completed_pomodoros || 0;
    updateTask.mutate({
      id: task.id,
      payload: { completed_pomodoros: current + 1 },
    });
  };

  const latestRun = agentRuns && agentRuns.length > 0 ? agentRuns[0] : null;

  return (
    <View style={styles.container} testID="task-detail-screen">
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.issueKey} numberOfLines={1}>
            {task.issue_key || `#${task.id}`}
          </Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
          <Trash2 size={18} color={colors.status.failed} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent}>
        {/* Type & Priority Badges */}
        <View style={styles.badgesRow}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: `${
                  colors.issueType[task.issue_type] || colors.textMuted
                }22`,
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: colors.issueType[task.issue_type] || colors.textMuted },
              ]}
            >
              {task.issue_type.toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.statusPill,
              {
                backgroundColor: `${
                  colors.status[task.status] || colors.textMuted
                }22`,
                borderColor: colors.status[task.status] || colors.textMuted,
              },
            ]}
            onPress={() => toggleStatus(task)}
            testID="task-detail-status"
          >
            <Text
              style={[
                styles.statusPillText,
                { color: colors.status[task.status] || colors.textMuted },
              ]}
            >
              {task.status.replace('_', ' ').toUpperCase()} ▾
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor: `${
                  colors.priority[task.priority] || colors.textMuted
                }22`,
              },
            ]}
          >
            <Text
              style={[
                styles.priorityBadgeText,
                { color: colors.priority[task.priority] || colors.textMuted },
              ]}
            >
              {task.priority.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Task Title */}
        <Text style={styles.taskTitle} testID="task-detail-title">
          {task.title}
        </Text>

        {/* Dependency Incomplete Warning Banner */}
        {isBlocked && (
          <View style={styles.warningBanner} testID="dependency-warning-banner">
            <AlertTriangle size={16} color={colors.talisman.gold} />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Blocked by Incomplete Prerequisite</Text>
              <Text style={styles.warningText}>
                {incompletePrereqs
                  .map((dep) => dep.depends_on?.title || `Task #${dep.depends_on_task_id}`)
                  .join(', ')}
              </Text>
            </View>
          </View>
        )}

        {/* Metadata Card Grid */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Story Points</Text>
              <Text style={styles.metaValue}>
                {task.story_points !== undefined && task.story_points !== null
                  ? `${task.story_points} pts`
                  : 'Unestimated'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Sprint</Text>
              <Text style={styles.metaValue}>
                {task.sprint_id ? `Sprint #${task.sprint_id}` : 'Backlog'}
              </Text>
            </View>
          </View>

          {task.parent_epic && (
            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Parent Epic</Text>
                <Text style={[styles.metaValue, { color: colors.issueType.epic }]}>
                  ⚡ {task.parent_epic.title}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Pomodoro Focus Tracker Section */}
        <View style={styles.sectionCard} testID="pomodoro-tracker-section">
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Clock size={16} color={colors.talisman.seal} />
              <Text style={styles.sectionTitle}>Pomodoro Tracker</Text>
            </View>
            <Text style={styles.pomodoroCount}>
              🍅 {task.completed_pomodoros || 0}/{task.estimated_pomodoros || 0}
            </Text>
          </View>

          <View style={styles.pomodoroActions}>
            <TouchableOpacity
              testID="pomodoro-increment-btn"
              style={styles.pomodoroBtn}
              onPress={handleIncrementPomodoro}
            >
              <Text style={styles.pomodoroBtnText}>+1 Completed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="pomodoro-timer-btn"
              style={[
                styles.pomodoroTimerBtn,
                pomodoroRunning && styles.pomodoroTimerRunning,
              ]}
              onPress={() => setPomodoroRunning(!pomodoroRunning)}
            >
              <Play size={14} color={colors.midnight[950]} />
              <Text style={styles.pomodoroTimerText}>
                {pomodoroRunning ? 'Running (25m)' : 'Start 25m Focus'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.sectionCard} testID="task-detail-markdown">
          <Text style={styles.sectionTitle}>Description</Text>
          {task.description ? (
            <MarkdownRenderer content={task.description} />
          ) : (
            <Text style={styles.emptyDescText}>No description provided.</Text>
          )}
        </View>

        {/* Remote AI Agent Telemetry / Dispatch */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Bot size={16} color={colors.phantom.cyan} />
            <Text style={styles.sectionTitle}>Agent Telemetry</Text>
          </View>

          {latestRun ? (
            <View style={styles.agentRunBox}>
              <View style={styles.runStatusRow}>
                <Text style={styles.runStatusLabel}>
                  Status: <Text style={{ color: colors.phantom.cyan }}>{latestRun.status}</Text>
                </Text>
                <Text style={styles.runProviderLabel}>{latestRun.provider}</Text>
              </View>

              {latestRun.status === 'needs_review' ? (
                <TouchableOpacity
                  style={styles.reviewHandoffBtn}
                  onPress={() => router.push(`/agent-runs/${latestRun.id}/review` as any)}
                >
                  <CheckCircle2 size={16} color={colors.midnight[950]} />
                  <Text style={styles.reviewHandoffBtnText}>Review Handoff & Evidence</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.viewLogsBtn}
                  onPress={() => router.push(`/agent-runs/${latestRun.id}` as any)}
                >
                  <Text style={styles.viewLogsBtnText}>View Live Execution Logs</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              testID="dispatch-agent-btn"
              style={styles.dispatchBtn}
              onPress={() => {
                Alert.alert('Dispatch Agent', 'Remote agent runner dispatch initiated.');
              }}
            >
              <Bot size={16} color={colors.midnight[950]} />
              <Text style={styles.dispatchBtnText}>Dispatch AI Agent</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight[950],
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.midnight[950],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  backBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconBtn: {
    padding: 6,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  issueKey: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: colors.talisman.gold,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.talisman.gold,
  },
  warningText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  metaCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  pomodoroCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pomodoroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pomodoroBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pomodoroBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  pomodoroTimerBtn: {
    flex: 1,
    backgroundColor: colors.talisman.seal,
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pomodoroTimerRunning: {
    backgroundColor: colors.phantom.mint,
  },
  pomodoroTimerText: {
    color: colors.midnight[950],
    fontSize: 12,
    fontWeight: '700',
  },
  emptyDescText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  agentRunBox: {
    marginTop: 4,
  },
  runStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  runStatusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  runProviderLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  reviewHandoffBtn: {
    backgroundColor: colors.phantom.mint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  reviewHandoffBtnText: {
    color: colors.midnight[950],
    fontSize: 13,
    fontWeight: '700',
  },
  viewLogsBtn: {
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  viewLogsBtnText: {
    color: colors.phantom.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  dispatchBtn: {
    backgroundColor: colors.phantom.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
    marginTop: 4,
  },
  dispatchBtnText: {
    color: colors.midnight[950],
    fontSize: 13,
    fontWeight: '700',
  },
});
