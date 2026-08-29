/**
 * Commercial Plan Feature Simulators & Test Doubles
 * Provides shared simulator classes for:
 *   - Workspace Members & RBAC (Features 1 & 2)
 *   - Team Credential Vault & Shared Secrets (Features 3 & 4)
 *   - Retention Pruning Engine & Scheduler (Features 5 & 6)
 *   - Velocity Analytics & Plan Gating (Features 7 & 8)
 */

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  user: {
    id: number;
    name: string;
    email: string;
    github_username?: string | null;
    avatar_url?: string | null;
  };
  invited_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSeatsInfo {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  plan: string;
}

export class WorkspaceMemberStoreSimulator {
  private members: WorkspaceMember[] = [];
  private seatLimit: number = 5;
  private currentPlan: string = 'team';
  public upgradeModalOpened: boolean = false;
  public lastUpgradePayload: any = null;

  constructor(initialMembers: WorkspaceMember[] = [], limit = 5, plan = 'team') {
    this.members = initialMembers.map((m) => ({ ...m, user: { ...m.user } }));
    this.seatLimit = limit;
    this.currentPlan = plan;
  }

  getSeatsInfo(): WorkspaceSeatsInfo {
    const used = this.members.length;
    const remaining = Math.max(0, this.seatLimit - used);
    const percentage = this.seatLimit > 0 ? Math.min(100, Math.round((used / this.seatLimit) * 100)) : 100;
    return {
      used,
      limit: this.seatLimit,
      remaining,
      percentage,
      plan: this.currentPlan,
    };
  }

  getMembers(filter?: { search?: string; role?: string }): WorkspaceMember[] {
    return this.members.filter((m) => {
      if (filter?.role && filter.role !== 'all' && m.role !== filter.role) {
        return false;
      }
      if (filter?.search) {
        const query = filter.search.toLowerCase().trim();
        const nameMatch = m.user.name.toLowerCase().includes(query);
        const emailMatch = m.user.email.toLowerCase().includes(query);
        const githubMatch = m.user.github_username?.toLowerCase().includes(query) ?? false;
        if (!nameMatch && !emailMatch && !githubMatch) {
          return false;
        }
      }
      return true;
    });
  }

  inviteMember(
    currentUserRole: 'owner' | 'admin' | 'developer' | 'viewer',
    payload: { email_or_username: string; role: 'admin' | 'developer' | 'viewer' }
  ): { status: number; data?: WorkspaceMember; error?: string; error_code?: string; quota?: any } {
    // 1. Check permissions
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      return {
        status: 403,
        error: 'Unauthorized. Only workspace owners and admins can invite members.',
        error_code: 'UNAUTHORIZED_ACTION',
      };
    }

    // 2. Validate input
    const identifier = payload.email_or_username?.trim();
    if (!identifier || identifier.length < 3) {
      return {
        status: 422,
        error: 'A valid email or GitHub username is required.',
        error_code: 'VALIDATION_ERROR',
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const githubRegex = /^[a-zA-Z0-9_-]{1,39}$/;
    const isEmail = emailRegex.test(identifier);
    const isGithub = githubRegex.test(identifier);

    if (!isEmail && !isGithub) {
      return {
        status: 422,
        error: 'Identifier must be a valid email or GitHub handle.',
        error_code: 'INVALID_IDENTIFIER_FORMAT',
      };
    }

    // 3. Check for existing member
    const existing = this.members.find(
      (m) =>
        m.user.email.toLowerCase() === identifier.toLowerCase() ||
        (m.user.github_username && m.user.github_username.toLowerCase() === identifier.toLowerCase())
    );
    if (existing) {
      return {
        status: 422,
        error: 'User is already a member of this workspace.',
        error_code: 'USER_ALREADY_MEMBER',
      };
    }

    // 4. Check seat quota
    if (this.members.length >= this.seatLimit) {
      const quotaPayload = {
        resource: 'seats',
        current_usage: this.members.length,
        limit: this.seatLimit,
        current_plan: this.currentPlan,
        suggested_plan: this.currentPlan === 'community' ? 'pro' : 'enterprise',
        upgrade_url: '/workspaces/billing',
        message: `Seat quota exceeded (${this.members.length}/${this.seatLimit}). Please upgrade your plan or purchase extra seats.`,
      };
      this.upgradeModalOpened = true;
      this.lastUpgradePayload = quotaPayload;
      return {
        status: 422,
        error: quotaPayload.message,
        error_code: 'PLAN_QUOTA_EXCEEDED',
        quota: quotaPayload,
      };
    }

    // 5. Create membership
    const newMember: WorkspaceMember = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      workspace_id: 101,
      user_id: 200 + this.members.length + 1,
      role: payload.role,
      user: {
        id: 200 + this.members.length + 1,
        name: isGithub ? identifier : identifier.split('@')[0],
        email: isEmail ? identifier : `${identifier}@users.noreply.github.com`,
        github_username: isGithub ? identifier : null,
        avatar_url: `https://avatars.example.com/${encodeURIComponent(identifier)}`,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.members.push(newMember);
    return { status: 201, data: newMember };
  }

  updateRole(
    currentUserRole: 'owner' | 'admin' | 'developer' | 'viewer',
    memberId: number,
    newRole: 'admin' | 'developer' | 'viewer'
  ): { status: number; data?: WorkspaceMember; error?: string } {
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      return { status: 403, error: 'Only owners and admins can modify member roles.' };
    }

    const member = this.members.find((m) => m.id === memberId);
    if (!member) {
      return { status: 404, error: 'Member not found.' };
    }

    if (member.role === 'owner') {
      return { status: 403, error: 'Workspace owner role cannot be altered.' };
    }

    member.role = newRole;
    member.updated_at = new Date().toISOString();
    return { status: 200, data: member };
  }

  revokeMember(
    currentUserRole: 'owner' | 'admin' | 'developer' | 'viewer',
    memberId: number
  ): { status: number; success: boolean; error?: string } {
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      return { status: 403, success: false, error: 'Only owners and admins can revoke member access.' };
    }

    const index = this.members.findIndex((m) => m.id === memberId);
    if (index === -1) {
      return { status: 404, success: false, error: 'Member not found.' };
    }

    if (this.members[index].role === 'owner') {
      return { status: 403, success: false, error: 'Cannot remove the workspace owner.' };
    }

    this.members.splice(index, 1);
    return { status: 200, success: true };
  }

  setSeatLimit(newLimit: number) {
    this.seatLimit = newLimit;
  }
}

export interface WorkspaceCredential {
  id: number;
  workspace_id: number;
  project_id?: number | null;
  provider: 'openai' | 'anthropic' | 'gemini' | 'github' | 'custom' | string;
  name: string;
  masked_value: string;
  fingerprint: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export class CredentialVaultSimulator {
  private secrets: Map<number, { meta: WorkspaceCredential; secret_value: string }> = new Map();
  private nextId = 1;
  public currentPlan: string = 'team';

  constructor(plan = 'team') {
    this.currentPlan = plan;
  }

  private generateFingerprint(secret: string): string {
    let hash = 0;
    for (let i = 0; i < secret.length; i++) {
      hash = (hash << 5) - hash + secret.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `sha256_${hex.slice(0, 8)}...${hex.slice(-4)}`;
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '••••••••';
    }
    const prefix = secret.slice(0, 3);
    const suffix = secret.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }

  getCredentials(
    userRole: string,
    projectId?: number | null
  ): { status: number; data?: WorkspaceCredential[]; error?: string; error_code?: string } {
    if (this.currentPlan !== 'team' && this.currentPlan !== 'enterprise') {
      return {
        status: 403,
        error: 'Team Credential Vault is only available on Team and Enterprise plans. Please upgrade.',
        error_code: 'UPGRADE_REQUIRED',
      };
    }

    const list: WorkspaceCredential[] = [];
    for (const entry of this.secrets.values()) {
      if (projectId && entry.meta.project_id && entry.meta.project_id !== projectId) {
        continue;
      }
      list.push({ ...entry.meta });
    }

    return { status: 200, data: list };
  }

  storeCredential(
    userRole: string,
    payload: {
      provider: string;
      name: string;
      secret_value: string;
      project_id?: number | null;
    }
  ): { status: number; data?: WorkspaceCredential; error?: string; error_code?: string } {
    if (this.currentPlan !== 'team' && this.currentPlan !== 'enterprise') {
      return {
        status: 403,
        error: 'Shared secret storage requires Team or Enterprise plan.',
        error_code: 'UPGRADE_REQUIRED',
      };
    }

    if (userRole === 'viewer') {
      return {
        status: 403,
        error: 'Viewers cannot create credentials in the Team Vault.',
        error_code: 'UNAUTHORIZED_ACTION',
      };
    }

    if (!payload.name || payload.name.trim().length === 0) {
      return { status: 422, error: 'Credential name is required.', error_code: 'VALIDATION_ERROR' };
    }
    if (!payload.secret_value || payload.secret_value.trim().length === 0) {
      return { status: 422, error: 'Secret value is required.', error_code: 'VALIDATION_ERROR' };
    }

    const normalizedProjectId = payload.project_id ?? null;
    for (const existing of this.secrets.values()) {
      const existingProj = existing.meta.project_id ?? null;
      if (
        existing.meta.name.toLowerCase() === payload.name.trim().toLowerCase() &&
        existingProj === normalizedProjectId
      ) {
        return {
          status: 422,
          error: 'A credential with this name already exists in this scope.',
          error_code: 'DUPLICATE_CREDENTIAL_NAME',
        };
      }
    }

    const id = this.nextId++;
    const meta: WorkspaceCredential = {
      id,
      workspace_id: 101,
      project_id: payload.project_id ?? null,
      provider: payload.provider.toLowerCase(),
      name: payload.name.trim(),
      masked_value: this.maskSecret(payload.secret_value),
      fingerprint: this.generateFingerprint(payload.secret_value),
      created_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.secrets.set(id, {
      meta,
      secret_value: payload.secret_value,
    });

    return { status: 201, data: meta };
  }

  revealCredential(
    userRole: string,
    credentialId: number
  ): { status: number; secret_value?: string; error?: string; error_code?: string } {
    if (this.currentPlan !== 'team' && this.currentPlan !== 'enterprise') {
      return { status: 403, error: 'Upgrade required.', error_code: 'UPGRADE_REQUIRED' };
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      return {
        status: 403,
        error: 'Only workspace owners and admins are authorized to reveal secret values.',
        error_code: 'UNAUTHORIZED_REVEAL',
      };
    }

    const item = this.secrets.get(credentialId);
    if (!item) {
      return { status: 404, error: 'Credential not found.', error_code: 'NOT_FOUND' };
    }

    return { status: 200, secret_value: item.secret_value };
  }

  deleteCredential(
    userRole: string,
    credentialId: number
  ): { status: number; success: boolean; error?: string } {
    if (userRole !== 'owner' && userRole !== 'admin') {
      return { status: 403, success: false, error: 'Only owners and admins can delete credentials.' };
    }

    if (!this.secrets.has(credentialId)) {
      return { status: 404, success: false, error: 'Credential not found.' };
    }

    this.secrets.delete(credentialId);
    return { status: 200, success: true };
  }
}

export interface SimulatedAgentRun {
  id: number;
  workspace_id: number;
  task_id: number;
  status:
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'timeout'
    | 'needs_review'
    | 'rejected'
    | 'queued'
    | 'claimed'
    | 'preparing'
    | 'running'
    | 'waiting_input';
  created_at: Date;
  updated_at: Date;
  logs_count: number;
  events_count: number;
  evidence_count: number;
}

export const PROTECTED_AGENT_STATUSES = [
  'queued',
  'claimed',
  'preparing',
  'running',
  'waiting_input',
];

export const PLAN_RETENTION_RULES: Record<string, number> = {
  community: 7,
  pro: 90,
  team: 365,
  enterprise: 730,
};

export class RetentionPruningEngineSimulator {
  public runs: SimulatedAgentRun[] = [];
  public cascadingLogs: Map<number, number> = new Map();
  public cascadingEvents: Map<number, number> = new Map();
  public cascadingEvidence: Map<number, number> = new Map();
  public workspaces: Map<number, { id: number; name: string; plan_slug: string }> = new Map();

  constructor() {
    this.workspaces.set(1, { id: 1, name: 'Community Workspace', plan_slug: 'community' });
    this.workspaces.set(2, { id: 2, name: 'Pro Workspace', plan_slug: 'pro' });
    this.workspaces.set(3, { id: 3, name: 'Team Workspace', plan_slug: 'team' });
    this.workspaces.set(4, { id: 4, name: 'Enterprise Workspace', plan_slug: 'enterprise' });
  }

  addRun(run: {
    id: number;
    workspace_id: number;
    task_id: number;
    status:
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'timeout'
      | 'needs_review'
      | 'rejected'
      | 'queued'
      | 'claimed'
      | 'preparing'
      | 'running'
      | 'waiting_input';
    daysOld: number;
    logs?: number;
    events?: number;
    evidence?: number;
  }) {
    const createdAt = new Date(Date.now() - run.daysOld * 24 * 60 * 60 * 1000);
    const item: SimulatedAgentRun = {
      id: run.id,
      workspace_id: run.workspace_id,
      task_id: run.task_id,
      status: run.status,
      created_at: createdAt,
      updated_at: createdAt,
      logs_count: run.logs ?? 5,
      events_count: run.events ?? 10,
      evidence_count: run.evidence ?? 1,
    };
    this.runs.push(item);
    this.cascadingLogs.set(run.id, item.logs_count);
    this.cascadingEvents.set(run.id, item.events_count);
    this.cascadingEvidence.set(run.id, item.evidence_count);
  }

  prune(options: { workspaceId?: number; days?: number; dryRun?: boolean; referenceTime?: Date; chunkSize?: number } = {}): {
    exitCode: number;
    scannedWorkspaces: number;
    deletedRuns: number;
    deletedLogs: number;
    deletedEvents: number;
    deletedEvidence: number;
    dryRun: boolean;
    logsOutput: string[];
  } {
    const refTime = options.referenceTime ?? new Date();
    const isDryRun = Boolean(options.dryRun);
    const logsOutput: string[] = [];

    logsOutput.push(`[RetentionPrune] Starting retention pruning process at ${refTime.toISOString()} (dry-run: ${isDryRun})...`);

    let totalDeletedRuns = 0;
    let totalDeletedLogs = 0;
    let totalDeletedEvents = 0;
    let totalDeletedEvidence = 0;
    let scannedCount = 0;

    const targetWorkspaces = options.workspaceId
      ? [this.workspaces.get(options.workspaceId)].filter(Boolean)
      : Array.from(this.workspaces.values());

    if (options.workspaceId && targetWorkspaces.length === 0) {
      return {
        exitCode: 1,
        scannedWorkspaces: 0,
        deletedRuns: 0,
        deletedLogs: 0,
        deletedEvents: 0,
        deletedEvidence: 0,
        dryRun: isDryRun,
        logsOutput: [`[Error] Workspace with ID ${options.workspaceId} not found.`],
      };
    }

    for (const ws of targetWorkspaces) {
      if (!ws) continue;
      scannedCount++;
      const retentionDays = options.days ?? PLAN_RETENTION_RULES[ws.plan_slug] ?? 7;
      const cutoffTime = new Date(refTime.getTime() - retentionDays * 24 * 60 * 60 * 1000);

      const expiredRuns = this.runs.filter((r) => {
        if (r.workspace_id !== ws.id) return false;
        if (PROTECTED_AGENT_STATUSES.includes(r.status)) return false;
        return r.created_at.getTime() < cutoffTime.getTime();
      });

      logsOutput.push(
        `[RetentionPrune] Workspace #${ws.id} (${ws.name}) [Plan: ${ws.plan_slug}, Retention: ${retentionDays}d]: Found ${expiredRuns.length} expired runs.`
      );

      for (const run of expiredRuns) {
        totalDeletedRuns++;
        totalDeletedLogs += this.cascadingLogs.get(run.id) || 0;
        totalDeletedEvents += this.cascadingEvents.get(run.id) || 0;
        totalDeletedEvidence += this.cascadingEvidence.get(run.id) || 0;

        if (!isDryRun) {
          this.cascadingLogs.delete(run.id);
          this.cascadingEvents.delete(run.id);
          this.cascadingEvidence.delete(run.id);
        }
      }

      if (!isDryRun && expiredRuns.length > 0) {
        const expiredIds = new Set(expiredRuns.map((r) => r.id));
        this.runs = this.runs.filter((r) => !expiredIds.has(r.id));
      }
    }

    logsOutput.push(
      `[RetentionPrune] Finished. Total runs pruned: ${totalDeletedRuns}, cascade logs: ${totalDeletedLogs}, events: ${totalDeletedEvents}, evidence: ${totalDeletedEvidence}.`
    );

    return {
      exitCode: 0,
      scannedWorkspaces: scannedCount,
      deletedRuns: totalDeletedRuns,
      deletedLogs: totalDeletedLogs,
      deletedEvents: totalDeletedEvents,
      deletedEvidence: totalDeletedEvidence,
      dryRun: isDryRun,
      logsOutput,
    };
  }
}

export interface AnalyticsThroughput {
  total_tasks_completed: number;
  velocity_points_per_week: number;
  run_throughput_24h: number;
  throughput_history: { date: string; count: number }[];
}

export interface AnalyticsSuccessRate {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  cancelled_runs: number;
  success_percentage: number;
  failure_reasons: { reason: string; count: number }[];
}

export interface AnalyticsAiModels {
  total_model_invocations: number;
  distribution: { model: string; count: number; percentage: number; tokens_used: number }[];
}

export interface AnalyticsTurnaroundTime {
  avg_run_duration_seconds: number;
  p95_duration_seconds: number;
  avg_queue_wait_seconds: number;
  avg_review_turnaround_seconds: number;
}

export interface WorkspaceAnalyticsPayload {
  workspace_id: number;
  plan: string;
  time_range: '7d' | '30d' | '90d' | '1y';
  throughput: AnalyticsThroughput;
  success_rate: AnalyticsSuccessRate;
  ai_models: AnalyticsAiModels;
  turnaround_time: AnalyticsTurnaroundTime;
}

export class WorkspaceAnalyticsServiceSimulator {
  public currentPlan: string = 'team';

  constructor(plan = 'team') {
    this.currentPlan = plan;
  }

  getAnalytics(
    workspaceId: number,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d',
    hasRuns = true
  ): { status: number; data?: WorkspaceAnalyticsPayload; error?: string; error_code?: string } {
    if (this.currentPlan !== 'team' && this.currentPlan !== 'enterprise') {
      return {
        status: 403,
        error: 'Team Velocity & Analytics Dashboard is an exclusive Team and Enterprise feature.',
        error_code: 'UPGRADE_REQUIRED',
      };
    }

    if (!hasRuns) {
      return {
        status: 200,
        data: {
          workspace_id: workspaceId,
          plan: this.currentPlan,
          time_range: timeRange,
          throughput: {
            total_tasks_completed: 0,
            velocity_points_per_week: 0,
            run_throughput_24h: 0,
            throughput_history: [],
          },
          success_rate: {
            total_runs: 0,
            successful_runs: 0,
            failed_runs: 0,
            cancelled_runs: 0,
            success_percentage: 0,
            failure_reasons: [],
          },
          ai_models: {
            total_model_invocations: 0,
            distribution: [],
          },
          turnaround_time: {
            avg_run_duration_seconds: 0,
            p95_duration_seconds: 0,
            avg_queue_wait_seconds: 0,
            avg_review_turnaround_seconds: 0,
          },
        },
      };
    }

    return {
      status: 200,
      data: {
        workspace_id: workspaceId,
        plan: this.currentPlan,
        time_range: timeRange,
        throughput: {
          total_tasks_completed: 142,
          velocity_points_per_week: 28.5,
          run_throughput_24h: 36,
          throughput_history: [
            { date: '2026-08-20', count: 18 },
            { date: '2026-08-21', count: 24 },
            { date: '2026-08-22', count: 30 },
            { date: '2026-08-23', count: 28 },
            { date: '2026-08-24', count: 35 },
            { date: '2026-08-25', count: 42 },
            { date: '2026-08-26', count: 36 },
          ],
        },
        success_rate: {
          total_runs: 480,
          successful_runs: 456,
          failed_runs: 18,
          cancelled_runs: 6,
          success_percentage: 95.0,
          failure_reasons: [
            { reason: 'Linter / TypeCheck Failure', count: 10 },
            { reason: 'API Rate Limit (HTTP 429)', count: 5 },
            { reason: 'Safety Interception Blocked', count: 3 },
          ],
        },
        ai_models: {
          total_model_invocations: 850,
          distribution: [
            { model: 'Gemini 2.5 Pro', count: 425, percentage: 50.0, tokens_used: 1250000 },
            { model: 'Claude 3.7 Sonnet', count: 255, percentage: 30.0, tokens_used: 890000 },
            { model: 'Codex / GPT-4o', count: 170, percentage: 20.0, tokens_used: 540000 },
          ],
        },
        turnaround_time: {
          avg_run_duration_seconds: 4.8,
          p95_duration_seconds: 12.2,
          avg_queue_wait_seconds: 0.8,
          avg_review_turnaround_seconds: 180,
        },
      },
    };
  }
}
