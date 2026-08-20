import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
if (!tag) {
  console.error('Usage: npm run version:check -- desktop-v1.0.1');
  process.exit(1);
}
const expected = `desktop-v${packageJson.version}`;
if (tag !== expected) {
  console.error(`Release tag ${tag} does not match desktop/package.json version ${packageJson.version}; expected ${expected}.`);
  process.exit(1);
}
console.log(`Release version OK: ${expected}`);
