import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());
const tasksPage = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const dashboard = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ProjectRoadmapDashboard.vue'), 'utf8');
const gantt = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ProjectGantt.vue'), 'utf8');

describe('Roadmap project management', () => {
  it('requires a selected project before rendering roadmap analytics', () => {
    expect(tasksPage).toContain('v-if="!hasSelectedProject"');
    expect(tasksPage).toContain('Select a project to view its roadmap');
    expect(tasksPage).toContain('<ProjectRoadmapDashboard');
  });

  it('keeps child tasks when deleting an Epic and clears their local Epic association', () => {
    expect(tasksPage).toContain('const deleteEpicFromRoadmap');
    expect(tasksPage).toContain('linked task');
    expect(tasksPage).toContain('.filter(task => task.id !== epic.id)');
    expect(tasksPage).toContain("{ ...task, epic_id: null, epic: null }");
    expect(tasksPage).toContain('Unable to delete the Epic. Your tasks were not changed.');
  });

  it('renders status, priority and delivery trend without a chart dependency', () => {
    expect(dashboard).toContain('Status distribution');
    expect(dashboard).toContain('Priority load');
    expect(dashboard).toContain('Delivery trend');
    expect(dashboard).toContain('conic-gradient');
    expect(dashboard).toContain('unscheduledTasks');
  });

  it('supports expandable Epic rows and handles unscheduled work in the Gantt', () => {
    expect(gantt).toContain('expandedEpicIds');
    expect(gantt).toContain('toggleExpanded');
    expect(gantt).toContain('childrenFor');
    expect(gantt).toContain('Unscheduled');
    expect(gantt).toContain('overflow-x-auto');
  });
});
