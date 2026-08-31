import { describe, expect, it } from 'vitest';
import streamCardsViewSource from './StreamCardsView.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import flowStepperSource from './FlowStepper.vue?raw';
import { ROLE_METADATA } from '../../utils/autoPilotRunner';
import { useAutoPilotStore } from '../../stores/useAutoPilotStore';

describe('StreamCardsView (Milestone M3 UI/UX Step-by-Step Stream)', () => {
  it('renders 4 distinct step cards corresponding to the 4 standardized agent roles', () => {
    // Check template contains 4 standardized roles
    expect(streamCardsViewSource).toContain("role === 'architect'");
    expect(streamCardsViewSource).toContain("role === 'implementer'");
    expect(streamCardsViewSource).toContain("role === 'tester'");
    expect(streamCardsViewSource).toContain("role === 'auditor'");

    // Check role themes and metadata
    expect(streamCardsViewSource).toContain('Architect / Planner');
    expect(streamCardsViewSource).toContain('Core Implementer');
    expect(streamCardsViewSource).toContain('Test Engineer');
    expect(streamCardsViewSource).toContain('Evidence Auditor / Reviewer');

    // Role Icons
    expect(streamCardsViewSource).toContain('codicon-circuit-board');
    expect(streamCardsViewSource).toContain('codicon-tools');
    expect(streamCardsViewSource).toContain('codicon-beaker');
    expect(streamCardsViewSource).toContain('codicon-shield');
  });

  it('provides dedicated role badges with distinctive color schemes (Indigo, Emerald, Amber, Cyan)', () => {
    // Architect: Indigo badge
    expect(streamCardsViewSource).toContain('border-indigo-500/40');
    expect(streamCardsViewSource).toContain('bg-indigo-950/60');
    expect(streamCardsViewSource).toContain('text-indigo-300');

    // Implementer: Emerald badge
    expect(streamCardsViewSource).toContain('border-emerald-500/40');
    expect(streamCardsViewSource).toContain('bg-emerald-950/60');
    expect(streamCardsViewSource).toContain('text-emerald-300');

    // Test Engineer: Amber badge
    expect(streamCardsViewSource).toContain('border-amber-500/40');
    expect(streamCardsViewSource).toContain('bg-amber-950/60');
    expect(streamCardsViewSource).toContain('text-amber-300');

    // Evidence Auditor: Cyan badge
    expect(streamCardsViewSource).toContain('border-cyan-500/40');
    expect(streamCardsViewSource).toContain('bg-cyan-950/60');
    expect(streamCardsViewSource).toContain('text-cyan-300');
  });

  it('displays running model indicators, duration counters, and animated status badges', () => {
    expect(streamCardsViewSource).toContain('formatModelDisplayName');
    expect(streamCardsViewSource).toContain('Gemini 3.7 Pro');
    expect(streamCardsViewSource).toContain('Gemini 3.7 Flash');
    expect(streamCardsViewSource).toContain('formatDuration');
    expect(streamCardsViewSource).toContain('getStatusBadge');
    expect(streamCardsViewSource).toContain('animate-pulse');
    expect(streamCardsViewSource).toContain('animate-ping');
  });

  it('implements scoped collapsible accordions for terminal logs with copy functionality', () => {
    expect(streamCardsViewSource).toContain('expandedLogs');
    expect(streamCardsViewSource).toContain('toggleLogs');
    expect(streamCardsViewSource).toContain('copyLogs');
    expect(streamCardsViewSource).toContain('copiedLogsFeedback');
    expect(streamCardsViewSource).toContain('Terminal Logs');
  });

  it('implements scoped collapsible accordions for tool calls with argument and result inspectors', () => {
    expect(streamCardsViewSource).toContain('expandedTools');
    expect(streamCardsViewSource).toContain('toggleTools');
    expect(streamCardsViewSource).toContain('toggleToolItem');
    expect(streamCardsViewSource).toContain('Tool Calls & Lệnh Thực thi');
    expect(streamCardsViewSource).toContain('tool.toolName');
    expect(streamCardsViewSource).toContain('JSON.stringify(tool.args');
  });

  it('renders customized output artifact summaries per stage', () => {
    // Architect plan markdown preview
    expect(streamCardsViewSource).toContain('renderMarkdown');
    expect(streamCardsViewSource).toContain('Architect Discovery Plan');
    expect(streamCardsViewSource).toContain('targetFiles');

    // Implementer worktree diff preview
    expect(streamCardsViewSource).toContain('Worktree');
    expect(streamCardsViewSource).toContain('changedFiles');
    expect(streamCardsViewSource).toContain('diffSummary');

    // Test Engineer verification stats
    expect(streamCardsViewSource).toContain('Passed Tests');
    expect(streamCardsViewSource).toContain('Failed Tests');
    expect(streamCardsViewSource).toContain('Pass Ratio');

    // Evidence Auditor signed handoff preview
    expect(streamCardsViewSource).toContain('Chữ ký bàn giao');
    expect(streamCardsViewSource).toContain('reviewerStatus');
  });

  it('renders inter-agent context handoff connectors between pipeline stages', () => {
    expect(streamCardsViewSource).toContain('getContextPackage');
    expect(streamCardsViewSource).toContain('Context Handoff Đồng Bộ');
    expect(streamCardsViewSource).toContain('rolesOrder[index - 1].toUpperCase()');
  });

  it('provides global expand-all and collapse-all controls and progress tracking', () => {
    expect(streamCardsViewSource).toContain('expandAll');
    expect(streamCardsViewSource).toContain('collapseAll');
    expect(streamCardsViewSource).toContain('progressPercent');
    expect(streamCardsViewSource).toContain('completedStepsCount');
  });

  it('integrates seamlessly with useAutoPilotStore and RunWorkspace.vue', () => {
    const store = useAutoPilotStore();
    expect(store.stageExecutions.value.length).toBe(4);
    expect(store.stageExecutions.value[0].role).toBe('architect');
    expect(store.stageExecutions.value[1].role).toBe('implementer');
    expect(store.stageExecutions.value[2].role).toBe('tester');
    expect(store.stageExecutions.value[3].role).toBe('auditor');

    // RunWorkspace integration
    expect(runWorkspaceSource).toContain('<StreamCardsView');
    expect(runWorkspaceSource).toContain('<ConversationThread');
    expect(runWorkspaceSource).toContain('◉ Execution');
    expect(runWorkspaceSource).toContain("orchestrationMode === 'workflow' || orchestrationMode === 'supervisor'");
    expect(runWorkspaceSource).toContain('activeSubTab');
  });

  it('FlowStepper supports multi-agent 4-phase execution mode', () => {
    expect(flowStepperSource).toContain('mode?: "cao" | "multi_agent"');
    expect(flowStepperSource).toContain('1. Architect');
    expect(flowStepperSource).toContain('2. Implementer');
    expect(flowStepperSource).toContain('3. Tester');
    expect(flowStepperSource).toContain('4. Auditor');
  });
});
