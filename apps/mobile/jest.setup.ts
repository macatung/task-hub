import { EventEmitter } from 'events';

// ==========================================
// 1. expo-secure-store In-Memory Mock
// ==========================================
const secureStorageMap = new Map<string, string>();

const mockSecureStore = {
  __esModule: true,
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStorageMap.set(key, String(value));
  }),
  getItemAsync: jest.fn(async (key: string) => {
    return secureStorageMap.has(key) ? secureStorageMap.get(key)! : null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    secureStorageMap.delete(key);
  }),
  isAvailableAsync: jest.fn(async () => true),
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  // Helper test methods
  __resetStore: () => secureStorageMap.clear(),
  __getStore: () => new Map(secureStorageMap),
};
(mockSecureStore as any).default = mockSecureStore;

jest.mock('expo-secure-store', () => mockSecureStore);

// ==========================================
// 2. expo-local-authentication Mock
// ==========================================
let mockLocalAuthResult = { success: true };
let mockHardwareAvailable = true;
let mockEnrolled = true;
let mockSupportedAuthTypes = [1, 2];

const mockLocalAuthentication = {
  __esModule: true,
  hasHardwareAsync: jest.fn(async () => mockHardwareAvailable),
  isEnrolledAsync: jest.fn(async () => mockEnrolled),
  supportedAuthenticationTypesAsync: jest.fn(async () => mockSupportedAuthTypes),
  authenticateAsync: jest.fn(async (_options?: any) => {
    return mockLocalAuthResult;
  }),
  cancelAuthenticate: jest.fn(async () => {}),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC: 2,
  },
  // Helpers
  __setMockResult: (result: { success: boolean; error?: string; warning?: string }) => {
    mockLocalAuthResult = result;
  },
  __setHardwareAvailable: (available: boolean) => {
    mockHardwareAvailable = available;
  },
  __setEnrolled: (enrolled: boolean) => {
    mockEnrolled = enrolled;
  },
  __setSupportedTypes: (types: number[]) => {
    mockSupportedAuthTypes = types;
  },
  __resetMock: () => {
    mockLocalAuthResult = { success: true };
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockSupportedAuthTypes = [1, 2];
    mockLocalAuthentication.hasHardwareAsync.mockClear();
    mockLocalAuthentication.isEnrolledAsync.mockClear();
    mockLocalAuthentication.authenticateAsync.mockClear();
  },
};
(mockLocalAuthentication as any).default = mockLocalAuthentication;

jest.mock('expo-local-authentication', () => mockLocalAuthentication);

// ==========================================
// 3. expo-camera Mock
// ==========================================
let activeBarcodeCallback: ((scanningResult: { data: string; type: string }) => void) | null = null;
let mockCameraPermission = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };

const mockCameraView = jest.fn((props: any) => {
  if (props.onBarcodeScanned) {
    activeBarcodeCallback = props.onBarcodeScanned;
  }
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, { testID: props.testID || 'camera-view', ...props }, props.children);
});

const mockExpoCamera = {
  __esModule: true,
  CameraView: mockCameraView,
  CameraType: { back: 'back', front: 'front' },
  useCameraPermissions: jest.fn(() => [
    mockCameraPermission,
    jest.fn(async () => mockCameraPermission),
    jest.fn(async () => mockCameraPermission),
  ]),
  // Helpers
  __simulateBarcodeScan: (data: string, type: string = 'qr') => {
    if (activeBarcodeCallback) {
      activeBarcodeCallback({ data, type });
    }
  },
  __setPermission: (permission: typeof mockCameraPermission) => {
    mockCameraPermission = permission;
  },
  __resetMock: () => {
    activeBarcodeCallback = null;
    mockCameraPermission = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
  },
};
(mockExpoCamera as any).default = mockExpoCamera;

jest.mock('expo-camera', () => mockExpoCamera);

// ==========================================
// 4. react-native-sse (EventSource) Mock
// ==========================================
interface SSERequestOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: any;
  pollingInterval?: number;
  timeout?: number;
}

const sseInstances: MockEventSource[] = [];

class MockEventSource extends EventEmitter {
  url: string;
  options?: SSERequestOptions;
  readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSED

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string, options?: SSERequestOptions) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = MockEventSource.CONNECTING;
    // Suppress default unhandled error throwing in EventEmitter
    this.on('error', () => {});
    sseInstances.push(this);

    // Auto-open on next tick
    setTimeout(() => {
      if (this.readyState === MockEventSource.CONNECTING) {
        this.readyState = MockEventSource.OPEN;
        this.emit('open', { type: 'open' });
      }
    }, 5);
  }

  addEventListener(event: string, listener: (...args: any[]) => void) {
    this.on(event, listener);
  }

  removeEventListener(event: string, listener: (...args: any[]) => void) {
    this.off(event, listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    this.emit('close', { type: 'close' });
  }

  // Test simulation helpers
  __emitOpen() {
    this.readyState = MockEventSource.OPEN;
    this.emit('open', { type: 'open' });
  }

  __emitMessage(data: string, lastEventId?: string) {
    this.emit('message', {
      type: 'message',
      data,
      lastEventId: lastEventId || '',
    });
  }

  __emitCustomEvent(eventName: string, data: string, lastEventId?: string) {
    this.emit(eventName, {
      type: eventName,
      data,
      lastEventId: lastEventId || '',
    });
  }

  __emitError(message: string, status?: number) {
    this.emit('error', {
      type: 'error',
      message,
      xhrStatus: status || 500,
    });
  }
}

const mockReactNativeSSE = {
  __esModule: true,
  default: MockEventSource,
  EventSource: MockEventSource,
  __getInstances: () => sseInstances,
  __getLastInstance: () => sseInstances[sseInstances.length - 1],
  __resetInstances: () => {
    sseInstances.length = 0;
  },
};
(mockReactNativeSSE as any).default = MockEventSource;

jest.mock('react-native-sse', () => mockReactNativeSSE);

// ==========================================
// 5. @react-native-async-storage/async-storage Mock
// ==========================================
const asyncStorageMap = new Map<string, string>();

const mockAsyncStorage = {
  __esModule: true,
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStorageMap.set(key, String(value));
  }),
  getItem: jest.fn(async (key: string) => {
    return asyncStorageMap.has(key) ? asyncStorageMap.get(key)! : null;
  }),
  removeItem: jest.fn(async (key: string) => {
    asyncStorageMap.delete(key);
  }),
  clear: jest.fn(async () => {
    asyncStorageMap.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(asyncStorageMap.keys())),
  multiGet: jest.fn(async (keys: string[]) => {
    return keys.map((k) => [k, asyncStorageMap.has(k) ? asyncStorageMap.get(k)! : null]);
  }),
  multiSet: jest.fn(async (keyValuePairs: [string, string][]) => {
    keyValuePairs.forEach(([k, v]) => asyncStorageMap.set(k, String(v)));
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => asyncStorageMap.delete(k));
  }),
  flushGetRequests: jest.fn(),
  // Helpers
  __resetStore: () => asyncStorageMap.clear(),
  __getStore: () => new Map(asyncStorageMap),
};
(mockAsyncStorage as any).default = mockAsyncStorage;

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// ==========================================
// 6. react-native-webview Mock
// ==========================================
let activeWebViewOnMessage: ((event: { nativeEvent: { data: string } }) => void) | null = null;
const mockInjectedScripts: string[] = [];
const mockPostedMessages: string[] = [];

const MockWebView = jest.fn((props: any) => {
  if (props.onMessage) {
    activeWebViewOnMessage = props.onMessage;
  }
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(
    View,
    {
      testID: props.testID || 'mock-webview',
      accessibilityLabel: 'webview',
      ...props,
    },
    props.children
  );
});

(MockWebView as any).mockImplementation = (props: any) => {
  if (props.onMessage) {
    activeWebViewOnMessage = props.onMessage;
  }
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(
    View,
    {
      testID: props.testID || 'mock-webview',
      accessibilityLabel: 'webview',
      ...props,
    },
    props.children
  );
};

const mockWebViewModule = {
  __esModule: true,
  default: MockWebView,
  WebView: MockWebView,
  __simulateMessage: (data: string) => {
    if (activeWebViewOnMessage) {
      activeWebViewOnMessage({ nativeEvent: { data } });
    }
  },
  __getInjectedScripts: () => mockInjectedScripts,
  __getPostedMessages: () => mockPostedMessages,
  __resetMock: () => {
    activeWebViewOnMessage = null;
    mockInjectedScripts.length = 0;
    mockPostedMessages.length = 0;
  },
};
(mockWebViewModule as any).default = MockWebView;

jest.mock('react-native-webview', () => mockWebViewModule);

// ==========================================
// 7. expo-haptics & expo-router Mocks
// ==========================================
const mockHaptics = {
  __esModule: true,
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
};
(mockHaptics as any).default = mockHaptics;
jest.mock('expo-haptics', () => mockHaptics);

const mockRouter = {
  __esModule: true,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => [],
  Link: ({ children, ...props }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, props, children);
  },
  Stack: Object.assign(
    ({ children }: any) => {
      const React = require('react');
      const { View } = require('react-native');
      return React.createElement(View, null, children);
    },
    {
      Screen: () => null,
    }
  ),
  Tabs: Object.assign(
    ({ children }: any) => {
      const React = require('react');
      const { View } = require('react-native');
      return React.createElement(View, null, children);
    },
    {
      Screen: () => null,
    }
  ),
};
(mockRouter as any).default = mockRouter;
jest.mock('expo-router', () => mockRouter);

// ==========================================
// 8. lucide-react-native Mock
// ==========================================
const mockLucideProxy = new Proxy({}, {
  get: (_target, prop) => {
    const React = require('react');
    const { View } = require('react-native');
    return (props: any) => React.createElement(View, { testID: `icon-${String(prop)}`, ...props });
  },
});
jest.mock('lucide-react-native', () => mockLucideProxy);

// ==========================================
// 9. @tanstack/react-query Mock
// ==========================================
let actualQuery: any = {};
try {
  actualQuery = require('@tanstack/react-query');
} catch {}

const mockDefaultQueryClient = {
  invalidateQueries: jest.fn(),
  cancelQueries: jest.fn(),
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
  setQueriesData: jest.fn(),
  getQueriesData: jest.fn(() => []),
  removeQueries: jest.fn(),
  clear: jest.fn(),
};

const useMockQuery = (options: any) => {
  const React = require('react');
  const [data, setData] = (React.useState as any)(undefined);
  const [isLoading, setIsLoading] = (React.useState as any)(false);
  React.useEffect(() => {
    if (options?.queryFn && options?.enabled !== false) {
      setIsLoading(true);
      Promise.resolve(options.queryFn())
        .then((res: any) => {
          setData(res);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [options?.queryFn, options?.enabled]);
  return {
    data,
    isLoading,
    error: null,
    refetch: jest.fn(async () => ({ data })),
  };
};

const useMockMutation = (options: any) => {
  const React = require('react');
  const [isPending, setIsPending] = (React.useState as any)(false);
  return {
    mutate: (variables: any) => {
      if (options?.mutationFn) options.mutationFn(variables);
    },
    mutateAsync: async (variables: any) => {
      setIsPending(true);
      try {
        const res = options?.mutationFn ? await options.mutationFn(variables) : undefined;
        if (options?.onSuccess) options.onSuccess(res, variables, undefined);
        return res;
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
};

jest.mock('@tanstack/react-query', () => ({
  ...actualQuery,
  useQueryClient: () => mockDefaultQueryClient,
  useQuery: useMockQuery,
  useMutation: useMockMutation,
}));

// ==========================================
// 10. @/api/useWorkspaces Mock
// ==========================================
const mockDefaultWorkspaces = [
  { id: 1, name: 'Primary Workspace', slug: 'primary-workspace', created_at: '', updated_at: '' },
  { id: 2, name: 'Secondary Team', slug: 'secondary-team', created_at: '', updated_at: '' },
];
let mockActiveWs = mockDefaultWorkspaces[0];
const mockSwitchWsFn = jest.fn(async (id: number) => {
  mockActiveWs = mockDefaultWorkspaces.find((w) => w.id === id) || mockDefaultWorkspaces[0];
  return mockActiveWs;
});
const mockCreateWsFn = jest.fn(async ({ name }: { name: string }) => {
  const ws = { id: mockDefaultWorkspaces.length + 1, name, slug: name.toLowerCase(), created_at: '', updated_at: '' };
  mockDefaultWorkspaces.push(ws);
  return ws;
});

const mockWorkspacesApi = {
  __esModule: true,
  useWorkspaces: () => ({ data: mockDefaultWorkspaces, isLoading: false, error: null, refetch: jest.fn() }),
  useCurrentWorkspace: () => ({
    workspaces: mockDefaultWorkspaces,
    currentWorkspace: mockActiveWs,
    workspaceId: mockActiveWs.id,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateWorkspace: () => ({
    mutateAsync: mockCreateWsFn,
    isPending: false,
  }),
  useSwitchWorkspace: () => ({
    mutateAsync: mockSwitchWsFn,
    isPending: false,
  }),
  __setActiveWorkspace: (ws: any) => { mockActiveWs = ws; },
  __getWorkspacesList: () => mockDefaultWorkspaces,
  __resetWorkspacesMock: () => {
    mockActiveWs = mockDefaultWorkspaces[0];
    mockSwitchWsFn.mockClear();
    mockCreateWsFn.mockClear();
  },
};

jest.mock('@/api/useWorkspaces', () => mockWorkspacesApi);

// ==========================================
// 11. @/api/useProjects Mock
// ==========================================
const mockDefaultProjects = [
  { id: 1, workspace_id: 1, title: 'Task Hub Core', slug: 'task-hub-core', key: 'THC', status: 'active', tasks_count: 5, created_at: '', updated_at: '' },
];
jest.mock('@/api/useProjects', () => ({
  useProjects: () => ({ data: mockDefaultProjects, isLoading: false, error: null, refetch: jest.fn() }),
  useProject: (id?: number) => ({ data: mockDefaultProjects.find(p => p.id === id) || mockDefaultProjects[0], isLoading: false, error: null }),
  useCreateProject: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// ==========================================
// 12. @/api/useSprints Mock
// ==========================================
const mockDefaultSprint = {
  id: 10,
  project_id: 1,
  name: 'Sprint 1: Architecture',
  goal: 'Establish core views and scrum hierarchy',
  status: 'active',
  created_at: '',
  updated_at: '',
};
let mockSprintsList = [mockDefaultSprint];
const mockSprintsApi = {
  __esModule: true,
  useSprints: () => ({ data: mockSprintsList, isLoading: false, error: null, refetch: jest.fn() }),
  useActiveSprint: () => ({
    activeSprint: mockSprintsList[0] || null,
    sprints: mockSprintsList,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useSprintWithRollup: () => ({
    sprint: { ...mockDefaultSprint, total_points: 5, done_points: 0, in_progress_points: 5, todo_points: 0, total_tasks: 1, done_tasks: 0 },
    stats: { totalPoints: 5, donePoints: 0, inProgressPoints: 5, todoPoints: 0, totalTasks: 1, doneTasks: 0, completionPercentage: 0 },
    isLoading: false,
  }),
  useStartSprint: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCompleteSprint: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useMoveTasks: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
  __setSprintsList: (list: any[]) => { mockSprintsList = list; },
  __resetSprintsMock: () => { mockSprintsList = [mockDefaultSprint]; },
};
jest.mock('@/api/useSprints', () => mockSprintsApi);

// ==========================================
// 13. @/api/useTasks Mock
// ==========================================
const mockDefaultTask = {
  id: 101,
  workspace_id: 1,
  project_id: 1,
  sprint_id: 10,
  title: 'Implement Task Detail Screen',
  description: '## Acceptance Criteria\n- Render markdown\n- Show pomodoros\n> [!NOTE]\n> Ensure non-epic invariant is enforced.',
  issue_type: 'task',
  status: 'in_progress',
  priority: 'urgent',
  story_points: 5,
  estimated_pomodoros: 4,
  completed_pomodoros: 2,
  parent_epic: { id: 1, title: 'Milestone 4 Views' },
  created_at: '',
  updated_at: '',
};
const mockDefaultEpic = {
  id: 1,
  workspace_id: 1,
  project_id: 1,
  title: 'Milestone 4 Views',
  issue_type: 'epic',
  status: 'in_progress',
  priority: 'high',
  created_at: '',
  updated_at: '',
};
let mockCurrentTask: any = mockDefaultTask;
let mockTasksList: any[] = [mockDefaultTask];
let mockEpicsList: any[] = [mockDefaultEpic];
const mockCreateTaskFn = jest.fn(async (payload: any) => ({ id: 999, ...payload }));
const mockUpdateTaskMutateFn = jest.fn();
const mockUpdateTaskMutateAsyncFn = jest.fn(async (arg: any) => arg);
const mockDeleteTaskFn = jest.fn(async (_id: number) => ({ success: true }));
const mockToggleStatusFn = jest.fn();

const mockTasksApi = {
  __esModule: true,
  useTasks: () => ({ data: mockTasksList, isLoading: false, error: null, refetch: jest.fn() }),
  useTask: () => ({ data: mockCurrentTask, isLoading: false, error: null }),
  useSprintTasks: () => ({ data: mockTasksList, isLoading: false, error: null, refetch: jest.fn() }),
  useBacklogTasks: () => ({ data: mockTasksList, isLoading: false, error: null, refetch: jest.fn() }),
  useEpics: () => ({ data: mockEpicsList, isLoading: false, error: null }),
  useCreateTask: () => ({ mutateAsync: mockCreateTaskFn, isPending: false }),
  useUpdateTask: () => ({ mutate: mockUpdateTaskMutateFn, mutateAsync: mockUpdateTaskMutateAsyncFn, isPending: false }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTaskFn, isPending: false }),
  useToggleTaskStatus: () => ({ toggleStatus: mockToggleStatusFn }),
  mockCreateTaskFn,
  mockUpdateTaskMutateFn,
  mockUpdateTaskMutateAsyncFn,
  mockDeleteTaskFn,
  mockToggleStatusFn,
  __setCurrentTask: (t: any) => { mockCurrentTask = t; },
  __setTasksList: (list: any[]) => { mockTasksList = list; },
  __setEpicsList: (list: any[]) => { mockEpicsList = list; },
  __resetTasksMock: () => {
    mockCurrentTask = mockDefaultTask;
    mockTasksList = [mockDefaultTask];
    mockEpicsList = [mockDefaultEpic];
    mockCreateTaskFn.mockClear();
    mockUpdateTaskMutateFn.mockClear();
    mockUpdateTaskMutateAsyncFn.mockClear();
    mockDeleteTaskFn.mockClear();
    mockToggleStatusFn.mockClear();
  },
};
jest.mock('@/api/useTasks', () => mockTasksApi);

// ==========================================
// 14. @/api/useAgentRuns Mock
// ==========================================
const mockDefaultAgentRun = {
  id: 101,
  task_id: 101,
  workspace_id: 1,
  runner_id: 1,
  provider: 'antigravity',
  model: 'gemini-2.5-pro',
  status: 'needs_review',
  execution_mode: 'auto_pilot',
  summary: 'Implemented task features with passing verification tests',
  task: {
    id: 101,
    issue_key: 'THC-101',
    title: 'Implement Task Detail Screen',
    status: 'in_progress',
  },
  evidence: {
    tests_passed: 110,
    tests_failed: 0,
    tests_total: 110,
    commit_sha: 'a1b2c3d4e5f6',
    changed_files: ['src/services/secureStorage.ts'],
  },
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
};

let mockAgentRunsList: any[] = [];
let mockCurrentAgentRun: any = mockDefaultAgentRun;
const mockApproveHandoffFn = jest.fn(async (taskId: number) => ({ id: taskId, status: 'done' }));
const mockRejectHandoffFn = jest.fn(async ({ taskId, reason }: { taskId: number; reason: string }) => ({ id: taskId, status: 'in_progress', reason }));
const mockCancelAgentRunFn = jest.fn(async ({ runId, reason }: { runId: number; reason?: string }) => ({ id: runId, status: 'cancelled', reason }));
const mockDispatchTaskFn = jest.fn(async ({ taskId }: { taskId: number }) => ({ id: 201, task_id: taskId, status: 'queued' }));
const mockSubmitHandoffFn = jest.fn(async ({ runId }: { runId: number }) => ({ id: runId, status: 'needs_review' }));

const mockAgentRunsApi = {
  __esModule: true,
  useAgentRuns: () => ({ data: mockAgentRunsList, isLoading: false, error: null, refetch: jest.fn() }),
  useAgentRun: (id?: number) => ({
    data: (id ? mockAgentRunsList.find((r) => r.id === id) : mockCurrentAgentRun) || mockCurrentAgentRun,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useAgentRunLogs: (_id?: number) => ({ data: [], isLoading: false, error: null }),
  useDispatchTask: () => ({ mutateAsync: mockDispatchTaskFn, isPending: false }),
  useDispatchEpic: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSubmitHandoff: () => ({ mutateAsync: mockSubmitHandoffFn, isPending: false }),
  useApproveHandoff: () => ({ mutateAsync: mockApproveHandoffFn, isPending: false }),
  useRejectHandoff: () => ({ mutateAsync: mockRejectHandoffFn, isPending: false }),
  useCancelAgentRun: () => ({ mutateAsync: mockCancelAgentRunFn, isPending: false }),
  mockApproveHandoffFn,
  mockRejectHandoffFn,
  mockCancelAgentRunFn,
  mockDispatchTaskFn,
  mockSubmitHandoffFn,
  __setCurrentAgentRun: (run: any) => { mockCurrentAgentRun = run; },
  __setAgentRuns: (runs: any[]) => { mockAgentRunsList = runs; },
  __resetAgentRunsMock: () => {
    mockAgentRunsList = [];
    mockCurrentAgentRun = mockDefaultAgentRun;
    mockApproveHandoffFn.mockClear();
    mockRejectHandoffFn.mockClear();
    mockCancelAgentRunFn.mockClear();
    mockDispatchTaskFn.mockClear();
    mockSubmitHandoffFn.mockClear();
  },
};
jest.mock('@/api/useAgentRuns', () => mockAgentRunsApi);

// Export mock registry for test assertions
export {
  mockSecureStore,
  mockLocalAuthentication,
  mockExpoCamera,
  mockReactNativeSSE,
  mockAsyncStorage,
  mockWebViewModule,
  mockWorkspacesApi,
  mockSprintsApi,
  mockTasksApi,
  mockAgentRunsApi,
};
