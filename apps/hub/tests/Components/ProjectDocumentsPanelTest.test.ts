/**
 * Project Documents Panel — contract coverage for the docs discovery experience.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '../Harness/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(here, '../../resources/js/Components/tasks/ProjectDocumentsPanel.vue');
const modalPath = path.resolve(here, '../../resources/js/Pages/Tasks/Index.vue');
const component = fs.readFileSync(componentPath, 'utf8');
const modal = fs.readFileSync(modalPath, 'utf8');

describe('ProjectDocumentsPanel', () => {
  it('[T1_DOCS_01] exposes compact textual health, search and status filtering controls', () => {
    expect(component.includes('Total documents')).toBe(true);
    expect(component.includes("'—' }}</strong> ready")).toBe(true);
    expect(component.includes("'—' }}</strong> review")).toBe(true);
    expect(component.includes('Search documents')).toBe(true);
    expect(component.includes('Filter documents by status')).toBe(true);
  });

  it('[T1_DOCS_02] keeps GitHub links with repository fallback and safe unavailable state', () => {
    expect(component.includes('github.com')).toBe(true);
    expect(component.includes('target="_blank"')).toBe(true);
    expect(component.includes('No link')).toBe(true);
  });

  it('[T1_DOCS_03] presents stale, draft and archived states without colour-only status', () => {
    expect(component.includes('displayStatus(document)')).toBe(true);
    expect(component.includes('Missing core documents.')).toBe(true);
  });

  it('[T2_DOCS_01] includes sync, loading, error and empty recovery states', () => {
    expect(component.includes('Sync from GitHub')).toBe(true);
    expect(component.includes('animate-pulse')).toBe(true);
    expect(component.includes('Try again')).toBe(true);
    expect(component.includes('No document registry yet')).toBe(true);
  });

  it('[T1_DOCS_04] uses a responsive modal with an accessible close control', () => {
    expect(modal.includes('max-w-4xl')).toBe(true);
    expect(modal.includes('max-h-[90vh]')).toBe(true);
    expect(modal.includes('aria-label="Close project documents"')).toBe(true);
  });
});
