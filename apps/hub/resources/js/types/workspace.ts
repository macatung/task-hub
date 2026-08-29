export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'viewer';

export interface WorkspaceMember {
  id: number;
  name: string;
  email: string;
  github_login?: string | null;
  github_avatar_url?: string | null;
  role: WorkspaceRole;
  is_owner?: boolean;
  joined_at?: string | null;
}

export interface WorkspaceSeatsUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
}

export interface WorkspaceProps {
  id: number;
  name: string;
  slug: string;
  plan?: string;
  plan_name?: string;
  agent_concurrency_limit?: number;
  owner_id?: number;
  user_role?: WorkspaceRole | string;
}

export interface WorkspaceOption {
  id: number;
  name: string;
  slug: string;
  plan?: string;
}

export interface WorkspaceMembersPageProps {
  appName?: string;
  auth?: {
    user?: {
      id: number;
      name: string;
      email: string;
      github_login?: string | null;
      github_avatar_url?: string | null;
    } | null;
  };
  workspace: WorkspaceProps;
  members: WorkspaceMember[];
  seats: WorkspaceSeatsUsage;
  workspaces?: WorkspaceOption[];
  currentWorkspaceId?: number;
  [key: string]: any;
}

export type CredentialProvider = 'openai' | 'anthropic' | 'gemini' | 'github' | 'custom' | string;

export interface WorkspaceCredential {
  id: number;
  workspace_id: number;
  project_id?: number | null;
  project_name?: string | null;
  provider: CredentialProvider;
  name: string;
  masked_value: string;
  fingerprint: string;
  status?: 'active' | 'revoked' | string;
  last_validated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type WorkspaceSecretItem = WorkspaceCredential;

export interface CreateSecretPayload {
  provider: CredentialProvider;
  name: string;
  secret_value: string;
  project_id?: number | null;
}

export interface WorkspaceProjectOption {
  id: number;
  title: string;
  slug: string;
}

export interface WorkspaceSecretsPageProps {
  appName?: string;
  auth?: {
    user?: {
      id: number;
      name: string;
      email: string;
      github_login?: string | null;
      github_avatar_url?: string | null;
    } | null;
  };
  workspace: WorkspaceProps;
  credentials: WorkspaceCredential[];
  canAccessVault: boolean;
  projects: WorkspaceProjectOption[];
  workspaces?: WorkspaceOption[];
  currentWorkspaceId?: number;
  [key: string]: any;
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

export interface WorkspaceAnalyticsPageProps {
  appName?: string;
  auth?: {
    user?: {
      id: number;
      name: string;
      email: string;
      github_login?: string | null;
      github_avatar_url?: string | null;
    } | null;
  };
  workspace: WorkspaceProps;
  analytics: WorkspaceAnalyticsPayload;
  canAccessAnalytics: boolean;
  timeRange: '7d' | '30d' | '90d' | '1y';
  workspaces?: WorkspaceOption[];
  currentWorkspaceId?: number;
  [key: string]: any;
}

