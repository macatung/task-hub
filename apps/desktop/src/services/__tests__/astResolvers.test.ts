import { describe, it, expect } from 'vitest';
import { mergeJson3Way, detectJsonIndent } from '../astResolvers/jsonAstResolver';
import { mergeTypeScript3Way } from '../astResolvers/typeScriptAstResolver';

describe('astResolvers - Tier 1 Deterministic AST Mergers', () => {
  describe('jsonAstResolver - 3-Way JSON Merge', () => {
    it('merges package.json dependencies and scripts added in separate branches without conflict', () => {
      const baseJson = JSON.stringify(
        {
          name: 'my-app',
          version: '1.0.0',
          scripts: {
            build: 'vite build',
          },
          dependencies: {
            vue: '^3.5.0',
          },
        },
        null,
        2
      );

      // Ours branch adds 'pinia' and 'test' script
      const oursJson = JSON.stringify(
        {
          name: 'my-app',
          version: '1.0.0',
          scripts: {
            build: 'vite build',
            test: 'vitest run',
          },
          dependencies: {
            vue: '^3.5.0',
            pinia: '^2.1.0',
          },
        },
        null,
        2
      );

      // Theirs branch adds 'axios' and 'lint' script
      const theirsJson = JSON.stringify(
        {
          name: 'my-app',
          version: '1.0.0',
          scripts: {
            build: 'vite build',
            lint: 'eslint .',
          },
          dependencies: {
            vue: '^3.5.0',
            axios: '^1.7.0',
          },
        },
        null,
        2
      );

      const result = mergeJson3Way(baseJson, oursJson, theirsJson);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);

      const merged = JSON.parse(result.mergedJson!);
      expect(merged.dependencies).toEqual({
        vue: '^3.5.0',
        pinia: '^2.1.0',
        axios: '^1.7.0',
      });
      expect(merged.scripts).toEqual({
        build: 'vite build',
        test: 'vitest run',
        lint: 'eslint .',
      });
    });

    it('performs smart union for array fields such as keywords and tsconfig include/exclude', () => {
      const baseJson = JSON.stringify({
        compilerOptions: { target: 'ES2022' },
        include: ['src/**/*.ts'],
      });

      const oursJson = JSON.stringify({
        compilerOptions: { target: 'ES2022', strict: true },
        include: ['src/**/*.ts', 'src/**/*.vue'],
      });

      const theirsJson = JSON.stringify({
        compilerOptions: { target: 'ES2022', jsx: 'preserve' },
        include: ['src/**/*.ts', 'electron/**/*.ts'],
      });

      const result = mergeJson3Way(baseJson, oursJson, theirsJson);

      expect(result.success).toBe(true);
      const merged = JSON.parse(result.mergedJson!);
      expect(merged.compilerOptions).toEqual({
        target: 'ES2022',
        strict: true,
        jsx: 'preserve',
      });
      expect(merged.include).toContain('src/**/*.ts');
      expect(merged.include).toContain('src/**/*.vue');
      expect(merged.include).toContain('electron/**/*.ts');
    });

    it('detects and reports conflicts when both branches modify the same primitive key to different values', () => {
      const baseJson = JSON.stringify({
        name: 'task-hub',
        version: '1.0.0',
      });

      const oursJson = JSON.stringify({
        name: 'task-hub',
        version: '1.1.0',
      });

      const theirsJson = JSON.stringify({
        name: 'task-hub',
        version: '2.0.0',
      });

      const result = mergeJson3Way(baseJson, oursJson, theirsJson);

      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].path).toBe('version');
    });

    it('preserves indentation style and detects tab vs spaces', () => {
      const tabJson = '{\n\t"name": "tabbed",\n\t"version": "1.0.0"\n}';
      const indent = detectJsonIndent(tabJson);
      expect(indent).toBe('\t');

      const spaceJson = '{\n    "name": "spaces"\n}';
      const spaceIndent = detectJsonIndent(spaceJson);
      expect(spaceIndent).toBe(4);
    });
  });

  describe('typeScriptAstResolver - 3-Way TypeScript AST Merge', () => {
    it('merges disjoint named imports from the same module into a single clean statement', () => {
      const baseCode = `import { ref } from 'vue';\n\nexport const count = ref(0);`;
      const oursCode = `import { ref, computed } from 'vue';\n\nexport const count = ref(0);\nexport const doubled = computed(() => count.value * 2);`;
      const theirsCode = `import { ref, watch } from 'vue';\n\nexport const count = ref(0);\nwatch(count, () => console.log(count.value));`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedCode).toContain(`import { ref, computed, watch } from 'vue';`);
      expect(result.mergedCode).toContain('export const doubled');
      expect(result.mergedCode).toContain('watch(count');
    });

    it('merges imports from different new modules added across branches', () => {
      const baseCode = `import { ref } from 'vue';`;
      const oursCode = `import { ref } from 'vue';\nimport axios from 'axios';`;
      const theirsCode = `import { ref } from 'vue';\nimport path from 'path';`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.mergedCode).toContain(`import { ref } from 'vue';`);
      expect(result.mergedCode).toContain(`import axios from 'axios';`);
      expect(result.mergedCode).toContain(`import path from 'path';`);
    });

    it('merges interface property additions cleanly without duplicate interfaces', () => {
      const baseCode = `
export interface TaskItem {
  id: string;
  title: string;
}
`;

      // Ours adds riskLevel
      const oursCode = `
export interface TaskItem {
  id: string;
  title: string;
  riskLevel: 'low' | 'high';
}
`;

      // Theirs adds assignee
      const theirsCode = `
export interface TaskItem {
  id: string;
  title: string;
  assignee?: string;
}
`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedCode).toContain('interface TaskItem');
      expect(result.mergedCode).toContain('riskLevel:');
      expect(result.mergedCode).toContain('assignee?:');
      expect(result.mergedCode).toContain('id: string;');
      expect(result.mergedCode).toContain('title: string;');
    });

    it('merges disjoint barrel exports and named export clauses', () => {
      const baseCode = `export * from './core';`;
      const oursCode = `export * from './core';\nexport * from './services/auth';`;
      const theirsCode = `export * from './core';\nexport * from './services/billing';`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.mergedCode).toContain(`export * from './core';`);
      expect(result.mergedCode).toContain(`export * from './services/auth';`);
      expect(result.mergedCode).toContain(`export * from './services/billing';`);
    });

    it('merges independent top-level functions and classes added across branches', () => {
      const baseCode = `
export function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2);
}
`;

      const oursCode = `
export function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2);
}

export function formatPercentage(value: number): string {
  return (value * 100).toFixed(1) + '%';
}
`;

      const theirsCode = `
export function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2);
}

export function formatDate(d: Date): string {
  return d.toISOString();
}
`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.mergedCode).toContain('function formatCurrency');
      expect(result.mergedCode).toContain('function formatPercentage');
      expect(result.mergedCode).toContain('function formatDate');
    });

    it('flags AST node conflict when both branches modify the same function differently', () => {
      const baseCode = `
export function computeScore(points: number): number {
  return points * 10;
}
`;

      const oursCode = `
export function computeScore(points: number): number {
  return points * 10 + 50; // Add bonus
}
`;

      const theirsCode = `
export function computeScore(points: number): number {
  return points * 20; // Double multiplier
}
`;

      const result = mergeTypeScript3Way(baseCode, oursCode, theirsCode);

      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].identifier).toBe('computeScore');
      expect(result.conflicts[0].kind).toBe('FunctionDeclaration');
    });
  });
});
