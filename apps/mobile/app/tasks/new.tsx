import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, Check } from 'lucide-react-native';
import { useCreateTask, useEpics } from '@/api/useTasks';
import { useCurrentWorkspace } from '@/api/useWorkspaces';
import { useProjects } from '@/api/useProjects';
import { useSprints } from '@/api/useSprints';
import { IssueType, Priority } from '@/api/types';
import { colors } from '@/theme/colors';

const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21];

export default function NewTaskModal() {
  const router = useRouter();
  const createTask = useCreateTask();
  const { currentWorkspace } = useCurrentWorkspace();
  const { data: projects } = useProjects(currentWorkspace?.id);

  const [selectedProjectId] = useState<number | null>(null);
  const activeProjectId = selectedProjectId || (projects && projects.length > 0 ? projects[0].id : 1);

  const { data: sprints } = useSprints(activeProjectId);
  const { data: epics } = useEpics(activeProjectId);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('story');
  const [priority, setPriority] = useState<Priority>('medium');
  const [storyPoints, setStoryPoints] = useState<number | null>(3);
  const [sprintId, setSprintId] = useState<number | null>(null);
  const [epicId, setEpicId] = useState<number | null>(null);
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(2);
  const [category] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleIssueTypeChange = (type: IssueType) => {
    setIssueType(type);
    if (type === 'epic') {
      // Invariant: Epics must NEVER have sprint_id assigned directly
      setSprintId(null);
      setEpicId(null);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Task title is required.');
      return;
    }

    setErrorMessage(null);

    try {
      await createTask.mutateAsync({
        workspace_id: currentWorkspace?.id || 1,
        project_id: activeProjectId,
        title: trimmedTitle,
        description: description.trim() || undefined,
        issue_type: issueType,
        priority,
        story_points: storyPoints,
        sprint_id: issueType === 'epic' ? null : sprintId,
        epic_id: issueType === 'epic' ? null : epicId,
        estimated_pomodoros: estimatedPomodoros,
        category: category.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create work item.');
    }
  };

  return (
    <View style={styles.container} testID="new-task-form">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Work Item</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} testID="cancel-task-btn">
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.formScroll}>
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Issue Type Selector */}
        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.typeSelectorRow} testID="select-issue-type">
          {(['story', 'task', 'bug', 'epic'] as IssueType[]).map((type) => {
            const isSelected = issueType === type;
            const typeColor = colors.issueType[type];
            return (
              <TouchableOpacity
                key={type}
                testID={`issue-type-${type}`}
                style={[
                  styles.typeOption,
                  isSelected && { backgroundColor: `${typeColor}33`, borderColor: typeColor },
                ]}
                onPress={() => handleIssueTypeChange(type)}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    isSelected && { color: typeColor, fontWeight: '700' },
                  ]}
                >
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title Input */}
        <Text style={styles.label}>Title *</Text>
        <TextInput
          testID="input-title"
          style={styles.input}
          placeholder="What needs to be done?"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        {/* Description Input */}
        <Text style={styles.label}>Description (Markdown)</Text>
        <TextInput
          testID="input-description"
          style={[styles.input, styles.textArea]}
          placeholder="Add details, acceptance criteria, or diff snippets..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline={true}
          numberOfLines={4}
        />

        {/* Priority Selector */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.selectorRow} testID="select-priority">
          {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => {
            const isSelected = priority === p;
            const pColor = colors.priority[p];
            return (
              <TouchableOpacity
                key={p}
                testID={`priority-${p}`}
                style={[
                  styles.priorityOption,
                  isSelected && { backgroundColor: `${pColor}33`, borderColor: pColor },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={[
                    styles.priorityOptionText,
                    isSelected && { color: pColor, fontWeight: '700' },
                  ]}
                >
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Story Points Selector */}
        <Text style={styles.label}>Story Points (Fibonacci)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pointsScroll} testID="select-points">
          <TouchableOpacity
            testID="point-pill-none"
            style={[styles.pointPill, storyPoints === null && styles.pointPillSelected]}
            onPress={() => setStoryPoints(null)}
          >
            <Text style={[styles.pointPillText, storyPoints === null && styles.pointPillTextSelected]}>
              None
            </Text>
          </TouchableOpacity>
          {FIBONACCI_POINTS.map((pt) => {
            const isSelected = storyPoints === pt;
            return (
              <TouchableOpacity
                key={pt}
                testID={`point-pill-${pt}`}
                style={[styles.pointPill, isSelected && styles.pointPillSelected]}
                onPress={() => setStoryPoints(pt)}
              >
                <Text style={[styles.pointPillText, isSelected && styles.pointPillTextSelected]}>
                  {pt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sprint Picker (Disabled if Issue Type is Epic) */}
        {issueType !== 'epic' && (
          <>
            <Text style={styles.label}>Sprint Assignment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll} testID="select-sprint">
              <TouchableOpacity
                testID="sprint-pill-backlog"
                style={[styles.pickerPill, sprintId === null && styles.pickerPillSelected]}
                onPress={() => setSprintId(null)}
              >
                <Text style={[styles.pickerPillText, sprintId === null && styles.pickerPillTextSelected]}>
                  Backlog (No Sprint)
                </Text>
              </TouchableOpacity>
              {(sprints || []).map((sp) => {
                const isSelected = sprintId === sp.id;
                return (
                  <TouchableOpacity
                    key={sp.id}
                    testID={`sprint-pill-${sp.id}`}
                    style={[styles.pickerPill, isSelected && styles.pickerPillSelected]}
                    onPress={() => setSprintId(sp.id)}
                  >
                    <Text style={[styles.pickerPillText, isSelected && styles.pickerPillTextSelected]}>
                      {sp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Parent Epic Picker (Hidden if Issue Type is Epic) */}
        {issueType !== 'epic' && epics && epics.length > 0 && (
          <>
            <Text style={styles.label}>Parent Epic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll} testID="select-epic">
              <TouchableOpacity
                testID="epic-pill-none"
                style={[styles.pickerPill, epicId === null && styles.pickerPillSelected]}
                onPress={() => setEpicId(null)}
              >
                <Text style={[styles.pickerPillText, epicId === null && styles.pickerPillTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {epics.map((ep) => {
                const isSelected = epicId === ep.id;
                return (
                  <TouchableOpacity
                    key={ep.id}
                    testID={`epic-pill-${ep.id}`}
                    style={[styles.pickerPill, isSelected && styles.pickerPillSelected]}
                    onPress={() => setEpicId(ep.id)}
                  >
                    <Text style={[styles.pickerPillText, isSelected && styles.pickerPillTextSelected]}>
                      ⚡ {ep.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Estimated Pomodoros Counter */}
        <View style={styles.pomodoroRow}>
          <Text style={styles.label}>Estimated Pomodoros (🍅)</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              testID="stepper-dec-btn"
              style={styles.stepperBtn}
              onPress={() => setEstimatedPomodoros(Math.max(1, estimatedPomodoros - 1))}
            >
              <Text style={styles.stepperBtnText}>-</Text>
            </TouchableOpacity>
            <Text testID="stepper-val" style={styles.stepperVal}>{estimatedPomodoros}</Text>
            <TouchableOpacity
              testID="stepper-inc-btn"
              style={styles.stepperBtn}
              onPress={() => setEstimatedPomodoros(estimatedPomodoros + 1)}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          testID="submit-create-task-btn"
          style={[styles.submitBtn, createTask.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={createTask.isPending}
        >
          {createTask.isPending ? (
            <ActivityIndicator color={colors.midnight[950]} />
          ) : (
            <>
              <Check size={16} color={colors.midnight[950]} />
              <Text style={styles.submitBtnText}>Create Work Item</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  formScroll: {
    flex: 1,
    padding: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 35, 60, 0.15)',
    borderWidth: 1,
    borderColor: colors.status.failed,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: colors.status.failed,
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
  },
  typeOptionText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
  },
  priorityOptionText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  pointsScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pointPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  pointPillSelected: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderColor: colors.phantom.cyan,
  },
  pointPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pointPillTextSelected: {
    color: colors.phantom.cyan,
    fontWeight: '700',
  },
  pickerScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pickerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  pickerPillSelected: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderColor: colors.phantom.cyan,
  },
  pickerPillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pickerPillTextSelected: {
    color: colors.phantom.cyan,
    fontWeight: '700',
  },
  pomodoroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    backgroundColor: colors.surfaceHighlight,
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepperVal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitBtn: {
    backgroundColor: colors.phantom.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 40,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.midnight[950],
    fontSize: 14,
    fontWeight: '700',
  },
});
