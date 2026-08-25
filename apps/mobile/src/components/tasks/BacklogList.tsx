import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import { Search, ArrowUpRight, Plus, Inbox } from 'lucide-react-native';
import { Task } from '@/api/types';
import { colors } from '@/theme/colors';

export interface BacklogListProps {
  tasks: Task[];
  activeSprintId?: number;
  onTaskPress?: (task: Task) => void;
  onMoveToSprint?: (taskIds: number[], sprintId: number) => void;
  onNewTask?: () => void;
}

export const BacklogList: React.FC<BacklogListProps> = ({
  tasks,
  activeSprintId,
  onTaskPress,
  onMoveToSprint,
  onNewTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tasks strictly excluding epics from backlog execution items
  const nonEpicTasks = tasks.filter((t) => t.issue_type !== 'epic');
  const filteredTasks = nonEpicTasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.issue_key && t.issue_key.toLowerCase().includes(q))
    );
  });

  const totalPoints = filteredTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

  return (
    <View style={styles.container} testID="backlog-list-container">
      {/* Search & Stats Bar */}
      <View style={styles.headerBar}>
        <View style={styles.searchBox}>
          <Search size={14} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search backlog tasks..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.statsBadge}>
          <Text style={styles.statsText}>
            {filteredTasks.length} items · {totalPoints} pts
          </Text>
        </View>
      </View>

      {/* Tasks FlatList */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Inbox size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Backlog is empty</Text>
            <Text style={styles.emptySubtitle}>All items are assigned to sprints or done.</Text>
            {onNewTask && (
              <TouchableOpacity
                testID="empty-create-task-btn"
                style={styles.emptyNewBtn}
                onPress={onNewTask}
              >
                <Plus size={14} color={colors.midnight[950]} />
                <Text style={styles.emptyNewBtnText}>Create Backlog Task</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`backlog-item-${item.id}`}
            style={styles.taskItem}
            onPress={() => onTaskPress?.(item)}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={styles.itemMetaRow}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: `${
                        colors.issueType[item.issue_type] || colors.textMuted
                      }22`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      { color: colors.issueType[item.issue_type] || colors.textMuted },
                    ]}
                  >
                    {item.issue_type.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.keyText}>{item.issue_key || `#${item.id}`}</Text>
                {typeof item.story_points === 'number' && (
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>{item.story_points} pts</Text>
                  </View>
                )}
                {item.parent_epic && (
                  <Text style={styles.epicBadge} numberOfLines={1}>
                    ⚡ {item.parent_epic.title}
                  </Text>
                )}
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </View>

            {/* Quick Action: Move to Active Sprint */}
            {activeSprintId && (
              <TouchableOpacity
                testID={`move-to-sprint-btn-${item.id}`}
                style={styles.moveBtn}
                onPress={() => onMoveToSprint?.([item.id], activeSprintId)}
              >
                <ArrowUpRight size={14} color={colors.phantom.cyan} />
                <Text style={styles.moveBtnText}>Sprint</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.midnight[950],
    borderRadius: 6,
    paddingHorizontal: 10,
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
  statsBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  listContent: {
    padding: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyNewBtn: {
    backgroundColor: colors.phantom.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
    gap: 4,
  },
  emptyNewBtnText: {
    color: colors.midnight[950],
    fontSize: 12,
    fontWeight: '700',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceCard,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  itemLeft: {
    flex: 1,
    marginRight: 8,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  keyText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  pointsBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pointsText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  epicBadge: {
    fontSize: 10,
    color: colors.issueType.epic,
    maxWidth: 120,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    borderWidth: 1,
    borderColor: colors.phantom.cyan,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  moveBtnText: {
    color: colors.phantom.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
});
