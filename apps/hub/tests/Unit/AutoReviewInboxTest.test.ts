import { describe, expect, it } from '../Harness/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve(process.cwd(), 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const consoleSource = readFileSync(resolve(process.cwd(), 'resources/js/Components/tasks/StreambackConsole.vue'), 'utf8');

describe('independent agent review visibility', () => {
  it('shows pending handoffs in a visible review inbox on the task board', () => {
    expect(pageSource).toContain('pendingAgentReviews');
    expect(pageSource).toContain('Review inbox');
    expect(pageSource).toContain('Open review inbox');
  });

  it('renders reviewer evidence and keeps final approval human-controlled', () => {
    expect(consoleSource).toContain('Independent review loop');
    expect(consoleSource).toContain('Final approval and merge remain a human action on Hub.');
    expect(consoleSource).toContain('Request changes');
    expect(consoleSource).toContain('Approve & Mark Done');
  });
});
