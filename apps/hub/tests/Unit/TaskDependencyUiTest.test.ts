import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'resources/js/Pages/Tasks/Index.vue'), 'utf8');

describe('Task dependency UI', () => {
  it('removes the global execution-order strip so task cards remain the source of truth', () => {
    expect(source).not.toContain('Execution order');
    expect(source).not.toContain('executionPreview');
    expect(source).not.toContain('Follow the arrows from prerequisite');
  });

  it('renders dependency notes, blockers and regression review prompts on task cards', () => {
    expect(source).toContain('Depends on {{ dependencySummary(task).labels.join');
    expect(source).toContain('Blocked by {{ dependencySummary(task).pendingLabels.join');
    expect(source).toContain('Needs review: a prerequisite moved back from done');
    expect(source).toContain('reconsider dependent work:');
  });
});
