import { readFileSync } from 'node:fs';

for (const file of ['task-hub.openapi.yaml', 'schemas/agent-handoff.schema.json', 'schemas/agent-runner.schema.json']) {
  const contents = readFileSync(new URL(file, import.meta.url), 'utf8');
  if (!contents.trim()) throw new Error(`${file} is empty`);
}
console.log('Task Hub contracts are present and readable.');
