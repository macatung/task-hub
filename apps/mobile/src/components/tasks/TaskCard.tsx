import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task } from '@/api/types';
import { colors } from '@/theme/colors';

export interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const getIssueTypeColor = (type: string) => {
    switch (type) {
      case 'epic':
        return colors.issueType.epic;
      case 'story':
        return colors.issueType.story;
      case 'task':
        return colors.issueType.task;
      case 'bug':
        return colors.issueType.bug;
      default:
        return colors.textMuted;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return colors.priority.urgent;
      case 'high':
        return colors.priority.high;
      case 'medium':
        return colors.priority.medium;
      case 'low':
        return colors.priority.low;
      default:
        return colors.textMuted;
    }
  };

  const issueTypeBg = getIssueTypeColor(task.issue_type);
  const priorityColor = getPriorityColor(task.priority);

  return (
    <TouchableOpacity
      testID={`task-card-${task.id}`}
      style={styles.card}
      onPress={() => onPress?.(task)}
      activeOpacity={0.7}
    >
      {/* Header with Type, Priority, Points */}
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: `${issueTypeBg}22`, borderColor: issueTypeBg }]}>
          <Text testID="issue-type-badge" style={[styles.badgeText, { color: issueTypeBg }]}>
            {task.issue_type.toUpperCase()}
          </Text>
        </View>

        <View style={styles.metaRight}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} testID="priority-indicator" />
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {task.priority.toUpperCase()}
          </Text>

          {typeof task.story_points === 'number' && (
            <View style={styles.pointsBadge} testID="story-points-badge">
              <Text style={styles.pointsText}>{task.story_points} pts</Text>
            </View>
          )}
        </View>
      </View>

      {/* Parent Epic Label if applicable */}
      {task.parent_epic && (
        <Text style={styles.epicLabel} testID="parent-epic-label">
          ⚡ {task.parent_epic.title}
        </Text>
      )}

      {/* Title */}
      <Text style={styles.title} testID="task-title" numberOfLines={2}>
        {task.title}
      </Text>

      {/* Footer with Pomodoros & Status */}
      <View style={styles.footerRow}>
        {(task.estimated_pomodoros !== undefined || task.completed_pomodoros !== undefined) && (
          <View style={styles.pomodoroContainer} testID="pomodoro-badge">
            <Text style={styles.pomodoroText}>
              🍅 {task.completed_pomodoros || 0}/{task.estimated_pomodoros || 0}
            </Text>
          </View>
        )}

        <View style={styles.statusBadge} testID="status-badge">
          <Text style={styles.statusText}>{task.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pointsText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  epicLabel: {
    fontSize: 11,
    color: colors.issueType.epic,
    marginBottom: 4,
    fontWeight: '500',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pomodoroContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pomodoroText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
