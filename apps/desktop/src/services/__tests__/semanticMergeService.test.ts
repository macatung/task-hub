import { describe, it, expect, vi } from 'vitest';
import {
  resolveFileConflict,
  mergeEpicWorktrees,
  EpicMergeOptions,
} from '../semanticMergeService';
import {
  buildConflictResolutionPrompt,
  validateCodeSyntax,
  parseAiResolutionResponse,
  AiLlmCaller,
} from '../aiSemanticConflictResolver';

describe('semanticMergeService - 3-Tier AI Semantic Merge & Verification Gate', () => {
  describe('aiSemanticConflictResolver', () => {
    it('builds structured prompt with acceptance criteria and conflict context', () => {
      const prompt = buildConflictResolutionPrompt({
        filePath: 'src/services/billing.ts',
        kind: 'FunctionDeclaration',
        identifier: 'calculateInvoice',
        baseCode: 'function calculateInvoice() { return 100; }',
        oursCode: 'function calculateInvoice() { return 100 + 10; }',
        theirsCode: 'function calculateInvoice() { return 100 * 0.9; }',
        acceptanceCriteria: ['Apply discount before adding tax'],
        oursTaskTitle: 'TASK-101 (Tax addition)',
        theirsTaskTitle: 'TASK-102 (Discount handling)',
      });

      expect(prompt.filePath).toBe('src/services/billing.ts');
      expect(prompt.userPrompt).toContain('calculateInvoice');
      expect(prompt.userPrompt).toContain('Apply discount before adding tax');
      expect(prompt.userPrompt).toContain('TASK-101');
      expect(prompt.userPrompt).toContain('TASK-102');
      expect(prompt.systemPrompt).toContain('compiler specialist');
    });

    it('validates syntax using TypeScript compiler and reports diagnostics', () => {
      const validCode = `export function greet(name: string): string { return 'Hello ' + name; }`;
      const validCheck = validateCodeSyntax(validCode);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.errors).toHaveLength(0);

      const invalidCode = `export function greet(name: string { return 123;`;
      const invalidCheck = validateCodeSyntax(invalidCode);
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.errors.length).toBeGreaterThan(0);
    });

    it('parses JSON responses wrapped in markdown code blocks correctly', () => {
      const rawJson = '```json\n{\n  "resolvedCode": "const x = 1;",\n  "explanation": "Merged safely",\n  "confidenceScore": 0.98\n}\n```';
      const parsed = parseAiResolutionResponse(rawJson);
      expect(parsed.resolvedCode).toBe('const x = 1;');
      expect(parsed.explanation).toBe('Merged safely');
      expect(parsed.confidenceScore).toBe(0.98);
    });
  });

  describe('resolveFileConflict', () => {
    it('resolves TypeScript file cleanly using Tier 1 AST when changes are non-overlapping', async () => {
      const baseContent = `
import { ref } from 'vue';

export interface Config {
  apiUrl: string;
}

export function initialize(): void {
  console.log('init');
}
`;

      const oursContent = `
import { ref, computed } from 'vue';

export interface Config {
  apiUrl: string;
  timeoutMs: number;
}

export function initialize(): void {
  console.log('init');
}
`;

      const theirsContent = `
import { ref } from 'vue';
import axios from 'axios';

export interface Config {
  apiUrl: string;
  retries: number;
}

export function initialize(): void {
  console.log('init');
}

export function ping(): boolean {
  return true;
}
`;

      const res = await resolveFileConflict({
        filePath: 'src/config.ts',
        baseContent,
        oursContent,
        theirsContent,
      });

      expect(res.status).toBe('resolved');
      expect(res.resolutionTier).toBe('tier1_ast');
      expect(res.syntaxValid).toBe(true);
      expect(res.conflictsCount).toBe(0);
      expect(res.mergedContent).toContain('timeoutMs: number;');
      expect(res.mergedContent).toContain('retries: number;');
      expect(res.mergedContent).toContain('function ping');
      expect(res.mergedContent).toContain(`import axios from 'axios';`);
    });

    it('falls back to Tier 2 AI when overlapping function conflict occurs and applies validated AI resolution', async () => {
      const baseContent = `
export function processOrder(amount: number): number {
  return amount;
}
`;

      const oursContent = `
export function processOrder(amount: number): number {
  const tax = amount * 0.1;
  return amount + tax;
}
`;

      const theirsContent = `
export function processOrder(amount: number): number {
  const discount = amount > 100 ? 10 : 0;
  return amount - discount;
}
`;

      const mockLlmCaller: AiLlmCaller = vi.fn().mockResolvedValue(
        JSON.stringify({
          resolvedCode: `export function processOrder(amount: number): number {\n  const discount = amount > 100 ? 10 : 0;\n  const discounted = amount - discount;\n  const tax = discounted * 0.1;\n  return discounted + tax;\n}`,
          explanation: 'Synthesized order processing to compute discount first, then apply tax to the discounted subtotal.',
          confidenceScore: 0.99,
        })
      );

      const res = await resolveFileConflict({
        filePath: 'src/services/orderService.ts',
        baseContent,
        oursContent,
        theirsContent,
        acceptanceCriteria: ['Compute discount before tax'],
        llmCaller: mockLlmCaller,
      });

      expect(res.status).toBe('resolved');
      expect(res.resolutionTier).toBe('tier2_ai');
      expect(res.syntaxValid).toBe(true);
      expect(res.tierDetails.tier2Attempted).toBe(true);
      expect(res.tierDetails.tier2Success).toBe(true);
      expect(res.mergedContent).toContain('discounted + tax');
      expect(mockLlmCaller).toHaveBeenCalled();
    });

    it('rejects AI output containing residual Git conflict markers', async () => {
      const baseContent = `export function compute(): number { return 0; }`;
      const oursContent = `export function compute(): number { return 1; }`;
      const theirsContent = `export function compute(): number { return 2; }`;

      const faultyLlmCaller: AiLlmCaller = vi.fn().mockResolvedValue(
        JSON.stringify({
          resolvedCode: `<<<<<<< HEAD\nexport function compute(): number { return 1; }\n=======\nexport function compute(): number { return 2; }\n>>>>>>> theirs`,
          explanation: 'Inserted conflict markers',
          confidenceScore: 0.1,
        })
      );

      const res = await resolveFileConflict({
        filePath: 'src/compute.ts',
        baseContent,
        oursContent,
        theirsContent,
        llmCaller: faultyLlmCaller,
      });

      expect(res.status).not.toBe('resolved');
      expect(res.unresolvedConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('mergeEpicWorktrees - Orchestrator & Tier 3 Gate', () => {
    it('successfully merges multiple worktree files and verifies with Tier 3 test runner gate', async () => {
      const options: EpicMergeOptions = {
        targetWorktreePath: '/tmp/worktree-epic-101',
        files: [
          {
            filePath: 'package.json',
            baseContent: JSON.stringify({ name: 'app', dependencies: { vue: '^3.5.0' } }, null, 2),
            oursContent: JSON.stringify({ name: 'app', dependencies: { vue: '^3.5.0', pinia: '^2.1.0' } }, null, 2),
            theirsContent: JSON.stringify({ name: 'app', dependencies: { vue: '^3.5.0', axios: '^1.7.0' } }, null, 2),
          },
          {
            filePath: 'src/types.ts',
            baseContent: 'export interface User { id: string; }',
            oursContent: 'export interface User { id: string; name: string; }',
            theirsContent: 'export interface User { id: string; email: string; }',
          },
        ],
        testRunner: vi.fn().mockResolvedValue({
          success: true,
          output: 'Vitest passed: 42/42 tests passing',
          testsPassed: 42,
          testsFailed: 0,
          durationMs: 350,
        }),
      };

      const result = await mergeEpicWorktrees(options);

      expect(result.status).toBe('verified');
      expect(result.totalFiles).toBe(2);
      expect(result.resolvedFiles).toBe(2);
      expect(result.tier1AstResolvedFiles).toBe(2);
      expect(result.unresolvedFiles).toBe(0);
      expect(result.testVerification?.success).toBe(true);
      expect(result.summary).toContain('All verification tests passed');
      expect(options.testRunner).toHaveBeenCalled();
    });

    it('marks merge as test_failed when Tier 3 test runner fails post-merge verification', async () => {
      const options: EpicMergeOptions = {
        targetWorktreePath: '/tmp/worktree-epic-102',
        files: [
          {
            filePath: 'package.json',
            baseContent: JSON.stringify({ name: 'app' }, null, 2),
            oursContent: JSON.stringify({ name: 'app', version: '1.0.1' }, null, 2),
            theirsContent: JSON.stringify({ name: 'app', version: '1.0.1' }, null, 2),
          },
        ],
        testRunner: vi.fn().mockResolvedValue({
          success: false,
          output: 'Vitest failed: Expected 100 received 200 in billing.test.ts',
          testsPassed: 40,
          testsFailed: 2,
        }),
      };

      const result = await mergeEpicWorktrees(options);

      expect(result.status).toBe('test_failed');
      expect(result.testVerification?.success).toBe(false);
      expect(result.summary).toContain('Tier 3 test verification failed');
    });

    it('halts and returns unresolved_conflicts without executing testRunner when files fail resolution', async () => {
      const testRunnerSpy = vi.fn();

      const options: EpicMergeOptions = {
        targetWorktreePath: '/tmp/worktree-epic-103',
        files: [
          {
            filePath: 'data.json',
            baseContent: JSON.stringify({ count: 10 }),
            oursContent: JSON.stringify({ count: 20 }),
            theirsContent: JSON.stringify({ count: 30 }),
          },
        ],
        testRunner: testRunnerSpy,
      };

      const result = await mergeEpicWorktrees(options);

      expect(result.status).toBe('unresolved_conflicts');
      expect(result.unresolvedFiles).toBe(1);
      expect(result.summary).toContain('Merge halted');
      expect(testRunnerSpy).not.toHaveBeenCalled();
    });
  });
});
