import { describe, it, expect } from 'vitest';
import {
  parseGitDiffNumstat,
  generateHandoffSummary,
  buildAgentHandoffPayload,
  formatHandoffMarkdown,
} from './diffHandoff';

describe('Git Diff Inspector & Structured Handoff Generator', () => {
  describe('parseGitDiffNumstat', () => {
    it('parses standard git diff numstat output', () => {
      const numstat = `
45\t12\tapps/desktop/src/components/AgentConsoleModal.vue
120\t0\tapps/desktop/src/utils/autoPilotRunner.ts
15\t5\tapps/desktop/electron/main.ts
-\t-\tpublic/favicon.ico
`;
      const stats = parseGitDiffNumstat(numstat);

      expect(stats.totalChangedFiles).toBe(4);
      expect(stats.totalAdditions).toBe(180);
      expect(stats.totalDeletions).toBe(17);
      expect(stats.changedFiles).toEqual([
        'apps/desktop/electron/main.ts',
        'apps/desktop/src/components/AgentConsoleModal.vue',
        'apps/desktop/src/utils/autoPilotRunner.ts',
        'public/favicon.ico',
      ]);

      const binaryFile = stats.files.find((f) => f.path === 'public/favicon.ico');
      expect(binaryFile?.binary).toBe(true);
      expect(binaryFile?.additions).toBe(0);
    });

    it('handles file renames in numstat format', () => {
      const numstat = `
10\t2\tsrc/{oldName => newName}.ts
5\t0\tutils/{dirA => dirB}/helper.ts
`;
      const stats = parseGitDiffNumstat(numstat);
      expect(stats.changedFiles).toContain('src/newName.ts');
      expect(stats.changedFiles).toContain('utils/dirB/helper.ts');
      expect(stats.files.find((f) => f.path === 'src/newName.ts')?.status).toBe('renamed');
    });

    it('merges statusOutput for untracked and new files', () => {
      const numstat = `12\t4\tsrc/modified.ts`;
      const statusOutput = `
 M src/modified.ts
?? src/untracked.ts
A  src/added.ts
`;
      const stats = parseGitDiffNumstat(numstat, statusOutput);
      expect(stats.totalChangedFiles).toBe(3);
      expect(stats.files.find((f) => f.path === 'src/untracked.ts')?.status).toBe('untracked');
      expect(stats.files.find((f) => f.path === 'src/added.ts')?.status).toBe('added');
    });
  });

  describe('generateHandoffSummary', () => {
    it('generates clear summary for completed tasks', () => {
      const summary = generateHandoffSummary(
        { issue_key: 'TASK-105', title: 'Implement Auto-Pilot' },
        {
          changedFiles: ['src/a.ts', 'src/b.ts'],
          totalChangedFiles: 2,
          totalAdditions: 45,
          totalDeletions: 10,
          files: [],
        },
        'Tests: 35/35 passed'
      );

      expect(summary).toContain('TASK-105');
      expect(summary).toContain('Implement Auto-Pilot');
      expect(summary).toContain('Modified 2 files (+45 / -10 lines)');
      expect(summary).toContain('Tests: 35/35 passed');
    });
  });

  describe('buildAgentHandoffPayload & formatHandoffMarkdown', () => {
    it('builds a valid AgentHandoffPayload compliant with schema', () => {
      const payload = buildAgentHandoffPayload({
        task: { issue_key: 'TH-200', title: 'Auto-Pilot Execution Loop' },
        changedFiles: ['apps/desktop/src/utils/autoPilotRunner.ts'],
        tests: [
          {
            command: 'npm test',
            status: 'passed',
            summary: '59 passed / 59 total (100%)',
          },
        ],
        commitSha: 'fedcba987654',
        pullRequestUrl: 'https://github.com/macatung/task-hub/pull/42',
        blockers: null,
      });

      expect(payload.summary).toContain('TH-200');
      expect(payload.changed_files).toEqual(['apps/desktop/src/utils/autoPilotRunner.ts']);
      expect(payload.tests[0].status).toBe('passed');
      expect(payload.commit_sha).toBe('fedcba987654');
      expect(payload.pull_request_url).toBe('https://github.com/macatung/task-hub/pull/42');
      expect(payload.blockers).toBeNull();
    });

    it('formats Markdown report with all sections', () => {
      const payload = buildAgentHandoffPayload({
        summary: 'Completed Auto-Pilot flow successfully.',
        changedFiles: ['src/main.ts', 'src/test.ts'],
        tests: [
          {
            command: 'npm test',
            status: 'passed',
            summary: '35 passed in 1.2s',
          },
        ],
        commitSha: '1234567890ab',
      });

      const md = formatHandoffMarkdown(payload);
      expect(md).toContain('# 🚀 Task Hub Agent Handoff Report');
      expect(md).toContain('Completed Auto-Pilot flow successfully.');
      expect(md).toContain('- `src/main.ts`');
      expect(md).toContain('- `src/test.ts`');
      expect(md).toContain('`npm test`');
      expect(md).toContain('`1234567890ab`');
    });
  });
});
