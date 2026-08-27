import { describe, expect, it } from '../Harness/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve(process.cwd(), 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const consoleSource = readFileSync(resolve(process.cwd(), 'resources/js/Components/tasks/StreambackConsole.vue'), 'utf8');
const runController = readFileSync(resolve(process.cwd(), 'app/Http/Controllers/Api/ApiAgentRunController.php'), 'utf8');
const mcpController = readFileSync(resolve(process.cwd(), 'app/Http/Controllers/Api/TaskHubMcpController.php'), 'utf8');

describe('independent agent review visibility', () => {
  it('tracks pending agent reviews for human-controlled approval', () => {
    expect(pageSource).toContain('pendingAgentReviews');
  });

  it('renders reviewer evidence and keeps final approval human-controlled', () => {
    expect(consoleSource).toContain('Independent review loop');
    expect(consoleSource).toContain('Final approval and merge remain a human action on Hub.');
    expect(consoleSource).toContain('Request changes');
    expect(consoleSource).toContain('Approve & Mark Done');
  });

  it('only auto-completes after separate passed reviewer evidence', () => {
    expect(mcpController).toContain('complete_auto_approved_handoff');
    expect(runController).toContain("'auto_approved' => 'nullable|boolean'");
    expect(runController).toContain("->where('evidence_type', 'independent_review')");
    expect(runController).toContain("'auto_handoff_approved'");
    expect(runController).toContain("['status' => 'done', 'completed_at' => now()]");
  });
});
