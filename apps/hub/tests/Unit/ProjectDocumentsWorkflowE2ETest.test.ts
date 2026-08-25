import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const readHubFile = (relativePath: string) => {
  return fs.readFileSync(path.join(hubRoot, relativePath), 'utf8');
};

describe('Project Documentation Lifecycle & Freshness System - Web Hub & Backend', () => {
  describe('1. ProjectDocument Model & Staleness Calculation', () => {
    it('defines standard document types and dynamic 30-day is_stale attribute', () => {
      const modelSrc = readHubFile('app/Models/ProjectDocument.php');
      expect(modelSrc).toContain("public const TYPES = ['brief', 'prd', 'functional_spec', 'architecture', 'adr', 'design', 'api_contract', 'coding_standard', 'qa_plan', 'release_runbook', 'decision_log', 'risk_log', 'changelog', 'other']");
      expect(modelSrc).toContain('last_verified_at');
      expect(modelSrc).toContain('source_updated_at');
      expect(modelSrc).toContain('content_hash');
      expect(modelSrc).toContain('function getIsStaleAttribute(): bool');
      expect(modelSrc).toContain('subDays(30)');
    });
  });

  describe('2. ProjectKnowledgeService & Manifest Lifecycle', () => {
    it('enforces 6 core document types including functional_spec and tracks missing core docs', () => {
      const serviceSrc = readHubFile('app/Services/ProjectKnowledgeService.php');
      expect(serviceSrc).toContain("public const STANDARD_VERSION = 'task-hub-docs-v1'");
      expect(serviceSrc).toContain("public const CORE_TYPES = ['brief', 'prd', 'functional_spec', 'architecture', 'qa_plan', 'release_runbook']");
      expect(serviceSrc).toContain('function projectState(Project $project): array');
      expect(serviceSrc).toContain("'stale' => $documents->filter->is_stale->count()");
      expect(serviceSrc).toContain('missing_core');
      expect(serviceSrc).toContain('parseManifest');
      expect(serviceSrc).toContain('importManifest');
      expect(serviceSrc).toContain('manifestTemplate');
    });
  });

  describe('3. Controller API Endpoints & Freshness Updates', () => {
    it('provides importGenerated and importManifest with hash & timestamp updates', () => {
      const controllerSrc = readHubFile('app/Http/Controllers/Api/ApiProjectDocumentController.php');
      expect(controllerSrc).toContain('public function importManifest');
      expect(controllerSrc).toContain('public function importGenerated');
      expect(controllerSrc).toContain("'last_verified_at' => now()");
      expect(controllerSrc).toContain("'source_updated_at' => now()");
      expect(controllerSrc).toContain("hash('sha256'");
    });

    it('exposes routes for document management and manifest importing', () => {
      const routesSrc = readHubFile('routes/web.php');
      expect(routesSrc).toContain('/projects/{project}/documents');
      expect(routesSrc).toContain('/projects/{project}/documents/import-manifest');
      expect(routesSrc).toContain('/projects/{project}/documents/import-generated');
    });
  });

  describe('4. Preflight Agent Context Pack Injection', () => {
    it('injects freshest project documents and document standard into agent context', () => {
      const contextPackSrc = readHubFile('app/Services/TaskHubContextPackService.php');
      expect(contextPackSrc).toContain("'project_knowledge'");
      expect(contextPackSrc).toContain("'project_document_contents'");
      expect(contextPackSrc).toContain("'document_standard'");
      expect(contextPackSrc).toContain('ProjectKnowledgeService::STANDARD_VERSION');
      expect(contextPackSrc).toContain('ProjectKnowledgeService::CORE_TYPES');
    });
  });

  describe('5. Project Documents Frontend Panel', () => {
    it('displays summary metrics, missing core warning, status filter, and GitHub sync', () => {
      const panelSrc = readHubFile('resources/js/Components/tasks/ProjectDocumentsPanel.vue');
      expect(panelSrc).toContain('displayStatus');
      expect(panelSrc).toContain('Missing core documents');
      expect(panelSrc).toContain('Sync from GitHub');
      expect(panelSrc).toContain('Search documents');
      expect(panelSrc).toContain('Filter documents by status');
    });
  });
});
