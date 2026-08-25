import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Building2, Check, ChevronDown, Plus, X, Globe } from 'lucide-react-native';
import { useCurrentWorkspace, useSwitchWorkspace, useCreateWorkspace } from '@/api/useWorkspaces';
import { Workspace } from '@/api/types';
import { colors } from '@/theme/colors';

export interface WorkspaceSelectorProps {
  onWorkspaceChanged?: (workspace: Workspace) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ onWorkspaceChanged }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { workspaces, currentWorkspace, isLoading } = useCurrentWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspace = useCreateWorkspace();

  const handleSelectWorkspace = async (workspace: Workspace) => {
    if (workspace.id === currentWorkspace?.id) {
      setModalVisible(false);
      return;
    }
    await switchWorkspace.mutateAsync(workspace.id);
    onWorkspaceChanged?.(workspace);
    setModalVisible(false);
  };

  const handleCreateWorkspace = async () => {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    try {
      setIsCreating(true);
      const created = await createWorkspace.mutateAsync({ name: trimmed });
      setNewWorkspaceName('');
      if (created) {
        await switchWorkspace.mutateAsync(created.id);
        onWorkspaceChanged?.(created);
      }
      setModalVisible(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        testID="workspace-selector-trigger"
        style={styles.triggerBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Building2 size={16} color={colors.phantom.cyan} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {currentWorkspace ? currentWorkspace.name : 'Select Workspace'}
        </Text>
        <ChevronDown size={14} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Modal Dropdown Sheet */}
      <Modal
        testID="workspace-selector-modal"
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Globe size={18} color={colors.phantom.cyan} />
                <Text style={styles.modalTitle}>Workspaces</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Loading State */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.phantom.cyan} />
                <Text style={styles.loadingText}>Loading workspaces...</Text>
              </View>
            ) : (
              /* Workspaces List */
              <FlatList
                data={workspaces || []}
                keyExtractor={(item) => String(item.id)}
                style={styles.list}
                renderItem={({ item }) => {
                  const isActive = item.id === currentWorkspace?.id;
                  return (
                    <TouchableOpacity
                      testID={`workspace-item-${item.id}`}
                      style={[styles.workspaceItem, isActive && styles.activeWorkspaceItem]}
                      onPress={() => handleSelectWorkspace(item)}
                    >
                      <View style={styles.workspaceInfo}>
                        <Text style={[styles.workspaceName, isActive && styles.activeWorkspaceName]}>
                          {item.name}
                        </Text>
                        <Text style={styles.workspaceSlug}>/{item.slug}</Text>
                      </View>
                      {isActive && (
                        <View style={styles.activeBadge} testID="workspace-active-badge">
                          <Check size={14} color={colors.midnight[950]} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Create New Workspace Input */}
            <View style={styles.createContainer}>
              <TextInput
                style={styles.input}
                placeholder="New workspace name..."
                placeholderTextColor={colors.textMuted}
                value={newWorkspaceName}
                onChangeText={setNewWorkspaceName}
              />
              <TouchableOpacity
                testID="create-workspace-btn"
                style={[styles.createBtn, !newWorkspaceName.trim() && styles.disabledBtn]}
                disabled={!newWorkspaceName.trim() || isCreating}
                onPress={handleCreateWorkspace}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.midnight[950]} />
                ) : (
                  <>
                    <Plus size={14} color={colors.midnight[950]} />
                    <Text style={styles.createBtnText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    maxWidth: 200,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    maxHeight: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  list: {
    maxHeight: 240,
  },
  workspaceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeWorkspaceItem: {
    borderColor: colors.phantom.cyan,
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeWorkspaceName: {
    color: colors.phantom.cyan,
  },
  workspaceSlug: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.phantom.cyan,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.midnight[950],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontSize: 13,
  },
  createBtn: {
    backgroundColor: colors.phantom.cyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  createBtnText: {
    color: colors.midnight[950],
    fontSize: 12,
    fontWeight: '700',
  },
});
