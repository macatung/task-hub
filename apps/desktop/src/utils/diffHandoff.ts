/**
 * Git Diff Inspector & Structured Handoff Generator
 * 
 * Analyzes git diff outputs (`git diff HEAD --numstat`, status output) and generates
 * structured handoff payloads compliant with `schemas/agent-handoff.schema.json`.
 */

export interface DiffFileStat {
  path: string;
  additions: number;
  deletions: number;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  binary?: boolean;
}

export interface ParsedDiffStats {
  changedFiles: string[];
  totalChangedFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  files: DiffFileStat[];
}

export interface HandoffTestRecord {
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  summary: string;
}

export interface AgentHandoffPayload {
  summary: string;
  changed_files: string[];
  tests: HandoffTestRecord[];
  commit_sha?: string;
  pull_request_url?: string;
  blockers?: string | null;
}

/**
 * Parse the output of `git diff HEAD --numstat` into structured file statistics.
 */
export function parseGitDiffNumstat(
  numstatOutput: string,
  statusOutput?: string
): ParsedDiffStats {
  if (!numstatOutput && !statusOutput) {
    return {
      changedFiles: [],
      totalChangedFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      files: [],
    };
  }

  const filesMap = new Map<string, DiffFileStat>();
  let totalAdditions = 0;
  let totalDeletions = 0;

  if (numstatOutput) {
    const lines = numstatOutput.trim().split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/\t/);
      if (parts.length >= 3) {
        const rawAdds = parts[0].trim();
        const rawDels = parts[1].trim();
        const rawPath = parts.slice(2).join('\t').trim();

        const isBinary = rawAdds === '-' && rawDels === '-';
        const additions = isBinary ? 0 : parseInt(rawAdds, 10) || 0;
        const deletions = isBinary ? 0 : parseInt(rawDels, 10) || 0;

        totalAdditions += additions;
        totalDeletions += deletions;

        // Clean rename notation: e.g. "src/{old => new}.ts" -> "src/new.ts"
        const cleanPath = normalizeGitPath(rawPath);

        filesMap.set(cleanPath, {
          path: cleanPath,
          additions,
          deletions,
          status: rawPath.includes('=>') ? 'renamed' : 'modified',
          binary: isBinary,
        });
      }
    }
  }

  // Parse git status --short for untracked / added / deleted files
  if (statusOutput) {
    const statusLines = statusOutput.split(/\r?\n/);
    for (const line of statusLines) {
      if (!line.trim()) continue;
      const match = line.match(/^([ MADRCU?!]{1,2})\s+(.+)$/);
      const code = match ? match[1] : line.slice(0, 2);
      const rawPath = match ? match[2].trim() : line.slice(2).trim();
      const filePath = normalizeGitPath(rawPath);

      let statusType: DiffFileStat['status'] = 'modified';
      if (code.includes('?')) statusType = 'untracked';
      else if (code.includes('A')) statusType = 'added';
      else if (code.includes('D')) statusType = 'deleted';
      else if (code.includes('R')) statusType = 'renamed';

      if (filesMap.has(filePath)) {
        const existing = filesMap.get(filePath)!;
        existing.status = statusType;
      } else {
        filesMap.set(filePath, {
          path: filePath,
          additions: 0,
          deletions: 0,
          status: statusType,
        });
      }
    }
  }

  const files = Array.from(filesMap.values()).sort((a, b) => a.path.localeCompare(b.path));
  const changedFiles = files.map((f) => f.path);

  return {
    changedFiles,
    totalChangedFiles: changedFiles.length,
    totalAdditions,
    totalDeletions,
    files,
  };
}

/**
 * Clean Git rename path syntax into clean file path.
 */
function normalizeGitPath(rawPath: string): string {
  if (rawPath.includes('=>')) {
    // e.g. "src/{old => new}.ts" or "old.ts => new.ts"
    return rawPath.replace(/\{.*?=>\s*(.*?)\}/g, '$1').replace(/.*=>\s*/, '').trim();
  }
  return rawPath.replace(/^["']|["']$/g, '').trim();
}

/**
 * Generate a descriptive handoff summary based on task info, diff stats, and test results.
 */
export function generateHandoffSummary(
  task?: { issue_key?: string; title?: string; key?: string },
  stats?: ParsedDiffStats,
  testSummary?: string
): string {
  const taskKey = task?.issue_key || task?.key || 'TASK';
  const taskTitle = task?.title ? ` - ${task.title}` : '';
  const fileCount = stats?.totalChangedFiles ?? stats?.changedFiles?.length ?? 0;
  const adds = stats?.totalAdditions ?? 0;
  const dels = stats?.totalDeletions ?? 0;

  let summary = `Autonomous Auto-Pilot completed execution for ${taskKey}${taskTitle}.`;
  if (fileCount > 0) {
    summary += ` Modified ${fileCount} file${fileCount > 1 ? 's' : ''} (+${adds} / -${dels} lines).`;
  }
  if (testSummary) {
    summary += ` ${testSummary}`;
  }

  return summary;
}

/**
 * Build a structured AgentHandoffPayload matching `schemas/agent-handoff.schema.json`.
 */
export function buildAgentHandoffPayload(options: {
  summary?: string;
  task?: { issue_key?: string; title?: string; key?: string };
  diffStats?: ParsedDiffStats;
  changedFiles?: string[];
  tests?: HandoffTestRecord[];
  commitSha?: string;
  pullRequestUrl?: string;
  blockers?: string | null;
}): AgentHandoffPayload {
  const diffStats = options.diffStats || {
    changedFiles: options.changedFiles || [],
    totalChangedFiles: (options.changedFiles || []).length,
    totalAdditions: 0,
    totalDeletions: 0,
    files: [],
  };

  const changedFiles = options.changedFiles || diffStats.changedFiles;
  const tests = options.tests || [];

  const testSummarySnippet = tests.length > 0 ? `Tests: ${tests.map((t) => t.summary).join('; ')}` : undefined;
  const summary = options.summary || generateHandoffSummary(options.task, diffStats, testSummarySnippet);

  return {
    summary,
    changed_files: changedFiles,
    tests,
    commit_sha: options.commitSha || undefined,
    pull_request_url: options.pullRequestUrl || undefined,
    blockers: options.blockers || null,
  };
}

/**
 * Format handoff payload into rich Markdown for clipboard / review display.
 */
export function formatHandoffMarkdown(payload: AgentHandoffPayload): string {
  const filesList = payload.changed_files.length > 0
    ? payload.changed_files.map((f) => `- \`${f}\``).join('\n')
    : '_No changed files recorded_';

  const testList = payload.tests.length > 0
    ? payload.tests
        .map(
          (t) =>
            `- **\`${t.command}\`** [${t.status.toUpperCase()}]: ${t.summary}`
        )
        .join('\n')
    : '_No tests recorded_';

  return [
    '# 🚀 Task Hub Agent Handoff Report',
    '',
    '## Summary',
    payload.summary,
    '',
    '## Changed Files',
    filesList,
    '',
    '## Verification & Test Evidence',
    testList,
    '',
    '## Integration Metadata',
    `- **Commit SHA**: \`${payload.commit_sha || 'N/A'}\``,
    `- **Pull Request**: ${payload.pull_request_url ? `[${payload.pull_request_url}](${payload.pull_request_url})` : 'N/A'}`,
    `- **Blockers**: ${payload.blockers || 'None'}`,
  ].join('\n');
}
