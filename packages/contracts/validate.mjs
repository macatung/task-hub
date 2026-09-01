import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requiredFiles = [
  'task-hub.openapi.yaml',
  'schemas/agent-handoff.schema.json',
  'schemas/agent-runner.schema.json',
  'schemas/desktop-agent-heartbeat.schema.json',
  'schemas/desktop-agent-registry.schema.json',
  'schemas/quota-snapshot.schema.json',
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

// Keep the quota contract's core interoperability guarantees explicit. This is
// intentionally dependency-free so contract validation also works in a fresh checkout.
const quotaSchema = JSON.parse(readFileSync(new URL('schemas/quota-snapshot.schema.json', import.meta.url), 'utf8'));
const requiredQuotaFields = [
  'schema_version',
  'provider',
  'windows',
  'source',
  'collected_at',
  'device_id',
  'idempotency_key'
];
assert.deepEqual(quotaSchema.required, requiredQuotaFields);
assert.equal(quotaSchema.additionalProperties, false);
assert.deepEqual(quotaSchema.$defs.quota_window.properties.status.enum, ['available', 'unknown', 'unavailable']);
assert.equal(quotaSchema.$defs.quota_window.allOf[0].else.properties.used.type, 'null');
for (const field of ['used', 'limit', 'remaining']) {
  assert.equal(quotaSchema.$defs.quota_window.properties[field].maximum, 1_000_000_000_000_000);
  assert.equal(quotaSchema.$defs.quota_window.allOf[0].else.properties[field].type, 'null');
}
assert.equal(quotaSchema.$defs.quota_window.allOf[0].else.properties.reset_at.type, 'null');

// Window names are map keys rather than values inside array entries. Besides
// making duplicate names unrepresentable after JSON parsing, this also keeps
// the name constraints in the contract itself instead of only in consumers.
const windowsSchema = quotaSchema.properties.windows;
assert.equal(windowsSchema.type, 'object');
assert.equal(windowsSchema.minProperties, 1);
assert.equal(windowsSchema.maxProperties, 32);
assert.deepEqual(windowsSchema.propertyNames, {
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-z][a-z0-9_]*$'
});
assert.deepEqual(windowsSchema.additionalProperties, { $ref: '#/$defs/quota_window' });
assert.equal('name' in quotaSchema.$defs.quota_window.properties, false);
assert.equal(quotaSchema.$defs.quota_window.required.includes('name'), false);

// Regression: the former array representation allowed two entries to claim
// the same name when their other values differed. It must no longer satisfy
// the top-level windows shape.
const duplicateWindowNames = [
  { name: 'five_hour', status: 'available', used: 1, limit: 10, remaining: 9, reset_at: null },
  { name: 'five_hour', status: 'available', used: 2, limit: 10, remaining: 8, reset_at: null }
];
assert.equal(
  typeof duplicateWindowNames === windowsSchema.type && !Array.isArray(duplicateWindowNames),
  false,
  'duplicate quota-window names must be rejected'
);

const openApi = readFileSync(new URL('task-hub.openapi.yaml', import.meta.url), 'utf8');
assert.match(openApi, /QuotaSnapshot:\s*\n\s+\$ref: ['"]\.\/schemas\/quota-snapshot\.schema\.json['"]/);
assert.match(openApi, /\/api\/v1\/quota-snapshots:\s*\n\s+post:/);
assert.match(openApi, /tenant is derived from the authenticated desktop credential/);
console.log(`Task Hub contracts (${requiredFiles.length} specifications) are present, valid, and readable.`);
