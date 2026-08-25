import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FolderKanban, CheckCircle2, Clock } from 'lucide-react-native';
import { Project } from '@/api/types';
import { colors } from '@/theme/colors';

export interface ProjectCardProps {
  project: Project;
  onPress?: (project: Project) => void;
  isSelected?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress, isSelected }) => {
  const accentColor = project.color || colors.phantom.cyan;
  const projectTitle = project.title || project.name || 'Untitled Project';
  const isArchived = project.status === 'archived';

  return (
    <TouchableOpacity
      testID={`project-card-${project.id}`}
      style={[
        styles.card,
        { borderLeftColor: accentColor, borderLeftWidth: 4 },
        isSelected && styles.selectedCard,
      ]}
      onPress={() => onPress?.(project)}
      activeOpacity={0.7}
    >
      {/* Header with Title and Key */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <FolderKanban size={16} color={accentColor} />
          <Text style={styles.title} testID="project-title" numberOfLines={1}>
            {projectTitle}
          </Text>
        </View>
        {project.key && (
          <View style={styles.keyBadge} testID="project-key">
            <Text style={styles.keyText}>{project.key}</Text>
          </View>
        )}
      </View>

      {/* Description if present */}
      {project.description && (
        <Text style={styles.description} numberOfLines={2}>
          {project.description}
        </Text>
      )}

      {/* Footer with Category, Status, Tasks Count */}
      <View style={styles.footerRow}>
        <View style={styles.tagsRow}>
          {project.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{project.category}</Text>
            </View>
          )}

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isArchived ? 'rgba(100, 116, 139, 0.2)' : 'rgba(0, 245, 160, 0.15)' },
            ]}
            testID="project-status-badge"
          >
            {isArchived ? (
              <Clock size={10} color={colors.textMuted} />
            ) : (
              <CheckCircle2 size={10} color={colors.phantom.mint} />
            )}
            <Text
              style={[
                styles.statusText,
                { color: isArchived ? colors.textMuted : colors.phantom.mint },
              ]}
            >
              {isArchived ? 'ARCHIVED' : 'ACTIVE'}
            </Text>
          </View>
        </View>

        {typeof project.tasks_count === 'number' && (
          <Text style={styles.taskCount} testID="project-task-count">
            {`${project.tasks_count} ${project.tasks_count === 1 ? 'task' : 'tasks'}`}
          </Text>
        )}
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
  selectedCard: {
    borderColor: colors.phantom.cyan,
    backgroundColor: 'rgba(0, 245, 212, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  keyBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keyText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  taskCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
