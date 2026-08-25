export type AutoHandoffTestStatus = 'passed' | 'skipped';

export type AutoHandoffPayload = {
  summary: string;
  changedFiles: string;
  tests: string;
  testStatus: AutoHandoffTestStatus;
  testSummary: string;
  commitSha: string;
  pullRequestUrl: string;
  blockers: string;
};

type AutoHandoffInput = {
  output: string;
  taskTitle: string;
  exitCode: number | null;
};

/**
 * Build the safe, review-only handoff generated after a successful local run.
 * Test output is best-effort: a missing test line must not strand a completed
 * run in the manual handoff form, so it is represented as skipped evidence.
 */
export function buildAutoHandoffPayload({ output, taskTitle, exitCode }: AutoHandoffInput): AutoHandoffPayload | null {
  if (exitCode !== 0 || !taskTitle.trim()) return null;

  const text = output || '';
  const blocked = /\b(?:blocked by|cannot proceed|unable to complete|sandbox startup failure)\b/i.test(text);
  if (blocked) return null;

  const commandEvidence = [...text.matchAll(/(?:npm|pnpm|yarn|bun|php artisan|pytest|go test|cargo test|vitest)[^\n]*/gi)].at(-1)?.[0];
  const resultEvidence = text.match(/(?:\d+\s+tests?\s+passed|all tests passed|test results?[^\n]*(?:passed|success))/i)?.[0];
  const evidence = commandEvidence || resultEvidence;
  const verified = Boolean(evidence && /\b(?:passed|tests?\s+pass|all tests|exit(?: code)?\s*0|successfully)\b/i.test(text));

  return {
    summary: `Automated handoff: ${taskTitle}`,
    changedFiles: '',
    tests: evidence || 'Agent process exited with code 0',
    testStatus: verified ? 'passed' : 'skipped',
    testSummary: verified
      ? 'Agent completed successfully; test evidence was detected in the current local run.'
      : 'Agent completed successfully; no test output was emitted, so Hub review is required before approval.',
    commitSha: '',
    pullRequestUrl: '',
    blockers: '',
  };
}
