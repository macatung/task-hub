import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const tasksPage = fs.readFileSync(path.join(root, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const exportService = fs.readFileSync(path.join(root, 'app/Services/ProjectRoadmapXlsxExport.php'), 'utf8');
const exportController = fs.readFileSync(path.join(root, 'app/Http/Controllers/Api/ApiProjectRoadmapExportController.php'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'routes/web.php'), 'utf8');

describe('Roadmap drawer and Excel export', () => {
  it('uses a reading-first drawer with a compact quick edit strip', () => {
    expect(tasksPage).toContain("isDrawerExpanded ? 'max-w-[1440px]' : 'max-w-[980px]'");
    expect(tasksPage).toContain('Quick task edits');
    expect(tasksPage).toContain('Changes save automatically');
    expect(tasksPage).toContain('<details class="group" open>');
    expect(tasksPage).toContain('TASK CONTEXT');
  });

  it('splits Roadmap into overview, timeline and Epic surfaces', () => {
    expect(tasksPage).toContain("const roadmapTab = ref<'overview' | 'timeline' | 'epics'>('overview')");
    expect(tasksPage).toContain("{ id: 'overview', label: 'Overview'");
    expect(tasksPage).toContain('v-show="roadmapTab === \'timeline\'"');
    expect(tasksPage).toContain('v-show="roadmapTab === \'epics\'"');
  });

  it('downloads an authenticated Excel workbook for the selected project', () => {
    expect(tasksPage).toContain('exportRoadmapWorkbook');
    expect(tasksPage).toContain('/roadmap-export');
    expect(tasksPage).toContain('Export Excel');
    expect(routes).toContain("Route::get('/projects/{project}/roadmap-export', ApiProjectRoadmapExportController::class)->middleware('auth')");
    expect(exportController).toContain('WorkspaceContext');
  });

  it('creates a three-sheet XLSX workbook without exposing agent data', () => {
    expect(exportService).toContain("['Summary', $summary");
    expect(exportService).toContain("['Roadmap', $roadmap");
    expect(exportService).toContain("['Tasks', $register");
    expect(exportService).toContain('new ZipArchive()');
    expect(exportService).not.toContain('agentRuns');
  });
});
