import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());
const controller = fs.readFileSync(
  path.join(hubRoot, 'app/Http/Controllers/Api/ApiAgentRunController.php'),
  'utf8',
);
const mcpController = fs.readFileSync(
  path.join(hubRoot, 'app/Http/Controllers/Api/TaskHubMcpController.php'),
  'utf8',
);
const consoleSource = fs.readFileSync(
  path.join(hubRoot, 'resources/js/Components/tasks/StreambackConsole.vue'),
  'utf8',
);

describe('local CAO Epic aggregate approval', () => {
  it('recognizes a local CAO Epic parent run and approves children transactionally', () => {
    expect(controller).toContain("$latest->run_type === 'epic'");
    expect(controller).toContain("data_get($sequence, 'local_cao') === true");
    expect(controller).toContain('DB::transaction(function () use ($task, $latest, $children, $childRunIds, $now)');
    expect(controller).toContain("'epic_human_approved'");
    expect(controller).toContain("->update(['status' => 'done', 'completed_at' => $now])");
  });

  it('keeps Epic rejection resumable without auto-starting another child', () => {
    expect(controller).toContain("'epic_human_rejected'");
    expect(controller).toContain('Epic returned for changes. No child task was auto-started.');
  });

  it('allows the next local CAO child to use durable parent verification for dependencies', () => {
    expect(controller).toContain('localCaoDependenciesVerified');
    expect(controller).toContain("epic_sequence.children");
    expect(controller).toContain("$child['taskId'] ?? $child['task_id'] ?? null");
  });

  it('exposes one aggregate Epic review surface in Hub', () => {
    expect(mcpController).toContain('local CAO Epic orchestrator');
    expect(consoleSource).toContain('isEpicAggregate');
    expect(consoleSource).toContain('CAO Epic child results');
    expect(consoleSource).toContain('Approve Epic & Mark All Done');
  });
});
