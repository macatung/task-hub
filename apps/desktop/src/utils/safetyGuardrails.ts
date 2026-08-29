/**
 * Safety Interception Engine & Guardrails
 * 
 * Inspects shell commands, tool calls, and workspace diffs/content for:
 * 1. Destructive filesystem operations (e.g. `rm -rf /`, `rmdir /s /q C:\`, `del /f /s /q`)
 * 2. Destructive Git operations (e.g. `git push --force`, `git reset --hard`, `git clean -fd`, `git branch -D`)
 * 3. Destructive database/system commands (e.g. `drop database`, `truncate table`, `delete from ... where 1=1`)
 * 4. Dangerous disk/kernel commands & Windows utilities (e.g. `format`, `mkfs`, `fdisk`, `dd`, `chmod -R 777`, `diskpart`, `vssadmin delete shadows`, `bcdedit`)
 * 5. Dangerous remote script pipes & obfuscation (e.g. `curl ... | bash`, `powershell -enc`, `Invoke-Expression (New-Object Net.WebClient)`)
 * 6. Git merge conflict markers (e.g. `<<<<<<< HEAD`, `=======`, `>>>>>>>`)
 * 
 * When triggered, execution is paused into `waiting_input` state for developer approval.
 */

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';
export type SafetyCategory = 'filesystem' | 'git' | 'database' | 'system' | 'conflict';
export type AgentExecutionPolicy = 'restricted' | 'workspace_write' | 'full_access';
export type AgentProvider = 'codex' | 'claude_code' | 'antigravity';

export interface SafetyInspectionResult {
  safe: boolean;
  riskLevel: RiskLevel;
  category?: SafetyCategory;
  reason?: string;
  matchedPattern?: string;
  command?: string;
  requiresApproval: boolean;
}

export interface ConflictInspectionResult {
  hasConflict: boolean;
  riskLevel: RiskLevel;
  conflictCount: number;
  filePath?: string;
  markers: string[];
  snippet?: string;
  requiresApproval: boolean;
}

export interface SafetyInterceptEvent {
  eventId: string;
  eventType: 'safety_check';
  status: 'waiting_input';
  riskLevel: RiskLevel;
  category: SafetyCategory;
  reason: string;
  command?: string;
  details?: Record<string, any>;
  occurredAt: string;
  requiresApproval: boolean;
}

interface GuardrailRule {
  id: string;
  category: SafetyCategory;
  riskLevel: RiskLevel;
  pattern: RegExp;
  reason: string;
}

export const GUARDRAIL_RULES: GuardrailRule[] = [
  // 1. Filesystem Destruction
  {
    id: 'fs-rm-root-or-all',
    category: 'filesystem',
    riskLevel: 'critical',
    pattern: /\brm\s+(-[rfRF]+\s+|--recursive\s+|--force\s+)*(\/(?![\w.-])|\/\*|~|%USERPROFILE%|[A-Z]:\\?|\$HOME|\.\.|\*|\.)/i,
    reason: 'Destructive deletion targeting root, home directory, whole drive, or parent directory.',
  },
  {
    id: 'fs-rm-rf-general',
    category: 'filesystem',
    riskLevel: 'critical',
    pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*/i,
    reason: 'Recursive force file/directory deletion (rm -rf).',
  },
  {
    id: 'fs-win-rmdir-root',
    category: 'filesystem',
    riskLevel: 'critical',
    pattern: /\b(rmdir|rd)\s+(\/[sS]\s+\/[qQ]|\/[qQ]\s+\/[sS]|\/[sS]|\/[qQ])/i,
    reason: 'Windows rmdir/rd recursive silent directory purge.',
  },
  {
    id: 'fs-win-del-force-root',
    category: 'filesystem',
    riskLevel: 'critical',
    pattern: /\bdel\s+.*(\/[fF]|\/[sS]|\/[qQ])/i,
    reason: 'Windows del silent/force/recursive deletion.',
  },
  {
    id: 'fs-system-dir-deletion',
    category: 'filesystem',
    riskLevel: 'critical',
    pattern: /\b(rm\s+-[rfRF]+|del|rmdir|rd)\s+.*(\/bin|\/sbin|\/etc|\/usr|\/var|\/boot|[A-Za-z]:\\Windows|[A-Za-z]:\\Program\s+Files|\/Windows|\/Program\s+Files)/i,
    reason: 'Attempted deletion of operating system or critical system directories.',
  },

  // 2. Git Destructive Operations
  {
    id: 'git-force-push',
    category: 'git',
    riskLevel: 'critical',
    pattern: /\bgit\s+push\s+.*(--force\b|-f\b|--force-with-lease\b)/i,
    reason: 'Git force push can overwrite remote history and cause data loss.',
  },
  {
    id: 'git-hard-reset',
    category: 'git',
    riskLevel: 'high',
    pattern: /\bgit\s+reset\s+--hard\b/i,
    reason: 'Git hard reset discards all uncommitted working tree and staged changes.',
  },
  {
    id: 'git-clean-force',
    category: 'git',
    riskLevel: 'high',
    pattern: /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*/i,
    reason: 'Git clean force removes untracked files permanently.',
  },
  {
    id: 'git-checkout-restore-all',
    category: 'git',
    riskLevel: 'medium',
    pattern: /\bgit\s+(checkout|restore)\s+(\.|\*|--\s+\.)/i,
    reason: 'Discards all local unstaged modifications in the working tree.',
  },
  {
    id: 'git-branch-force-delete',
    category: 'git',
    riskLevel: 'critical',
    pattern: /\bgit\s+branch\s+.*(-D\b|-d\s+-f\b|--delete\s+--force\b)/i,
    reason: 'Forced deletion of Git branch.',
  },

  // 3. Database / Storage Destruction
  {
    id: 'db-drop-database',
    category: 'database',
    riskLevel: 'critical',
    pattern: /\bdrop\s+(database|schema)\s+[\w`"-]+/i,
    reason: 'DROP DATABASE or SCHEMA permanently destroys schemas and all data.',
  },
  {
    id: 'db-drop-table',
    category: 'database',
    riskLevel: 'high',
    pattern: /\b(drop\s+table|truncate\s+table|truncate)\s+[\w`".-]+/i,
    reason: 'DROP TABLE or TRUNCATE destroys table structure and stored records.',
  },
  {
    id: 'db-blanket-delete',
    category: 'database',
    riskLevel: 'high',
    pattern: /\bdelete\s+from\s+[\w`".-]+\s*(;|where\s+1\s*=\s*1\s*;?|$)/i,
    reason: 'Unconstrained DELETE statement without specific WHERE condition.',
  },

  // 4. System / Kernel / Disk Destruction
  {
    id: 'sys-disk-format',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\b(format\s+[A-Za-z]:|format(\.com)?\s+\/[a-zA-Z]|mkfs(\.[a-z0-9]+)?\s+\/dev\/|fdisk\s+\/dev\/)/i,
    reason: 'Disk format / filesystem creation destroys disk partition contents.',
  },
  {
    id: 'sys-dd-raw-write',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\bdd\s+if=.*\s+of=(\/dev\/|[A-Za-z]:)/i,
    reason: 'Raw disk write (dd) can corrupt drive partitions and boot sectors.',
  },
  {
    id: 'sys-chmod-root-777',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\bchmod\s+(-R\s+)?(777|000)\s+(\/|\/etc|\/var)/i,
    reason: 'Destructive recursive chmod on root or critical system directories.',
  },
  {
    id: 'sys-win-diskpart',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\bdiskpart(\.exe)?\b/i,
    reason: 'Windows DiskPart utility can partition, format, or wipe storage volumes.',
  },
  {
    id: 'sys-win-vssadmin',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\bvssadmin(\.exe)?\s+delete\s+shadows\b/i,
    reason: 'Deleting Volume Shadow Copies destroys system restore points and backup snapshots.',
  },
  {
    id: 'sys-win-bcdedit',
    category: 'system',
    riskLevel: 'critical',
    pattern: /\bbcdedit(\.exe)?\b/i,
    reason: 'Modifying Windows Boot Configuration Data (BCDEdit) can prevent system startup.',
  },

  // 5. Unsafe Remote Execution Pipes & Obfuscation
  {
    id: 'sys-curl-pipe-shell',
    category: 'system',
    riskLevel: 'high',
    pattern: /\b(curl|wget)\s+.*\|\s*(bash|sh|zsh|powershell|pwsh|cmd)(\s+|$)/i,
    reason: 'Piping arbitrary web downloads directly into shell interpreter.',
  },
  {
    id: 'sys-powershell-encoded',
    category: 'system',
    riskLevel: 'high',
    pattern: /\b(powershell|pwsh)(\.exe)?\s+.*(-e|-enc|-encodedcommand)\b/i,
    reason: 'PowerShell execution with base64 encoded payload obscures intent.',
  },
  {
    id: 'sys-powershell-iex',
    category: 'system',
    riskLevel: 'high',
    pattern: /\b(invoke-expression|iex)\s+.*(new-object\s+net\.webclient|downloadstring|invoke-webrequest|iwr)/i,
    reason: 'In-memory remote payload download and execution (Invoke-Expression).',
  },
];

/**
 * Clean mapping from provider and execution policy to CLI arguments.
 */
export function executionPolicyArgs(provider: AgentProvider, policy: AgentExecutionPolicy): string[] {
  if (provider === 'codex') {
    if (policy === 'full_access') return ['--dangerously-bypass-approvals-and-sandbox'];
    if (policy === 'restricted') return ['--sandbox', 'read-only'];
    return ['--sandbox', 'workspace-write'];
  }
  if (policy !== 'full_access') return [];
  if (provider === 'claude_code' || provider === 'antigravity') return ['--dangerously-skip-permissions'];
  return [];
}

/**
 * Codex approval arguments mapping for non-full_access policies.
 */
export function codexApprovalArgs(policy: AgentExecutionPolicy): string[] {
  if (policy === 'full_access') return [];
  return ['--ask-for-approval', 'on-request'];
}

/**
 * Inspect a shell command string for dangerous operations.
 */
export function inspectCommand(command: string): SafetyInspectionResult {
  if (!command || typeof command !== 'string') {
    return {
      safe: true,
      riskLevel: 'safe',
      requiresApproval: false,
    };
  }

  const trimmed = command.trim();
  for (const rule of GUARDRAIL_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        safe: false,
        riskLevel: rule.riskLevel,
        category: rule.category,
        reason: rule.reason,
        matchedPattern: rule.id,
        command: trimmed,
        requiresApproval: true,
      };
    }
  }

  return {
    safe: true,
    riskLevel: 'safe',
    command: trimmed,
    requiresApproval: false,
  };
}

/**
 * Check if a command is considered dangerous (requires human approval).
 */
export function isDangerousCommand(command: string): boolean {
  return !inspectCommand(command).safe;
}

/**
 * Inspect tool call execution parameters for safety violations.
 */
export function inspectToolExecution(
  toolName: string,
  parameters: Record<string, any> = {}
): SafetyInspectionResult {
  const normName = (toolName || '').toLowerCase();

  // 1. If it's a command execution tool
  if (['run_command', 'exec_command', 'terminal_exec', 'shell', 'bash', 'powershell', 'cmd'].includes(normName)) {
    const cmd = parameters.CommandLine || parameters.command || parameters.cmd || parameters.code || '';
    return inspectCommand(cmd);
  }

  // 2. If it's a file replacement/writing tool
  if (['write_to_file', 'replace_file_content', 'file_write', 'save_file'].includes(normName)) {
    const content = parameters.CodeContent || parameters.ReplacementContent || parameters.content || '';
    const filePath = parameters.TargetFile || parameters.path || parameters.AbsolutePath || parameters.file || '';
    
    // Check if code contains conflict markers being committed
    const conflict = inspectContentForConflicts(content, filePath);
    if (conflict.hasConflict) {
      return {
        safe: false,
        riskLevel: conflict.riskLevel,
        category: 'conflict',
        reason: `File content contains ${conflict.conflictCount} unresolved Git merge conflict markers.`,
        matchedPattern: 'git-merge-conflict-markers',
        command: `Editing ${filePath}`,
        requiresApproval: true,
      };
    }

    // Check if targeting protected system files
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    if (
      normalizedPath.startsWith('/etc') ||
      normalizedPath.startsWith('etc/') ||
      normalizedPath.startsWith('/bin') ||
      normalizedPath.startsWith('/sbin') ||
      normalizedPath.startsWith('/usr') ||
      normalizedPath.startsWith('/var') ||
      normalizedPath.startsWith('/boot') ||
      normalizedPath.includes('c:/windows') ||
      normalizedPath.includes('/windows') ||
      normalizedPath.includes('program files') ||
      normalizedPath.includes('.git/objects') ||
      normalizedPath.includes('.git/refs') ||
      normalizedPath.includes('.git/config')
    ) {
      return {
        safe: false,
        riskLevel: 'critical',
        category: 'filesystem',
        reason: `Direct modification of protected system or git internal file: ${filePath}`,
        matchedPattern: 'protected-file-write',
        command: `Writing to ${filePath}`,
        requiresApproval: true,
      };
    }
  }

  return {
    safe: true,
    riskLevel: 'safe',
    requiresApproval: false,
  };
}

const CONFLICT_MARKER_REGEX = /^(<{7}|={7}|>{7})(?:\s+.*)?$/m;
const CONFLICT_FULL_REGEX = /<{7}\s+[\s\S]*?={7}\s*[\s\S]*?>{7}\s+[^\r\n]*/g;

/**
 * Check if text/file content contains Git merge conflict markers.
 */
export function hasGitConflictMarkers(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  return CONFLICT_MARKER_REGEX.test(content);
}

/**
 * Inspect content for Git merge conflicts and extract details.
 */
export function inspectContentForConflicts(
  content: string,
  filePath?: string
): ConflictInspectionResult {
  if (!content || typeof content !== 'string') {
    return {
      hasConflict: false,
      riskLevel: 'safe',
      conflictCount: 0,
      filePath,
      markers: [],
      requiresApproval: false,
    };
  }

  const matches = content.match(CONFLICT_FULL_REGEX);
  if (matches && matches.length > 0) {
    const snippet = matches[0].slice(0, 300);
    return {
      hasConflict: true,
      riskLevel: 'high',
      conflictCount: matches.length,
      filePath,
      markers: ['<<<<<<<', '=======', '>>>>>>>'],
      snippet,
      requiresApproval: true,
    };
  }

  // Check loose markers if full block regex didn't capture
  const lines = content.split('\n');
  const foundMarkers: string[] = [];
  for (const line of lines) {
    if (/^<{7}(\s+.*)?$/.test(line)) foundMarkers.push('<<<<<<<');
    if (/^={7}$/.test(line)) foundMarkers.push('=======');
    if (/^>{7}(\s+.*)?$/.test(line)) foundMarkers.push('>>>>>>>');
  }

  if (foundMarkers.length >= 2) {
    return {
      hasConflict: true,
      riskLevel: 'high',
      conflictCount: 1,
      filePath,
      markers: foundMarkers,
      snippet: lines.find((l) => /^<{7}/.test(l)) || foundMarkers.join(' '),
      requiresApproval: true,
    };
  }

  return {
    hasConflict: false,
    riskLevel: 'safe',
    conflictCount: 0,
    filePath,
    markers: [],
    requiresApproval: false,
  };
}

/**
 * Create a standardized SafetyInterceptEvent payload for waiting_input state.
 */
export function createSafetyInterceptEvent(
  result: SafetyInspectionResult | ConflictInspectionResult,
  extra?: Partial<SafetyInterceptEvent>
): SafetyInterceptEvent {
  const eventId = `safety-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const occurredAt = new Date().toISOString();

  if ('hasConflict' in result) {
    return {
      eventId,
      eventType: 'safety_check',
      status: 'waiting_input',
      riskLevel: result.riskLevel,
      category: 'conflict',
      reason: `Detected ${result.conflictCount} unresolved Git merge conflict marker(s)${result.filePath ? ` in ${result.filePath}` : ''}. Developer review required before proceeding.`,
      command: result.snippet || (result.filePath ? `Resolve conflict in ${result.filePath}` : 'Merge conflict'),
      details: {
        filePath: result.filePath,
        conflictCount: result.conflictCount,
        markers: result.markers,
      },
      occurredAt,
      requiresApproval: true,
      ...extra,
    };
  }

  return {
    eventId,
    eventType: 'safety_check',
    status: 'waiting_input',
    riskLevel: result.riskLevel,
    category: result.category || 'system',
    reason: result.reason || 'Dangerous command or action detected outside sandbox. Developer approval required.',
    command: result.command,
    details: {
      matchedPattern: result.matchedPattern,
    },
    occurredAt,
    requiresApproval: true,
    ...extra,
  };
}

/**
 * Creates a safety guardrail instance for checking command safety.
 */
export function createSafetyGuardrails(options: { strictMode?: boolean } = {}) {
  return {
    isDangerous: (cmd: string): boolean => isDangerousCommand(cmd),
    inspect: (cmd: string) => inspectCommand(cmd),
  };
}
