import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Task, Sprint } from '@/api/types';
import { TaskCard } from './TaskCard';
import { calculateSprintStats } from '@/utils/sprintStats';
import { colors } from '@/theme/colors';

export interface SprintBoardProps {
  sprint: Sprint;
  tasks: Task[];
  onTaskPress?: (task: Task) => void;
}

export const SprintBoard: React.FC<SprintBoardProps> = ({ sprint, tasks, onTaskPress }) => {
  // CRITICAL: Filter out Epics strictly from execution board
  const sprintTasks = tasks.filter((t) => t.issue_type !== 'epic');
  const stats = calculateSprintStats(tasks);

  const todoTasks = sprintTasks.filter((t) => t.status === 'todo' || t.status === 'blocked');
  const inProgressTasks = sprintTasks.filter((t) => t.status === 'in_progress');
  const reviewTasks = sprintTasks.filter((t) => t.status === 'review');
  const doneTasks = sprintTasks.filter((t) => t.status === 'done');

  return (
    <View style={styles.container} testID="sprint-board">
      {/* Sprint Header with Story Point Rollup */}
      <View style={styles.header} testID="sprint-header">
        <Text style={styles.sprintTitle}>{sprint.name}</Text>
        {sprint.goal && <Text style={styles.sprintGoal}>{sprint.goal}</Text>}

        {/* Stats Rollup Cards */}
        <View style={styles.statsRow} testID="sprint-stats-row">
          <View style={styles.statBox} testID="total-points-box">
            <Text style={styles.statNumber} testID="total-points-val">
              {stats.totalPoints}
            </Text>
            <Text style={styles.statLabel}>Total Pts</Text>
          </View>
          <View style={styles.statBox} testID="done-points-box">
            <Text style={[styles.statNumber, { color: colors.status.done }]} testID="done-points-val">
              {stats.donePoints}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statBox} testID="in-progress-points-box">
            <Text style={[styles.statNumber, { color: colors.status.in_progress }]} testID="in-progress-points-val">
              {stats.inProgressPoints}
            </Text>
            <Text style={styles.statLabel}>In Prog</Text>
          </View>
          <View style={styles.statBox} testID="todo-points-box">
            <Text style={[styles.statNumber, { color: colors.status.todo }]} testID="todo-points-val">
              {stats.todoPoints}
            </Text>
            <Text style={styles.statLabel}>Todo</Text>
          </View>
        </View>
      </View>

      {/* Kanban Columns */}
      <ScrollView horizontal style={styles.boardScroll} showsHorizontalScrollIndicator={false}>
        {/* TODO COLUMN */}
        <View style={styles.column} testID="column-todo">
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>TODO ({todoTasks.length})</Text>
          </View>
          <ScrollView style={styles.columnBody}>
            {todoTasks.map((t) => (
              <TaskCard key={t.id} task={t} onPress={onTaskPress} />
            ))}
          </ScrollView>
        </View>

        {/* IN PROGRESS COLUMN */}
        <View style={styles.column} testID="column-in-progress">
          <View style={styles.columnHeader}>
            <Text style={[styles.columnTitle, { color: colors.status.in_progress }]}>
              IN PROGRESS ({inProgressTasks.length})
            </Text>
          </View>
          <ScrollView style={styles.columnBody}>
            {inProgressTasks.map((t) => (
              <TaskCard key={t.id} task={t} onPress={onTaskPress} />
            ))}
          </ScrollView>
        </View>

        {/* REVIEW COLUMN */}
        <View style={styles.column} testID="column-review">
          <View style={styles.columnHeader}>
            <Text style={[styles.columnTitle, { color: colors.status.review }]}>
              REVIEW ({reviewTasks.length})
            </Text>
          </View>
          <ScrollView style={styles.columnBody}>
            {reviewTasks.map((t) => (
              <TaskCard key={t.id} task={t} onPress={onTaskPress} />
            ))}
          </ScrollView>
        </View>

        {/* DONE COLUMN */}
        <View style={styles.column} testID="column-done">
          <View style={styles.columnHeader}>
            <Text style={[styles.columnTitle, { color: colors.status.done }]}>
              DONE ({doneTasks.length})
            </Text>
          </View>
          <ScrollView style={styles.columnBody}>
            {doneTasks.map((t) => (
              <TaskCard key={t.id} task={t} onPress={onTaskPress} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sprintTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sprintGoal: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
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
  boardScroll: {
    flex: 1,
    padding: 12,
  },
  column: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
    maxHeight: '100%',
  },
  columnHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  columnBody: {
    padding: 8,
    flex: 1,
  },
});
