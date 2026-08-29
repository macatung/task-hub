import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());
const tasksPage = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const landingPage = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Hub/Index.vue'), 'utf8');
const appCss = fs.readFileSync(path.join(hubRoot, 'resources/css/app.css'), 'utf8');
const emptyBoard = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/WorkspaceEmptyBoard.vue'), 'utf8');

describe('SaaS workspace redesign', () => {
  it('uses light mode as the default and restores an explicit dark preference', () => {
    expect(tasksPage).toContain('const isDarkMode = ref(false)');
    expect(tasksPage).toContain("isDarkMode.value = savedTheme === 'dark'");
  });

  it('uses the task detail surface as a compact context rail', () => {
    expect(tasksPage).toContain("isDrawerExpanded ? 'max-w-[1440px]' : 'max-w-[980px]'");
    expect(tasksPage).toContain('<TaskContextRail');
    expect(tasksPage).toContain('TASK CONTEXT');
    expect(tasksPage).toContain('Task references');
    expect(tasksPage).toContain('Agent activity & evidence');
  });

  it('scopes the Midnight visual system to the public product landing', () => {
    expect(landingPage).toContain('hub-landing');
    expect(appCss).toContain('.hub-landing');
    expect(appCss).toContain('--hub-primary: #00f5a0');
    expect(appCss).toContain('--hub-canvas: #04070d');
    expect(appCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('uses the Task Hub mark and provides a guided empty board workflow', () => {
    expect(tasksPage).toContain('<WorkspaceBrand');
    expect(tasksPage).toContain('<WorkspaceEmptyBoard');
    expect(tasksPage).toContain('name="LayoutGrid"');
    expect(tasksPage).toContain('name="Plug"');
    expect(emptyBoard).toContain('Create a task');
    expect(emptyBoard).toContain('Plan with AI');
    expect(emptyBoard).toContain('Dispatch with evidence');
  });
});
