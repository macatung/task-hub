import { readFileSync } from 'node:fs';

const requiredFiles = [
  'task-hub.openapi.yaml',
  'schemas/agent-handoff.schema.json',
  'schemas/agent-runner.schema.json',
  'schemas/desktop-agent-heartbeat.schema.json',
  'schemas/desktop-agent-registry.schema.json',
  'schemas/remote-dispatch.schema.json'
];

for (const file of requiredFiles) {
  const contents = readFileSync(new URL(file, import.meta.url), 'utf8');
  if (!contents.trim()) throw new Error(`${file} is empty`);
  if (file.endsWith('.json')) {
    try {
      JSON.parse(contents);
    } catch (e) {
      throw new Error(`${file} contains invalid JSON: ${e.message}`);
    }
  }
}
console.log(`Task Hub contracts (${requiredFiles.length} specifications) are present, valid, and readable.`);
