import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronDown, ChevronRight, Crown, CheckCircle2, Circle, Clock } from 'lucide-react-native';
import { Task } from '@/api/types';
import { colors } from '@/theme/colors';

export interface EpicHierarchyProps {
  epics: Task[];
  allTasks: Task[];
  onTaskPress?: (task: Task) => void;
  onToggleStatus?: (task: Task) => void;
}

export const EpicHierarchy: React.FC<EpicHierarchyProps> = ({
  epics,
  allTasks,
  onTaskPress,
  onToggleStatus,
}) => {
  const [expandedEpics, setExpandedEpics] = useState<Record<number, boolean>>({});

  const toggleEpic = (epicId: number) => {
    setExpandedEpics((prev) => ({
      ...prev,
      [epicId]: !prev[epicId],
    }));
  };

  // Group child tasks by epic_id
  const getChildTasks = (epicId: number) => {
    return allTasks.filter((t) => t.epic_id === epicId && t.issue_type !== 'epic');
  };

  // Standalone tasks with no epic
  const standaloneTasks = allTasks.filter(
    (t) => (t.epic_id === null || t.epic_id === undefined) && t.issue_type !== 'epic'
  );

  return (
    <ScrollView style={styles.container} testID="epic-hierarchy-container">
      {epics.length === 0 && standaloneTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No epics or tasks found in this project.</Text>
        </View>
      ) : null}

      {/* Epics List */}
      {epics.map((epic) => {
        const isExpanded = !!expandedEpics[epic.id];
        const children = getChildTasks(epic.id);
        const totalPoints = children.reduce((sum, t) => sum + (t.story_points || 0), 0);
        const donePoints = children
          .filter((t) => t.status === 'done')
          .reduce((sum, t) => sum + (t.story_points || 0), 0);
        const progressPct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
        const doneCount = children.filter((t) => t.status === 'done').length;

        return (
          <View key={epic.id} style={styles.epicCard} testID={`epic-card-${epic.id}`}>
            {/* Epic Header */}
            <TouchableOpacity
              style={styles.epicHeader}
              onPress={() => toggleEpic(epic.id)}
              testID={`epic-toggle-btn-${epic.id}`}
              activeOpacity={0.7}
            >
              <View style={styles.epicHeaderLeft}>
                <View style={styles.epicIconBadge}>
                  <Crown size={14} color={colors.issueType.epic} />
                </View>
                <View style={styles.epicTitleBlock}>
                  <View style={styles.epicKeyRow}>
                    <Text style={styles.epicKeyText}>{epic.issue_key || `#${epic.id}`}</Text>
                    <View style={styles.epicPointsBadge}>
                      <Text style={styles.epicPointsText}>
                        {donePoints}/{totalPoints} pts
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.epicTitle} numberOfLines={2}>
                    {epic.title}
                  </Text>
                </View>
              </View>
              <View style={styles.epicHeaderRight}>
                <Text style={styles.childCountText}>
                  {doneCount}/{children.length}
                </Text>
                {isExpanded ? (
                  <ChevronDown size={18} color={colors.textSecondary} />
                ) : (
                  <ChevronRight size={18} color={colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Progress Bar */}
            <View style={styles.progressBarBg} testID={`epic-progress-bar-${epic.id}`}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>

            {/* Expanded Child Tasks */}
            {isExpanded && (
              <View style={styles.childList} testID={`epic-child-list-${epic.id}`}>
                {children.length === 0 ? (
                  <Text style={styles.noChildrenText}>No child stories or tasks under this epic.</Text>
                ) : (
                  children.map((child) => {
                    const isDone = child.status === 'done';
                    return (
                      <View key={child.id} style={styles.childItem}>
                        <TouchableOpacity
                          style={styles.statusToggleBtn}
                          onPress={() => onToggleStatus?.(child)}
                        >
                          {isDone ? (
                            <CheckCircle2 size={16} color={colors.status.done} />
                          ) : child.status === 'in_progress' ? (
                            <Clock size={16} color={colors.status.in_progress} />
                          ) : (
                            <Circle size={16} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.childContent}
                          onPress={() => onTaskPress?.(child)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.childMetaRow}>
                            <View
                              style={[
                                styles.childTypePill,
                                {
                                  backgroundColor: `${
                                    colors.issueType[child.issue_type] || colors.textMuted
                                  }22`,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.childTypeText,
                                  {
                                    color:
                                      colors.issueType[child.issue_type] || colors.textMuted,
                                  },
                                ]}
                              >
                                {child.issue_type.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.childKeyText}>
                              {child.issue_key || `#${child.id}`}
                            </Text>
                            {child.story_points !== undefined && child.story_points !== null && (
                              <Text style={styles.childPointsText}>{child.story_points} pts</Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.childTitle,
                              isDone && styles.childTitleDone,
                            ]}
                            numberOfLines={2}
                          >
                            {child.title}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Standalone Work Items */}
      {standaloneTasks.length > 0 && (
        <View style={styles.standaloneContainer}>
          <Text style={styles.standaloneSectionTitle}>
            Standalone Tasks ({standaloneTasks.length})
          </Text>
          {standaloneTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              testID={`standalone-task-${task.id}`}
              style={styles.standaloneItem}
              onPress={() => onTaskPress?.(task)}
              activeOpacity={0.7}
            >
              <View style={styles.standaloneHeader}>
                <Text style={styles.childKeyText}>{task.issue_key || `#${task.id}`}</Text>
                <Text style={styles.childPointsText}>{task.story_points || 0} pts</Text>
              </View>
              <Text style={styles.standaloneTitle} numberOfLines={2}>
                {task.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  epicCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  epicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  epicHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  epicIconBadge: {
    backgroundColor: 'rgba(157, 78, 221, 0.15)',
    padding: 6,
    borderRadius: 6,
    marginTop: 2,
  },
  epicTitleBlock: {
    flex: 1,
  },
  epicKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  epicKeyText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.issueType.epic,
    fontFamily: 'Courier',
  },
  epicPointsBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  epicPointsText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  epicTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  epicHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  childCountText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: colors.surfaceHighlight,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.phantom.mint,
  },
  childList: {
    backgroundColor: colors.surface,
    padding: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  noChildrenText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    padding: 8,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  statusToggleBtn: {
    padding: 4,
  },
  childContent: {
    flex: 1,
  },
  childMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  childTypePill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  childTypeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  childKeyText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  childPointsText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  childTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  childTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  standaloneContainer: {
    marginTop: 12,
    marginBottom: 24,
  },
  standaloneSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  standaloneItem: {
    backgroundColor: colors.surfaceCard,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  standaloneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  standaloneTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
