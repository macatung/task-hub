import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const readFile = (relativePath: string) => {
  return fs.readFileSync(path.join(hubRoot, relativePath), 'utf8');
};

describe('Living Functional Specification (FSD) Structure & AI Continuous Sync Audit', () => {
  const fsdSrc = fs.readFileSync(path.resolve(hubRoot, '../../docs/FUNCTIONAL_SPECIFICATION.md'), 'utf8');
  const manifestSrc = fs.readFileSync(path.resolve(hubRoot, '../../docs/PROJECT_DOCUMENTS.md'), 'utf8');

  describe('1. Functional vs Non-Functional Classification & Detailed Functions', () => {
    it('separates Functional and Non-Functional sections clearly', () => {
      expect(fsdSrc).toContain('## 3. Detailed Functional Specifications (FS)');
      expect(fsdSrc).toContain('## 4. Detailed Non-Functional Specifications (NFR)');
    });

    it('contains detailed per-function identifiers and specifications', () => {
      expect(fsdSrc).toContain('FN-WS-01');
      expect(fsdSrc).toContain('FN-WS-02');
      expect(fsdSrc).toContain('FN-TASK-01');
      expect(fsdSrc).toContain('FN-TASK-02');
      expect(fsdSrc).toContain('FN-TASK-03');
      expect(fsdSrc).toContain('FN-DOC-01');
      expect(fsdSrc).toContain('FN-DOC-02');
      expect(fsdSrc).toContain('FN-DOC-03');
      expect(fsdSrc).toContain('FN-DESK-01');
      expect(fsdSrc).toContain('FN-DESK-02');
      expect(fsdSrc).toContain('FN-DESK-03');
      expect(fsdSrc).toContain('FN-DESK-04');
      expect(fsdSrc).toContain('FN-HAND-01');
      expect(fsdSrc).toContain('FN-HAND-02');
      expect(fsdSrc).toContain('FN-AUDIT-01');
      expect(fsdSrc).toContain('FN-AUDIT-02');
      expect(fsdSrc).toContain('FN-REQ-01');
      expect(fsdSrc).toContain('FN-MCP-01');
    });

    it('contains detailed non-functional specifications', () => {
      expect(fsdSrc).toContain('NFR-01: Security, Secret Redaction');
      expect(fsdSrc).toContain('NFR-02: Sandboxing, Safety Guardrails & 15-Min Fail-Closed');
      expect(fsdSrc).toContain('NFR-03: Performance, Throughput & Low-Latency Streaming');
      expect(fsdSrc).toContain('NFR-04: Living Document Alignment & Continuous Synchronization');
    });
  });

  describe('2. Embedded Mermaid Diagrams & Visual Workflows', () => {
    it('embeds Mermaid sequence, state, flowchart, and ERD diagrams', () => {
      expect(fsdSrc).toContain('```mermaid');
      expect(fsdSrc).toContain('sequenceDiagram');
      expect(fsdSrc).toContain('stateDiagram-v2');
      expect(fsdSrc).toContain('flowchart');
      expect(fsdSrc).toContain('erDiagram');
    });
  });

  describe('3. Traceability Matrix & Task Linkages', () => {
    it('contains full traceability mapping function IDs to task keys and source paths', () => {
      expect(fsdSrc).toContain('## 6. Comprehensive Traceability Matrix');
      expect(fsdSrc).toContain('TASK-WS-01');
      expect(fsdSrc).toContain('TASK-CORE-01');
      expect(fsdSrc).toContain('TASK-CORE-03');
      expect(fsdSrc).toContain('TASK-DOC-01');
      expect(fsdSrc).toContain('TASK-DESK-01');
      expect(fsdSrc).toContain('TASK-HAND-01');
      expect(fsdSrc).toContain('TASK-AUDIT-01');
      expect(fsdSrc).toContain('TASK-REQ-01');
      expect(fsdSrc).toContain('TASK-MCP-01');
    });
  });

  describe('4. Hub Knowledge Integration & Manifest Registration', () => {
    it('registers functional_spec in ProjectDocument model and ProjectKnowledgeService', () => {
      const modelSrc = readFile('app/Models/ProjectDocument.php');
      const serviceSrc = readFile('app/Services/ProjectKnowledgeService.php');

      expect(modelSrc).toContain("'functional_spec'");
      expect(serviceSrc).toContain("'functional_spec'");
      expect(manifestSrc).toContain('docs/FUNCTIONAL_SPECIFICATION.md');
      expect(manifestSrc).toContain('functional_spec');
    });
  });
});
