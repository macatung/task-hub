import { describe, expect, it } from 'vitest';
import welcomeSource from '../../../views/WelcomePairingView.vue?raw';
import sidebarSource from '../SimpleSidebar.vue?raw';
import taskListSource from '../SimpleTaskList.vue?raw';
import taskDetailSource from '../SimpleTaskDetail.vue?raw';
import aiAssistantSource from '../SimpleAiAssistant.vue?raw';
import miniWidgetSource from '../MiniFloatWidget.vue?raw';
import settingsModalSource from '../SimpleSettingsModal.vue?raw';
import simpleTaskHubViewSource from '../../../views/SimpleTaskHubView.vue?raw';
import appSource from '../../../App.vue?raw';
import preloadSource from '../../../../electron/preload.ts?raw';
import mainSource from '../../../../electron/main.ts?raw';

describe('Simple Mode Architecture for Non-Technical Office Users', () => {
  it('WelcomePairingView provides warm onboarding and single-click cloud pairing', () => {
    expect(welcomeSource).toContain('Chào mừng đến với');
    expect(welcomeSource).toContain('Task Hub');
    expect(welcomeSource).toContain('Ghi việc dễ dàng');
    expect(welcomeSource).toContain('Trợ lý AI 1-Click');
    expect(welcomeSource).toContain('Đồng bộ tự động');
    expect(welcomeSource).toContain('startPairing');
    expect(welcomeSource).toContain('skip-offline');
  });

  it('SimpleSidebar provides smart lists, project grouping, and clear mode switching', () => {
    expect(sidebarSource).toContain('Hôm nay');
    expect(sidebarSource).toContain('Quan trọng');
    expect(sidebarSource).toContain('Có kế hoạch');
    expect(sidebarSource).toContain('Tất cả việc');
    expect(sidebarSource).toContain('Đã xong');
    expect(sidebarSource).toContain('Đổi sang Dev');
    expect(sidebarSource).toContain('Cài đặt');
  });

  it('SimpleTaskList provides clean To-Do checklist and quick task creation without technical jargon', () => {
    expect(taskListSource).toContain('Thêm việc cần làm');
    expect(taskListSource).toContain('Khẩn cấp');
    expect(taskListSource).toContain('Ưu tiên: Cao');
    expect(taskListSource).toContain('Ưu tiên: Vừa');
    expect(taskListSource).toContain('Hôm nay');
    expect(taskListSource).toContain('isOverdue');
    // Ensure no intimidating geeky jargon is shown in the simple task list
    expect(taskListSource).not.toContain('daemon');
    expect(taskListSource).not.toContain('worktree');
    expect(taskListSource).not.toContain('node-pty');
  });

  it('SimpleTaskDetail provides subtask checklist with markdown sync and quick dates', () => {
    expect(taskDetailSource).toContain('parseSubtasks');
    expect(taskDetailSource).toContain('syncSubtasksToDescription');
    expect(taskDetailSource).toContain('Hôm nay');
    expect(taskDetailSource).toContain('Ngày mai');
    expect(taskDetailSource).toContain('Tuần sau');
    expect(taskDetailSource).toContain('Chia nhỏ');
    expect(taskDetailSource).toContain('Tóm tắt');
  });

  it('SimpleAiAssistant provides 1-click action chips and apply-to-checklist capability', () => {
    expect(aiAssistantSource).toContain('Trợ lý AI Task Hub');
    expect(aiAssistantSource).toContain('Chia nhỏ việc');
    expect(aiAssistantSource).toContain('Tóm tắt');
    expect(aiAssistantSource).toContain('Gợi ý ưu tiên');
    expect(aiAssistantSource).toContain('Soạn email');
    expect(aiAssistantSource).toContain('Áp dụng vào checklist');
    expect(aiAssistantSource).toContain('apply-subtasks');
  });

  it('MiniFloatWidget provides compact always-on-top desktop bar', () => {
    expect(miniWidgetSource).toContain('Việc đang làm');
    expect(miniWidgetSource).toContain('Ghim nổi trên cùng');
    expect(miniWidgetSource).toContain('Mở rộng cửa sổ');
    expect(miniWidgetSource).toContain('toggle-pin');
    expect(miniWidgetSource).toContain('restore-window');
  });

  it('SimpleSettingsModal allows effortless switching between Office and Developer modes', () => {
    expect(settingsModalSource).toContain('Giao diện Văn phòng');
    expect(settingsModalSource).toContain('Chế độ Kỹ thuật (Dev)');
    expect(settingsModalSource).toContain('Ctrl + Shift + T');
    expect(settingsModalSource).toContain('Ngắt kết nối');
    expect(settingsModalSource).toContain('switch-mode');
  });

  it('SimpleTaskHubView coordinates navigation, task details, AI drawer, and mini mode', () => {
    expect(simpleTaskHubViewSource).toContain('<SimpleSidebar');
    expect(simpleTaskHubViewSource).toContain('<SimpleTaskList');
    expect(simpleTaskHubViewSource).toContain('<SimpleTaskDetail');
    expect(simpleTaskHubViewSource).toContain('<SimpleAiAssistant');
    expect(simpleTaskHubViewSource).toContain('<MiniFloatWidget');
    expect(simpleTaskHubViewSource).toContain('toggleMiniMode');
  });

  it('App.vue defaults to Simple Mode while preserving full Developer Mode access', () => {
    expect(appSource).toContain("appMode = ref<'simple' | 'developer'>");
    expect(appSource).toContain('SimpleTaskHubView');
    expect(appSource).toContain('ControlCenter');
    expect(appSource).toContain('WelcomePairingView');
    expect(appSource).toContain('Giao diện Văn phòng');
  });

  it('Electron native layer exposes Windows notifications and global shortcut', () => {
    expect(preloadSource).toContain('showNotification: (title: string, body: string)');
    expect(mainSource).toContain("ipcMain.handle('app-show-notification'");
    expect(mainSource).toContain("CommandOrControl+Shift+T");
    expect(mainSource).toContain("globalShortcut.unregisterAll()");
    expect(mainSource).toContain("ipcMain.handle('window-toggle-maximize'");
  });

  it('SimpleTaskHubView provides standard Windows caption controls with red close hover and drag-region', () => {
    expect(simpleTaskHubViewSource).toContain('minimizeWindow');
    expect(simpleTaskHubViewSource).toContain('toggleMaximize');
    expect(simpleTaskHubViewSource).toContain('closeWindow');
    expect(simpleTaskHubViewSource).toContain('codicon-chrome-minimize');
    expect(simpleTaskHubViewSource).toContain('codicon-chrome-maximize');
    expect(simpleTaskHubViewSource).toContain('codicon-chrome-close');
    expect(simpleTaskHubViewSource).toContain('drag-region');
    expect(simpleTaskHubViewSource).toContain('no-drag');
    expect(simpleTaskHubViewSource).toContain('hover:bg-[#e81123]');
  });
});
