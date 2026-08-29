import { describe, expect, it } from 'vitest';
import {
  buildCaoRequirementSupervisorPrompt,
  generateCaoEpicWorkflowYaml,
  generateCaoStandardWorkflowYaml,
  selectCaoOrchestrationStrategy,
  topologicallySortEpicTasks,
} from '../caoBridgeService';

const task = (id: number, sort_order: number, dependencies: any[] = []) => ({
  id,
  issue_key: `TASK-${id}`,
  title: `Task ${id}`,
  description: `Description ${id}`,
  status: 'todo',
  sort_order,
  dependencies,
});

describe('CAO hybrid orchestration builders', () => {
  it('routes deterministic work to workflow and exploratory work to supervisor', () => {
    expect(selectCaoOrchestrationStrategy({ title: 'Fix API bug' })).toBe('workflow');
    expect(selectCaoOrchestrationStrategy({ title: 'Research cache strategy' })).toBe('supervisor');
    expect(selectCaoOrchestrationStrategy({ title: 'Fix API bug' }, { strategy: 'supervisor' })).toBe('supervisor');
  });

  it('topologically sorts dependencies before sort_order and id', () => {
    const result = topologicallySortEpicTasks([
      task(3, 1, [{ depends_on_task_id: 2 }]),
      task(2, 99),
      task(1, 1),
    ]);
    expect(result.ok).toBe(true);
    expect(result.ordered.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('rejects missing dependencies and cycles', () => {
    const missing = topologicallySortEpicTasks([task(1, 1, [{ depends_on_task_id: 999 }])]);
    expect(missing.ok).toBe(false);
    expect(missing.missingDependencyIds).toEqual([999]);

    const cycle = topologicallySortEpicTasks([
      task(1, 1, [{ depends_on_task_id: 2 }]),
      task(2, 2, [{ depends_on_task_id: 1 }]),
    ]);
    expect(cycle.ok).toBe(false);
    expect(cycle.cycleIds).toEqual([1, 2]);
  });

  it('emits strict task contracts and a single sequential epic workflow', () => {
    const taskYaml = generateCaoStandardWorkflowYaml({ taskKey: 'TASK-1', taskTitle: 'Quote "safe" title', taskDescription: 'Implement it' });
    expect(taskYaml).toContain('id: implement');
    expect(taskYaml).toContain('id: review');
    expect(taskYaml).toContain('id: evidence');
    expect(taskYaml).toContain('id: handoff');
    expect(taskYaml).toContain('modified_files');
    expect(taskYaml).toContain('risk_score');
    expect(taskYaml).toContain('test_pass_count');

    const epic = generateCaoEpicWorkflowYaml({
      epic: { id: 10, issue_key: 'EPIC-10', title: 'Release' },
      childTasks: [task(2, 2, [{ depends_on_task_id: 1 }]), task(1, 5)],
    });
    expect(epic.yaml).toContain('id: child-1-1-implement');
    expect(epic.yaml).toContain('id: child-2-2-handoff');
    expect(epic.yaml).toContain('id: epic-finalize');
    expect(epic.yaml).toContain('{{steps.child-1-1-handoff.output}}');
    expect(epic.order.ordered.map((item) => item.id)).toEqual([1, 2]);
  });

  it('builds a supervisor prompt with the CAO delegation tools', () => {
    const prompt = buildCaoRequirementSupervisorPrompt('Explore API requirements');
    expect(prompt).toContain('assign()');
    expect(prompt).toContain('handoff()');
    expect(prompt).toContain('send_message()');
    expect(prompt).toContain('Do not edit files');
  });
});
