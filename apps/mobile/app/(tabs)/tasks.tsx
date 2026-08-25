import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useCurrentWorkspace } from '@/api/useWorkspaces';
import { useProjects } from '@/api/useProjects';
import { useTasks, useEpics, useBacklogTasks, useToggleTaskStatus } from '@/api/useTasks';
import { useActiveSprint, useMoveTasks } from '@/api/useSprints';
import { TaskCard } from '@/components/tasks/TaskCard';
import { EpicHierarchy } from '@/components/tasks/EpicHierarchy';
import { BacklogList } from '@/components/tasks/BacklogList';
import { colors } from '@/theme/colors';

type ViewMode = 'all' | 'hierarchy' | 'backlog';

export default function TasksScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { currentWorkspace } = useCurrentWorkspace();
  const { data: projects } = useProjects(currentWorkspace?.id);
  const activeProjectId = projects && projects.length > 0 ? projects[0].id : undefined;

  const { activeSprint } = useActiveSprint(activeProjectId);
  const { data: allTasks, isLoading } = useTasks({ workspace_id: currentWorkspace?.id });
  const { data: epics } = useEpics(activeProjectId);
  const { data: backlogTasks } = useBacklogTasks(activeProjectId);

  const { toggleStatus } = useToggleTaskStatus();
  const moveTasks = useMoveTasks();

  const filteredTasks = (allTasks || []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.issue_key && t.issue_key.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Task Explorer</Text>
          <Text style={styles.headerSubtitle}>Hierarchy & Backlog</Text>
        </View>
        <TouchableOpacity
          style={styles.newTaskBtn}
          onPress={() => router.push('/tasks/new')}
          activeOpacity={0.7}
        >
          <Plus size={16} color={colors.midnight[950]} />
          <Text style={styles.newTaskBtnText}>New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented View Mode Tabs */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          testID="segment-btn-all"
          style={[styles.segmentBtn, viewMode === 'all' && styles.segmentBtnActive]}
          onPress={() => setViewMode('all')}
        >
          <Text style={[styles.segmentText, viewMode === 'all' && styles.segmentTextActive]}>
            All Tasks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="segment-btn-hierarchy"
          style={[styles.segmentBtn, viewMode === 'hierarchy' && styles.segmentBtnActive]}
          onPress={() => setViewMode('hierarchy')}
        >
          <Text style={[styles.segmentText, viewMode === 'hierarchy' && styles.segmentTextActive]}>
            Epic Tree
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="segment-btn-backlog"
          style={[styles.segmentBtn, viewMode === 'backlog' && styles.segmentBtnActive]}
          onPress={() => setViewMode('backlog')}
        >
          <Text style={[styles.segmentText, viewMode === 'backlog' && styles.segmentTextActive]}>
            Backlog
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content View */}
      {viewMode === 'all' && (
        <View style={styles.contentArea}>
          <View style={styles.searchBar}>
            <Search size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter tasks..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.phantom.cyan} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={filteredTasks}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  onPress={(t) => router.push(`/tasks/${t.id}` as any)}
                />
              )}
            />
          )}
        </View>
      )}

      {viewMode === 'hierarchy' && (
        <EpicHierarchy
          epics={epics || []}
          allTasks={allTasks || []}
          onTaskPress={(t) => router.push(`/tasks/${t.id}` as any)}
          onToggleStatus={(t) => toggleStatus(t)}
        />
      )}

      {viewMode === 'backlog' && (
        <BacklogList
          tasks={backlogTasks || []}
          activeSprintId={activeSprint?.id}
          onTaskPress={(t) => router.push(`/tasks/${t.id}` as any)}
          onMoveToSprint={(ids, spId) => moveTasks.mutate({ task_ids: ids, sprint_id: spId })}
          onNewTask={() => router.push('/tasks/new')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.midnight[950],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  newTaskBtn: {
    backgroundColor: colors.phantom.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  newTaskBtnText: {
    color: colors.midnight[950],
    fontSize: 12,
    fontWeight: '700',
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 6,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.surfaceHighlight,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.phantom.cyan,
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    margin: 12,
    marginBottom: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 6,
  },
});
