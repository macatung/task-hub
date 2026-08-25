export type Provider = 'antigravity' | 'claude_code' | 'codex';

export interface ModelOption {
  id: string;
  name: string;
  badges?: string[];
  description?: string;
  source?: 'preset' | 'hub' | 'cli' | 'custom';
}

export const DEFAULT_PROVIDER_MODELS: Record<Provider, string> = {
  antigravity: 'gemini-3.7-flash',
  claude_code: 'claude-3-7-sonnet',
  codex: 'gpt-5',
};

export const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  antigravity: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badges: ['Flagship', 'Fast'], description: 'Latest generation model, optimized for speed and agentic reasoning', source: 'preset' },
    { id: 'gemini-3.7-pro', name: 'Gemini 3.7 Pro', badges: ['High', 'Reasoning'], description: 'Deep reasoning and multimodal intelligence for complex architecture', source: 'preset' },
    { id: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium)', badges: ['Medium', 'Fast'], description: 'Fast response for standard coding tasks', source: 'preset' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badges: ['Low'], description: 'Standard model for lightweight tasks', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Thinking'], description: 'Extended reasoning and deep source code architecture analysis', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Thinking'], description: 'Premier analysis model for complex problems', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: 'High-performance 120B open-weights model', source: 'preset' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badges: ['Recommended', '1M+ Context'], description: 'DeepMind flagship model, 1M+ context window', source: 'preset' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badges: ['Fast & Smart'], description: 'High speed with exceptional reasoning capabilities', source: 'preset' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', badges: ['Ultra Fast'], description: 'Instant response for repetitive tasks', source: 'preset' },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro Exp', badges: ['Experimental'], description: 'Experimental model for algorithms and code generation', source: 'preset' },
    { id: 'default', name: 'IDE / CLI Default', badges: ['Default'], description: 'Default Antigravity configuration', source: 'preset' },
  ],
  claude_code: [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', badges: ['High', 'Recommended', 'Flagship'], description: 'Top optimization for coding, architecture & hybrid reasoning', source: 'preset' },
    { id: 'claude-3-7-sonnet-thinking', name: 'Claude 3.7 (Thinking)', badges: ['High', 'Thinking'], description: 'Enables extended thinking for complex refactoring', source: 'preset' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', badges: ['Balanced', 'Fast'], description: 'Stable industry-standard coding model', source: 'preset' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', badges: ['Super Fast'], description: 'Super fast speed for small tasks and light refactoring', source: 'preset' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', badges: ['Deep Analysis'], description: 'Large system analysis & complex problems', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Next-Gen', 'Thinking'], description: 'Next-gen Sonnet model optimized for agentic workflows', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Deep Analysis', 'Thinking'], description: 'Large system analysis & complex logic structures', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Claude Code CLI configuration', source: 'preset' },
  ],
  codex: [
    { id: 'gpt-5', name: 'GPT-5 (Flagship)', badges: ['High', 'Flagship'], description: 'Foundational flagship model of the GPT-5 generation', source: 'preset' },
    { id: 'gpt-5-mini', name: 'GPT-5 mini', badges: ['Ultra Fast'], description: 'Compact, highly responsive model for fast edits and scripting', source: 'preset' },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', badges: ['High', 'Flagship'], description: 'Flagship GPT-5.6 model for reasoning, research & agentic coding', source: 'preset' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', badges: ['Medium', 'Fast'], description: 'Balanced intelligence and speed for production workloads', source: 'preset' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badges: ['Low', 'Ultra Fast'], description: 'Lightweight model optimized for speed and cost efficiency at scale', source: 'preset' },
    { id: 'gpt-5.6-cyber', name: 'GPT-5.6 Cyber', badges: ['Specialized', 'Security'], description: 'Specialized model for security analysis & source code audits', source: 'preset' },
    { id: 'o3-pro', name: 'o3-pro', badges: ['High', 'Deep Reasoning'], description: 'Deep extended reasoning for challenging architecture & algorithmic problems', source: 'preset' },
    { id: 'o3', name: 'o3', badges: ['High', 'Reasoning'], description: 'Powerful multi-step reasoning model from the o-series', source: 'preset' },
    { id: 'o3-mini', name: 'o3-mini', badges: ['Fast Reasoning', 'High'], description: 'High-level logical reasoning with rapid response times', source: 'preset' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', badges: ['High Quality', 'Large Context'], description: 'Deep context comprehension and complex architecture understanding', source: 'preset' },
    { id: 'gpt-4.1', name: 'GPT-4.1', badges: ['Balanced', 'Fast'], description: 'High-performance version optimized for daily coding tasks', source: 'preset' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', badges: ['Ultra Fast'], description: 'Ultra-lightweight model with high execution speed', source: 'preset' },
    { id: 'o1', name: 'o1', badges: ['Deep Reasoning'], description: 'Step-by-step reasoning for complex problem solving', source: 'preset' },
    { id: 'gpt-4o', name: 'GPT-4o', badges: ['Omni', 'Fast'], description: 'Balanced execution speed and output quality', source: 'preset' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', badges: ['Ultra Fast'], description: 'Compact model with high execution speed', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: '120B-parameter open-weights model', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Codex CLI configuration', source: 'preset' },
  ],
};

export const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  'gemini-3.7-flash': ['gemini-3.7-pro', 'gemini-3.5-flash-medium', 'gemini-3.1-pro', 'gemini-2.5-flash'],
  'gemini-3.7-flash-high': ['gemini-3.7-pro', 'gemini-3.5-flash-medium', 'gemini-3.1-pro', 'gemini-2.5-flash'],
  'gemini-3.7-pro': ['gemini-3.7-flash', 'gemini-3.5-flash-medium', 'gemini-2.5-pro'],
  'gemini-3.5-flash-medium': ['gemini-3.7-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'],
  'gemini-3.1-pro': ['gemini-3.5-flash-medium', 'gemini-2.5-flash'],
  'claude-3-7-sonnet': ['claude-3-7-sonnet-thinking', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  'claude-3-7-sonnet-20250219': ['claude-3-7-sonnet-thinking', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
  'claude-3-5-sonnet': ['claude-3-7-sonnet', 'claude-3-5-haiku'],
  'gpt-5': ['gpt-5-mini', 'gpt-5.6-sol', 'gpt-4.5-preview', 'o3-mini', 'o1'],
  'gpt-5-mini': ['gpt-5', 'gpt-4.1-mini', 'o3-mini'],
  'gpt-5.6-sol': ['gpt-5.6-terra', 'gpt-5', 'gpt-4.1', 'o3-mini'],
  'o3-mini': ['gpt-5-mini', 'gpt-4.1', 'o1'],
};

export const PROVIDER_FALLBACK_CHAINS: Record<Provider, Provider[]> = {
  antigravity: ['claude_code', 'codex'],
  claude_code: ['antigravity', 'codex'],
  codex: ['antigravity', 'claude_code'],
};

export const ANTIGRAVITY_LEGACY_ALIASES: Record<string, string> = {
  'gemini-3.7-flash': 'gemini-3.7-flash-high',
  'gemini-3.7-flash-high': 'gemini-3.7-flash-high',
  'gemini-3.7-pro': 'gemini-3.7-pro',
  'gemini-3.6-flash': 'gemini-3.6-flash-medium',
  'gemini-3.5-flash': 'gemini-3.5-flash-medium',
  'gemini-3.5-flash-medium': 'gemini-3.5-flash-medium',
  'gemini-3.1-pro': 'gemini-3.1-pro',
};

export function resolveAntigravityModelMapping(requested?: string): string | undefined {
  if (!requested || requested === 'default') return undefined;
  return ANTIGRAVITY_LEGACY_ALIASES[requested] || requested;
}
