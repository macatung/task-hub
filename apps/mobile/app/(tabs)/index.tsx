import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  QrCode,
  Plus,
  ShieldCheck,
  ChevronRight,
  Bot,
  Inbox,
} from 'lucide-react-native';
import { useCurrentWorkspace } from '@/api/useWorkspaces';
import { useProjects } from '@/api/useProjects';
import { useActiveSprint } from '@/api/useSprints';
import { useSprintTasks, useTasks } from '@/api/useTasks';
import { WorkspaceSelector } from '@/components/workspaces/WorkspaceSelector';
import { ProjectCard } from '@/components/workspaces/ProjectCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { calculateSprintStats } from '@/utils/sprintStats';
import { colors } from '@/theme/colors';

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { currentWorkspace, refetch: refetchWs } = useCurrentWorkspace();
  const { data: projects, isLoading: projLoading, refetch: refetchProj } = useProjects(currentWorkspace?.id);
  
  const activeProjectId = projects && projects.length > 0 ? projects[0].id : undefined;
  const { activeSprint, refetch: refetchSprint } = useActiveSprint(activeProjectId);
  const { data: sprintTasks, refetch: refetchTasks } = useSprintTasks(activeProjectId, activeSprint?.id);
  const { data: urgentTasks } = useTasks({
    workspace_id: currentWorkspace?.id,
    priority: 'urgent',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWs(), refetchProj(), refetchSprint(), refetchTasks()]);
    setRefreshing(false);
  };

  const sprintStats = calculateSprintStats(sprintTasks || []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.phantom.cyan} />}
    >
      {/* Top App Bar with Workspace Switcher & QR Pair Shortcut */}
      <View style={styles.topBar}>
        <WorkspaceSelector />
        <TouchableOpacity
          style={styles.qrBtn}
          onPress={() => router.push('/scanner' as any)}
          activeOpacity={0.7}
        >
          <QrCode size={18} color={colors.phantom.cyan} />
        </TouchableOpacity>
      </View>

      {/* Active Sprint Summary Card */}
      <View style={styles.sprintCard}>
        <View style={styles.sprintHeader}>
          <View>
            <View style={styles.sprintBadgeRow}>
              <ShieldCheck size={14} color={colors.phantom.mint} />
              <Text style={styles.sprintBadgeText}>ACTIVE SPRINT</Text>
            </View>
            <Text style={styles.sprintTitle}>
              {activeSprint ? activeSprint.name : 'No Active Sprint'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.sprintActionBtn}
            onPress={() => router.push('/(tabs)/sprints')}
          >
            <Text style={styles.sprintActionText}>Board</Text>
            <ChevronRight size={14} color={colors.phantom.cyan} />
          </TouchableOpacity>
        </View>

        {activeSprint ? (
          <>
            {activeSprint.goal && <Text style={styles.sprintGoal}>{activeSprint.goal}</Text>}

            {/* Non-Epic Story Point Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Story Point Completion</Text>
                <Text style={styles.progressVal}>
                  {sprintStats.donePoints} / {sprintStats.totalPoints} pts ({sprintStats.completionPercentage}%)
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${sprintStats.completionPercentage}%` },
                  ]}
                />
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.noSprintText}>
            Select or start a sprint to track burndown and progress.
          </Text>
        )}
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push('/tasks/new')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 245, 212, 0.15)' }]}>
            <Plus size={18} color={colors.phantom.cyan} />
          </View>
          <Text style={styles.quickActionLabel}>New Task</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push('/(tabs)/tasks')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 187, 249, 0.15)' }]}>
            <Inbox size={18} color={colors.phantom.blue} />
          </View>
          <Text style={styles.quickActionLabel}>Backlog</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => router.push('/(tabs)/telemetry')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(157, 78, 221, 0.15)' }]}>
            <Bot size={18} color={colors.phantom.purple} />
          </View>
          <Text style={styles.quickActionLabel}>Telemetry</Text>
        </TouchableOpacity>
      </View>

      {/* Projects Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projects ({projects?.length || 0})</Text>
      </View>

      {projLoading ? (
        <ActivityIndicator color={colors.phantom.cyan} style={{ marginVertical: 16 }} />
      ) : (
        (projects || []).map((proj) => (
          <ProjectCard
            key={proj.id}
            project={proj}
            onPress={() => router.push('/(tabs)/tasks')}
          />
        ))
      )}

      {/* Urgent Tasks Section */}
      {urgentTasks && urgentTasks.length > 0 && (
        <View style={styles.urgentSection}>
          <Text style={styles.sectionTitle}>Urgent Items ({urgentTasks.length})</Text>
          {urgentTasks.slice(0, 3).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={(t) => router.push(`/tasks/${t.id}` as any)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight[950],
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrBtn: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    borderRadius: 8,
  },
  sprintCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sprintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sprintBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  sprintBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.phantom.mint,
    letterSpacing: 0.5,
  },
  sprintTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sprintGoal: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  sprintActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  sprintActionText: {
    color: colors.phantom.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.phantom.mint,
  },
  noSprintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    padding: 8,
    borderRadius: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urgentSection: {
    marginTop: 12,
    marginBottom: 32,
  },
});
