import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useCurrentWorkspace } from '@/api/useWorkspaces';
import { useProjects } from '@/api/useProjects';
import { useActiveSprint } from '@/api/useSprints';
import { useSprintTasks } from '@/api/useTasks';
import { SprintBoard } from '@/components/tasks/SprintBoard';
import { colors } from '@/theme/colors';

export default function SprintsScreen() {
  const router = useRouter();
  const { currentWorkspace } = useCurrentWorkspace();
  const { data: projects } = useProjects(currentWorkspace?.id);
  const activeProjectId = projects && projects.length > 0 ? projects[0].id : undefined;

  const { sprints, activeSprint, isLoading: sprintsLoading } = useActiveSprint(activeProjectId);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  const currentSprint =
    (sprints || []).find((s) => s.id === (selectedSprintId || activeSprint?.id)) || activeSprint;

  const { data: sprintTasks } = useSprintTasks(
    activeProjectId,
    currentSprint?.id
  );

  if (sprintsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.phantom.cyan} />
        <Text style={styles.loadingText}>Loading sprints...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sprint Switcher Bar */}
      <View style={styles.switcherBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sprintPillScroll}>
          {(sprints || []).map((sp) => {
            const isSelected = sp.id === currentSprint?.id;
            return (
              <TouchableOpacity
                key={sp.id}
                style={[styles.sprintPill, isSelected && styles.sprintPillSelected]}
                onPress={() => setSelectedSprintId(sp.id)}
              >
                <Text style={[styles.sprintPillText, isSelected && styles.sprintPillTextSelected]}>
                  {sp.name} {sp.status === 'active' && '⚡'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Scrum Non-Epic Integrity Notice */}
      <View style={styles.integrityNotice}>
        <ShieldCheck size={14} color={colors.phantom.mint} />
        <Text style={styles.integrityNoticeText}>
          Non-Epic Scrum Invariant: Points and cards exclude parent Epics.
        </Text>
      </View>

      {/* Sprint Board */}
      {currentSprint ? (
        <View style={styles.boardContainer}>
          <SprintBoard
            sprint={currentSprint}
            tasks={sprintTasks || []}
            onTaskPress={(t) => router.push(`/tasks/${t.id}` as any)}
          />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Sprints Available</Text>
          <Text style={styles.emptySubtitle}>
            Create or start a sprint from the backlog to track work.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight[950],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.midnight[950],
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  switcherBar: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sprintPillScroll: {
    flexDirection: 'row',
  },
  sprintPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  sprintPillSelected: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderColor: colors.phantom.cyan,
  },
  sprintPillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sprintPillTextSelected: {
    color: colors.phantom.cyan,
    fontWeight: '700',
  },
  integrityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  integrityNoticeText: {
    fontSize: 10,
    color: colors.phantom.mint,
    fontWeight: '600',
  },
  boardContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
