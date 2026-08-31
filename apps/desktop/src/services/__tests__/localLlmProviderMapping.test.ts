import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_PROVIDER_ENDPOINTS,
  MODEL_OPTIONS,
  PROVIDER_MODELS,
  PROVIDER_FALLBACK_CHAINS,
  MODEL_FALLBACK_CHAINS,
  isLocalProvider,
  getLocalProviderEndpoint,
  type Provider,
} from '../../constants/models';
import {
  resolveCaoProviderModel,
  getCaoProviderCapabilities,
  formatCaoStepProviderLines,
  generateCaoStandardWorkflowYaml,
  generateCaoFastTrackWorkflowYaml,
  generateCaoEpicWorkflowYaml,
  type CaoProvider,
} from '../caoBridgeService';

describe('Milestone 4 (R4): Local LLM / Open-Weight Provider Support & MCP Integration', () => {
  describe('1. Model Registry, Local Endpoints & Open-Weight Presets', () => {
    it('supports extended Provider types including ollama and vllm', () => {
      const providers: Provider[] = ['antigravity', 'claude_code', 'codex', 'ollama', 'vllm'];
      expect(providers).toHaveLength(5);

      for (const prov of providers) {
        expect(DEFAULT_PROVIDER_MODELS[prov]).toBeDefined();
        expect(PROVIDER_MODELS[prov]).toBeDefined();
        expect(PROVIDER_FALLBACK_CHAINS[prov]).toBeDefined();
      }
    });

    it('configures default local models for ollama and vllm', () => {
      expect(DEFAULT_PROVIDER_MODELS.ollama).toBe('qwen2.5-coder:32b');
      expect(DEFAULT_PROVIDER_MODELS.vllm).toBe('deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
      expect(DEFAULT_PROVIDER_MODELS.antigravity).toBe('gemini-3.7-flash');
      expect(DEFAULT_PROVIDER_MODELS.claude_code).toBe('claude-3-7-sonnet');
      expect(DEFAULT_PROVIDER_MODELS.codex).toBe('gpt-5');
    });

    it('configures default local endpoints for ollama and vllm', () => {
      expect(DEFAULT_PROVIDER_ENDPOINTS.ollama).toBe('http://127.0.0.1:11434/v1');
      expect(DEFAULT_PROVIDER_ENDPOINTS.vllm).toBe('http://127.0.0.1:8000/v1');
      expect(DEFAULT_PROVIDER_ENDPOINTS.antigravity).toBe('');
      expect(DEFAULT_PROVIDER_ENDPOINTS.codex).toBe('');
      expect(DEFAULT_PROVIDER_ENDPOINTS.claude_code).toBe('');
    });

    it('provides isLocalProvider and getLocalProviderEndpoint helper functions', () => {
      expect(isLocalProvider('ollama')).toBe(true);
      expect(isLocalProvider('vllm')).toBe(true);
      expect(isLocalProvider('antigravity')).toBe(false);
      expect(isLocalProvider('codex')).toBe(false);
      expect(isLocalProvider('claude_code')).toBe(false);
      expect(isLocalProvider('unknown')).toBe(false);

      expect(getLocalProviderEndpoint('ollama')).toBe('http://127.0.0.1:11434/v1');
      expect(getLocalProviderEndpoint('vllm')).toBe('http://127.0.0.1:8000/v1');
      expect(getLocalProviderEndpoint('antigravity')).toBe('');
      expect(getLocalProviderEndpoint('codex')).toBe('');
      expect(getLocalProviderEndpoint('claude_code')).toBe('');
    });

    it('includes authoritative open-weight model presets in MODEL_OPTIONS', () => {
      const optionIds = MODEL_OPTIONS.map((opt) => opt.id);
      expect(optionIds).toContain('deepseek-coder-v2');
      expect(optionIds).toContain('qwen2.5-coder-32b');
      expect(optionIds).toContain('qwen2.5-coder-7b');
      expect(optionIds).toContain('llama-3.3-70b');

      const deepseek = MODEL_OPTIONS.find((opt) => opt.id === 'deepseek-coder-v2');
      expect(deepseek?.name).toBe('DeepSeek Coder V2 (Open-Weight / Local)');

      const qwen32 = MODEL_OPTIONS.find((opt) => opt.id === 'qwen2.5-coder-32b');
      expect(qwen32?.name).toBe('Qwen 2.5 Coder 32B (Ollama / vLLM)');

      const qwen7 = MODEL_OPTIONS.find((opt) => opt.id === 'qwen2.5-coder-7b');
      expect(qwen7?.name).toBe('Qwen 2.5 Coder 7B (Lightweight Local)');

      const llama70 = MODEL_OPTIONS.find((opt) => opt.id === 'llama-3.3-70b');
      expect(llama70?.name).toBe('Llama 3.3 70B Instruct (vLLM)');
    });

    it('populates PROVIDER_MODELS for local providers with rich metadata', () => {
      expect(PROVIDER_MODELS.ollama.length).toBeGreaterThanOrEqual(4);
      expect(PROVIDER_MODELS.vllm.length).toBeGreaterThanOrEqual(4);

      const ollamaIds = PROVIDER_MODELS.ollama.map((m) => m.id);
      expect(ollamaIds).toContain('qwen2.5-coder:32b');
      expect(ollamaIds).toContain('qwen2.5-coder:7b');
      expect(ollamaIds).toContain('deepseek-coder-v2');
      expect(ollamaIds).toContain('llama-3.3-70b');

      const vllmIds = PROVIDER_MODELS.vllm.map((m) => m.id);
      expect(vllmIds).toContain('deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
      expect(vllmIds).toContain('qwen2.5-coder-32b');
      expect(vllmIds).toContain('llama-3.3-70b');
    });

    it('defines fallback chains for local and open-weight models', () => {
      expect(PROVIDER_FALLBACK_CHAINS.ollama).toBeDefined();
      expect(PROVIDER_FALLBACK_CHAINS.ollama).toContain('vllm');
      expect(PROVIDER_FALLBACK_CHAINS.vllm).toBeDefined();
      expect(PROVIDER_FALLBACK_CHAINS.vllm).toContain('ollama');

      expect(MODEL_FALLBACK_CHAINS['qwen2.5-coder:32b']).toBeDefined();
      expect(MODEL_FALLBACK_CHAINS['qwen2.5-coder:32b']).toContain('qwen2.5-coder:7b');
      expect(MODEL_FALLBACK_CHAINS['deepseek-coder-v2']).toBeDefined();
    });
  });

  describe('2. CAO Bridge Integration for Local Providers', () => {
    it('resolves default models and custom requested models for CaoProvider', () => {
      expect(resolveCaoProviderModel('ollama' as CaoProvider)).toBe('qwen2.5-coder:32b');
      expect(resolveCaoProviderModel('vllm' as CaoProvider)).toBe('deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
      expect(resolveCaoProviderModel('antigravity' as CaoProvider)).toBe('gemini-3.7-flash');
      expect(resolveCaoProviderModel('codex' as CaoProvider)).toBe('gpt-5');

      expect(resolveCaoProviderModel('ollama', 'deepseek-coder-v2')).toBe('deepseek-coder-v2');
      expect(resolveCaoProviderModel('vllm', 'Qwen/Qwen2.5-Coder-32B-Instruct')).toBe('Qwen/Qwen2.5-Coder-32B-Instruct');
    });

    it('returns capabilities matching local and open-weight execution', () => {
      const ollamaCaps = getCaoProviderCapabilities('ollama');
      expect(ollamaCaps).toContain('local_execution');
      expect(ollamaCaps).toContain('offline_mode');
      expect(ollamaCaps).toContain('handoff');
      expect(ollamaCaps).toContain('assign');

      const vllmCaps = getCaoProviderCapabilities('vllm');
      expect(vllmCaps).toContain('local_execution');
      expect(vllmCaps).toContain('high_throughput');
      expect(vllmCaps).toContain('handoff');
      expect(vllmCaps).toContain('assign');
    });

    it('formats CAO step provider lines with OPENAI_BASE_URL and MODEL routing', () => {
      const ollamaLines = formatCaoStepProviderLines('ollama');
      expect(ollamaLines).toContain('    provider: ollama');
      expect(ollamaLines).toContain('    model: qwen2.5-coder:32b');
      expect(ollamaLines).toContain('    env:');
      expect(ollamaLines).toContain('      OPENAI_BASE_URL: http://127.0.0.1:11434/v1');
      expect(ollamaLines).toContain('      MODEL: qwen2.5-coder:32b');

      const vllmLines = formatCaoStepProviderLines('vllm', {
        model: 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct',
        endpoint: 'http://127.0.0.1:8000/v1',
      });
      expect(vllmLines).toContain('    provider: vllm');
      expect(vllmLines).toContain('    model: deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
      expect(vllmLines).toContain('      OPENAI_BASE_URL: http://127.0.0.1:8000/v1');
      expect(vllmLines).toContain('      MODEL: deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');

      const cloudLines = formatCaoStepProviderLines('antigravity');
      expect(cloudLines).toEqual(['    provider: antigravity']);
    });
  });

  describe('3. CAO Workflow YAML Generation with Local LLM Providers', () => {
    it('generates standard 4-step workflow YAML with ollama provider mapping', () => {
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'LOCAL-101',
        taskTitle: 'Local Coding Task via Ollama',
        taskDescription: 'Implement local feature using open-weight model',
        implementProvider: 'ollama',
        reviewProvider: 'ollama',
        evidenceProvider: 'ollama',
        handoffProvider: 'ollama',
      });

      expect(yaml).toContain('name: task-LOCAL-101-pipeline');
      expect(yaml).toContain('- id: implement');
      expect(yaml).toContain('provider: ollama');
      expect(yaml).toContain('model: qwen2.5-coder:32b');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:11434/v1');
      expect(yaml).toContain('MODEL: qwen2.5-coder:32b');
      expect(yaml).toContain('- id: review');
      expect(yaml).toContain('- id: evidence');
      expect(yaml).toContain('- id: handoff');
      expect(yaml).toContain('workflow_return');
    });

    it('generates standard 4-step workflow YAML with vllm provider mapping', () => {
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'VLLM-202',
        taskTitle: 'High Throughput Local Inference',
        taskDescription: 'Execute tasks on local vLLM endpoint',
        implementProvider: 'vllm',
        reviewProvider: 'vllm',
        evidenceProvider: 'vllm',
        handoffProvider: 'vllm',
      });

      expect(yaml).toContain('name: task-VLLM-202-pipeline');
      expect(yaml).toContain('provider: vllm');
      expect(yaml).toContain('model: deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:8000/v1');
      expect(yaml).toContain('MODEL: deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct');
    });

    it('supports heterogeneous hybrid orchestration across cloud and local providers', () => {
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'HYBRID-303',
        taskTitle: 'Hybrid Cloud-Local Task',
        taskDescription: 'Implement locally with Ollama, review with Codex, test with vLLM, handoff with Antigravity',
        implementProvider: 'ollama',
        reviewProvider: 'codex',
        evidenceProvider: 'vllm',
        handoffProvider: 'antigravity',
      });

      expect(yaml).toContain('provider: ollama');
      expect(yaml).toContain('provider: codex');
      expect(yaml).toContain('provider: vllm');
      expect(yaml).toContain('provider: antigravity');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:11434/v1');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:8000/v1');
    });

    it('generates Fast-Track 2-step workflow YAML for local providers', () => {
      const yaml = generateCaoFastTrackWorkflowYaml({
        taskKey: 'FAST-404',
        taskTitle: 'Quick Local Bugfix',
        taskDescription: 'Fix local typo using Ollama',
        implementProvider: 'ollama',
        evidenceProvider: 'ollama',
      });

      expect(yaml).toContain('name: task-FAST-404-pipeline');
      expect(yaml).toContain('- id: implement');
      expect(yaml).toContain('provider: ollama');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:11434/v1');
      expect(yaml).toContain('- id: evidence');
      expect(yaml).toContain('<!-- HANDOFF:START -->');
      expect(yaml).toContain('<TASK_HUB_HANDOFF>');
    });

    it('generates Epic workflow YAML with local provider steps and finalize step', () => {
      const { yaml, order } = generateCaoEpicWorkflowYaml({
        epic: { id: 88, issue_key: 'EPIC-88', title: 'Local LLM Support Epic' },
        childTasks: [
          { id: 1, issue_key: 'TASK-1', title: 'Setup Ollama Engine', status: 'todo' },
          { id: 2, issue_key: 'TASK-2', title: 'Setup vLLM Server', status: 'todo', dependencies: [{ depends_on_task_id: 1 }] },
        ],
        provider: 'ollama',
      });

      expect(order.ok).toBe(true);
      expect(yaml).toContain('name: epic-88-pipeline');
      expect(yaml).toContain('id: child-1-1-implement');
      expect(yaml).toContain('provider: ollama');
      expect(yaml).toContain('OPENAI_BASE_URL: http://127.0.0.1:11434/v1');
      expect(yaml).toContain('id: child-2-2-implement');
      expect(yaml).toContain('id: epic-finalize');
    });
  });

  describe('4. Offline / Air-Gapped Compatibility', () => {
    it('uses localhost/loopback IP endpoints to guarantee offline availability', () => {
      const ollamaEndpoint = getLocalProviderEndpoint('ollama');
      const vllmEndpoint = getLocalProviderEndpoint('vllm');

      expect(ollamaEndpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v1$/);
      expect(vllmEndpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/v1$/);
    });

    it('supports custom air-gapped intranet endpoints in workflow options', () => {
      const customEndpoints = {
        ollama: 'http://192.168.1.50:11434/v1',
        vllm: 'http://ai-server.internal:8000/v1',
      };

      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'AIRGAP-505',
        taskTitle: 'Air-Gapped Enterprise Deployment',
        taskDescription: 'Run tasks in isolated corporate network',
        implementProvider: 'ollama',
        reviewProvider: 'vllm',
        providerEndpoints: customEndpoints,
      });

      expect(yaml).toContain('OPENAI_BASE_URL: http://192.168.1.50:11434/v1');
      expect(yaml).toContain('OPENAI_BASE_URL: http://ai-server.internal:8000/v1');
    });
  });
});
