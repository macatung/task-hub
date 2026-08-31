/**
 * semanticMergeService.ts
 *
 * Tier 3 Orchestrator & Verification Gate for AI Semantic Merge & Rebase.
 * Orchestrates multi-file 3-way merges across isolated Git worktrees/branches:
 * 1. Tier 1 Deterministic AST Mergers (TypeScript AST & JSON AST)
 * 2. Tier 2 AI Semantic Conflict Fallback with prompt engineering & syntax verification
 * 3. Tier 3 Verification Gate executing automated test suites before merge commit.
 */

import { mergeJson3Way, JsonConflict } from './astResolvers/jsonAstResolver';
import { mergeTypeScript3Way, AstConflictNode } from './astResolvers/typeScriptAstResolver';
import {
  resolveSemanticConflictHunk,
  validateCodeSyntax,
  AiLlmCaller,
  SemanticConflictHunk,
} from './aiSemanticConflictResolver';
import { hasGitConflictMarkers } from '../utils/safetyGuardrails';

export interface FileConflictOptions {
  filePath: string;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  acceptanceCriteria?: string[];
  oursTaskTitle?: string;
  theirsTaskTitle?: string;
  llmCaller?: AiLlmCaller;
}

export interface FileConflictResolutionResult {
  filePath: string;
  status: 'resolved' | 'conflict_unresolved' | 'syntax_error';
  resolutionTier: 'tier1_ast' | 'tier2_ai' | 'unresolved';
  mergedContent: string;
  explanation?: string;
  conflictsCount: number;
  resolvedConflictsCount: number;
  unresolvedConflicts: Array<AstConflictNode | JsonConflict | { reason: string }>;
  syntaxValid: boolean;
  tierDetails: {
    tier1Attempted: boolean;
    tier1Success: boolean;
    tier2Attempted: boolean;
    tier2Success: boolean;
    aiHunkResolutions: number;
  };
}

export interface EpicMergeFileSpec {
  filePath: string;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  acceptanceCriteria?: string[];
}

export interface TestRunnerOutput {
  success: boolean;
  passed?: boolean;
  output: string;
  testsPassed?: number;
  testsFailed?: number;
  durationMs?: number;
}

export interface EpicMergeOptions {
  baseWorktreePath?: string;
  targetWorktreePath?: string;
  sourceBranchNames?: string[];
  files: EpicMergeFileSpec[];
  acceptanceCriteria?: string[];
  llmCaller?: AiLlmCaller;
  testRunner?: () => Promise<TestRunnerOutput>;
  onProgress?: (event: { currentFile: string; index: number; total: number; stage: string }) => void;
}

export interface EpicMergeResult {
  status: 'verified' | 'resolved' | 'unresolved_conflicts' | 'test_failed';
  totalFiles: number;
  resolvedFiles: number;
  tier1AstResolvedFiles: number;
  tier2AiResolvedFiles: number;
  unresolvedFiles: number;
  fileResults: FileConflictResolutionResult[];
  testVerification?: TestRunnerOutput;
  summary: string;
  timestamp: string;
}

/**
 * Check if a file path is a TypeScript/JavaScript source file.
 */
function isTypeScriptOrJavaScript(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

/**
 * Check if a file path is a JSON configuration file.
 */
function isJsonFile(filePath: string): boolean {
  return /\.json$/i.test(filePath);
}

/**
 * Line-based simple 3-way text merger for non-AST supported text files (e.g. .md, .txt).
 */
function mergeGenericText3Way(
  baseContent: string,
  oursContent: string,
  theirsContent: string
): { success: boolean; mergedText: string; hasConflicts: boolean; conflictedHunks: SemanticConflictHunk[] } {
  if (oursContent === theirsContent) {
    return { success: true, mergedText: oursContent, hasConflicts: false, conflictedHunks: [] };
  }
  if (oursContent === baseContent) {
    return { success: true, mergedText: theirsContent, hasConflicts: false, conflictedHunks: [] };
  }
  if (theirsContent === baseContent) {
    return { success: true, mergedText: oursContent, hasConflicts: false, conflictedHunks: [] };
  }

  // Basic line split and reconciliation
  const baseLines = baseContent.split('\n');
  const oursLines = oursContent.split('\n');
  const theirsLines = theirsContent.split('\n');

  // If one appended text to end of file
  if (oursContent.startsWith(baseContent) && theirsContent.startsWith(baseContent)) {
    const oursAppended = oursContent.slice(baseContent.length);
    const theirsAppended = theirsContent.slice(baseContent.length);
    return {
      success: true,
      mergedText: `${baseContent}${oursAppended}\n${theirsAppended}`,
      hasConflicts: false,
      conflictedHunks: [],
    };
  }

  // Conflict hunk identified
  const hunk: SemanticConflictHunk = {
    filePath: 'text.txt',
    kind: 'GenericTextHunk',
    baseCode: baseContent,
    oursCode: oursContent,
    theirsCode: theirsContent,
  };

  return {
    success: false,
    mergedText: oursContent,
    hasConflicts: true,
    conflictedHunks: [hunk],
  };
}

/**
 * Resolve a file conflict through the 3-tier resolution pipeline:
 * Tier 1 (AST) -> Tier 2 (AI Semantic Fallback) -> Syntax & Conflict Guard Check.
 */
export async function resolveFileConflict(options: FileConflictOptions): Promise<FileConflictResolutionResult> {
  const { filePath, baseContent, oursContent, theirsContent, acceptanceCriteria, oursTaskTitle, theirsTaskTitle, llmCaller } = options;

  // Fast path: Identical modifications or clean one-sided changes
  if (oursContent === theirsContent) {
    return {
      filePath,
      status: 'resolved',
      resolutionTier: 'tier1_ast',
      mergedContent: oursContent,
      explanation: 'Both branches made identical changes',
      conflictsCount: 0,
      resolvedConflictsCount: 0,
      unresolvedConflicts: [],
      syntaxValid: true,
      tierDetails: { tier1Attempted: true, tier1Success: true, tier2Attempted: false, tier2Success: false, aiHunkResolutions: 0 },
    };
  }

  if (oursContent === baseContent) {
    return {
      filePath,
      status: 'resolved',
      resolutionTier: 'tier1_ast',
      mergedContent: theirsContent,
      explanation: 'Only theirs branch modified this file',
      conflictsCount: 0,
      resolvedConflictsCount: 0,
      unresolvedConflicts: [],
      syntaxValid: true,
      tierDetails: { tier1Attempted: true, tier1Success: true, tier2Attempted: false, tier2Success: false, aiHunkResolutions: 0 },
    };
  }

  if (theirsContent === baseContent) {
    return {
      filePath,
      status: 'resolved',
      resolutionTier: 'tier1_ast',
      mergedContent: oursContent,
      explanation: 'Only ours branch modified this file',
      conflictsCount: 0,
      resolvedConflictsCount: 0,
      unresolvedConflicts: [],
      syntaxValid: true,
      tierDetails: { tier1Attempted: true, tier1Success: true, tier2Attempted: false, tier2Success: false, aiHunkResolutions: 0 },
    };
  }

  // 1. JSON 3-Way AST Merge
  if (isJsonFile(filePath)) {
    const jsonResult = mergeJson3Way(baseContent, oursContent, theirsContent);
    if (jsonResult.success && jsonResult.mergedJson) {
      return {
        filePath,
        status: 'resolved',
        resolutionTier: 'tier1_ast',
        mergedContent: jsonResult.mergedJson,
        explanation: 'Resolved via Tier 1 Deterministic JSON 3-Way AST Merger',
        conflictsCount: 0,
        resolvedConflictsCount: 0,
        unresolvedConflicts: [],
        syntaxValid: true,
        tierDetails: { tier1Attempted: true, tier1Success: true, tier2Attempted: false, tier2Success: false, aiHunkResolutions: 0 },
      };
    }

    // If JSON had conflicting key modifications, attempt Tier 2 AI fallback
    if (jsonResult.conflicts.length > 0) {
      const jsonHunk: SemanticConflictHunk = {
        filePath,
        kind: 'JsonConfiguration',
        identifier: jsonResult.conflicts.map((c) => c.path).join(', '),
        baseCode: baseContent,
        oursCode: oursContent,
        theirsCode: theirsContent,
        acceptanceCriteria,
        oursTaskTitle,
        theirsTaskTitle,
      };

      const aiRes = await resolveSemanticConflictHunk(jsonHunk, llmCaller);
      if (aiRes.success && aiRes.resolvedCode) {
        // Validate JSON validity
        try {
          JSON.parse(aiRes.resolvedCode);
          return {
            filePath,
            status: 'resolved',
            resolutionTier: 'tier2_ai',
            mergedContent: aiRes.resolvedCode,
            explanation: aiRes.explanation || 'Resolved via Tier 2 AI Semantic JSON Resolver',
            conflictsCount: jsonResult.conflicts.length,
            resolvedConflictsCount: jsonResult.conflicts.length,
            unresolvedConflicts: [],
            syntaxValid: true,
            tierDetails: {
              tier1Attempted: true,
              tier1Success: false,
              tier2Attempted: true,
              tier2Success: true,
              aiHunkResolutions: 1,
            },
          };
        } catch (_jsonErr) {
          // JSON parsing failed after AI resolution
        }
      }

      return {
        filePath,
        status: 'conflict_unresolved',
        resolutionTier: 'unresolved',
        mergedContent: jsonResult.mergedJson || oursContent,
        explanation: 'Conflicting JSON keys could not be resolved cleanly',
        conflictsCount: jsonResult.conflicts.length,
        resolvedConflictsCount: 0,
        unresolvedConflicts: jsonResult.conflicts,
        syntaxValid: false,
        tierDetails: {
          tier1Attempted: true,
          tier1Success: false,
          tier2Attempted: true,
          tier2Success: false,
          aiHunkResolutions: 0,
        },
      };
    }
  }

  // 2. TypeScript / JavaScript 3-Way AST Merge
  if (isTypeScriptOrJavaScript(filePath)) {
    const tsResult = mergeTypeScript3Way(baseContent, oursContent, theirsContent, filePath);

    if (tsResult.success && tsResult.mergedCode && tsResult.syntaxValid) {
      return {
        filePath,
        status: 'resolved',
        resolutionTier: 'tier1_ast',
        mergedContent: tsResult.mergedCode,
        explanation: 'Resolved cleanly via Tier 1 Deterministic TypeScript AST Merger',
        conflictsCount: 0,
        resolvedConflictsCount: 0,
        unresolvedConflicts: [],
        syntaxValid: true,
        tierDetails: {
          tier1Attempted: true,
          tier1Success: true,
          tier2Attempted: false,
          tier2Success: false,
          aiHunkResolutions: 0,
        },
      };
    }

    // If AST produced node conflicts, invoke Tier 2 AI for each conflicting node
    if (tsResult.conflicts.length > 0) {
      let currentMerged = tsResult.mergedCode || oursContent;
      let aiResolvedCount = 0;
      const remainingConflicts: AstConflictNode[] = [];
      const explanations: string[] = [];

      for (const conflictNode of tsResult.conflicts) {
        const hunk: SemanticConflictHunk = {
          filePath,
          kind: conflictNode.kind,
          identifier: conflictNode.identifier,
          baseCode: conflictNode.baseCode,
          oursCode: conflictNode.oursCode || '',
          theirsCode: conflictNode.theirsCode || '',
          acceptanceCriteria,
          oursTaskTitle,
          theirsTaskTitle,
        };

        const aiResolution = await resolveSemanticConflictHunk(hunk, llmCaller);

        if (aiResolution.success && aiResolution.resolvedCode && aiResolution.syntaxValid) {
          aiResolvedCount++;
          if (aiResolution.explanation) {
            explanations.push(`${conflictNode.identifier}: ${aiResolution.explanation}`);
          }

          // Replace the oursCode segment with resolvedCode in the merged file
          if (conflictNode.oursCode && currentMerged.includes(conflictNode.oursCode)) {
            currentMerged = currentMerged.replace(conflictNode.oursCode, aiResolution.resolvedCode);
          } else {
            // Append or prepend if exact replacement point wasn't matched
            currentMerged = `${currentMerged}\n\n${aiResolution.resolvedCode}\n`;
          }
        } else {
          remainingConflicts.push(conflictNode);
        }
      }

      // Final whole-file syntax verification check
      const wholeFileCheck = validateCodeSyntax(currentMerged, filePath);
      const hasConflictMarkersPresent = hasGitConflictMarkers(currentMerged);

      const allResolved = remainingConflicts.length === 0 && wholeFileCheck.valid && !hasConflictMarkersPresent;

      return {
        filePath,
        status: allResolved ? 'resolved' : wholeFileCheck.valid ? 'conflict_unresolved' : 'syntax_error',
        resolutionTier: allResolved ? 'tier2_ai' : 'unresolved',
        mergedContent: currentMerged,
        explanation: explanations.length > 0
          ? `Tier 2 AI resolved ${aiResolvedCount}/${tsResult.conflicts.length} AST conflicts:\n${explanations.join('\n')}`
          : 'Attempted Tier 2 AI conflict resolution',
        conflictsCount: tsResult.conflicts.length,
        resolvedConflictsCount: aiResolvedCount,
        unresolvedConflicts: remainingConflicts,
        syntaxValid: wholeFileCheck.valid && !hasConflictMarkersPresent,
        tierDetails: {
          tier1Attempted: true,
          tier1Success: false,
          tier2Attempted: true,
          tier2Success: allResolved,
          aiHunkResolutions: aiResolvedCount,
        },
      };
    }
  }

  // 3. Generic text fallback
  const genericRes = mergeGenericText3Way(baseContent, oursContent, theirsContent);
  if (genericRes.success) {
    return {
      filePath,
      status: 'resolved',
      resolutionTier: 'tier1_ast',
      mergedContent: genericRes.mergedText,
      explanation: 'Resolved non-conflicting text changes',
      conflictsCount: 0,
      resolvedConflictsCount: 0,
      unresolvedConflicts: [],
      syntaxValid: true,
      tierDetails: { tier1Attempted: true, tier1Success: true, tier2Attempted: false, tier2Success: false, aiHunkResolutions: 0 },
    };
  }

  // Call Tier 2 AI for generic text conflicts
  const textHunk = genericRes.conflictedHunks[0] || {
    filePath,
    oursCode: oursContent,
    theirsCode: theirsContent,
    baseCode: baseContent,
  };

  const aiTextRes = await resolveSemanticConflictHunk(textHunk, llmCaller);
  const isResolved = aiTextRes.success && !aiTextRes.hasConflictMarkers;

  return {
    filePath,
    status: isResolved ? 'resolved' : 'conflict_unresolved',
    resolutionTier: isResolved ? 'tier2_ai' : 'unresolved',
    mergedContent: aiTextRes.resolvedCode || oursContent,
    explanation: aiTextRes.explanation || 'Generic text conflict resolution',
    conflictsCount: 1,
    resolvedConflictsCount: isResolved ? 1 : 0,
    unresolvedConflicts: isResolved ? [] : [{ reason: 'Generic text conflict' }],
    syntaxValid: true,
    tierDetails: {
      tier1Attempted: true,
      tier1Success: false,
      tier2Attempted: true,
      tier2Success: isResolved,
      aiHunkResolutions: isResolved ? 1 : 0,
    },
  };
}

/**
 * Merge multiple worktree files for an Epic with 3-tier resolution and verification gating.
 */
export async function mergeEpicWorktrees(options: EpicMergeOptions): Promise<EpicMergeResult> {
  const { files, acceptanceCriteria, llmCaller, testRunner, onProgress } = options;

  const fileResults: FileConflictResolutionResult[] = [];
  let tier1AstCount = 0;
  let tier2AiCount = 0;
  let unresolvedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const fileSpec = files[i];
    if (onProgress) {
      onProgress({
        currentFile: fileSpec.filePath,
        index: i + 1,
        total: files.length,
        stage: 'resolving_file',
      });
    }

    const res = await resolveFileConflict({
      filePath: fileSpec.filePath,
      baseContent: fileSpec.baseContent,
      oursContent: fileSpec.oursContent,
      theirsContent: fileSpec.theirsContent,
      acceptanceCriteria: fileSpec.acceptanceCriteria || acceptanceCriteria,
      llmCaller,
    });

    fileResults.push(res);

    if (res.status === 'resolved') {
      if (res.resolutionTier === 'tier1_ast') {
        tier1AstCount++;
      } else if (res.resolutionTier === 'tier2_ai') {
        tier2AiCount++;
      }
    } else {
      unresolvedCount++;
    }
  }

  const resolvedCount = tier1AstCount + tier2AiCount;

  // If there are unresolved conflicts, return early before running tests
  if (unresolvedCount > 0) {
    return {
      status: 'unresolved_conflicts',
      totalFiles: files.length,
      resolvedFiles: resolvedCount,
      tier1AstResolvedFiles: tier1AstCount,
      tier2AiResolvedFiles: tier2AiCount,
      unresolvedFiles: unresolvedCount,
      fileResults,
      summary: `Merge halted: ${unresolvedCount} file(s) have unresolved conflicts requiring manual review.`,
      timestamp: new Date().toISOString(),
    };
  }

  // Tier 3: Test Verification Gate
  let testVerification: TestRunnerOutput | undefined;
  let finalStatus: EpicMergeResult['status'] = 'resolved';

  if (testRunner) {
    if (onProgress) {
      onProgress({
        currentFile: 'test_verification_gate',
        index: files.length,
        total: files.length,
        stage: 'running_verification_tests',
      });
    }

    try {
      testVerification = await testRunner();
      if (testVerification.success) {
        finalStatus = 'verified';
      } else {
        finalStatus = 'test_failed';
      }
    } catch (testError: any) {
      testVerification = {
        success: false,
        output: `Test runner exception: ${testError.message}`,
        testsFailed: 1,
      };
      finalStatus = 'test_failed';
    }
  }

  const summary = finalStatus === 'verified'
    ? `Successfully merged and verified ${files.length} file(s) (${tier1AstCount} Tier 1 AST, ${tier2AiCount} Tier 2 AI). All verification tests passed.`
    : finalStatus === 'test_failed'
    ? `Code merged across ${files.length} file(s), but Tier 3 test verification failed. Review test logs.`
    : `Successfully merged ${files.length} file(s) across all branches.`;

  return {
    status: finalStatus,
    totalFiles: files.length,
    resolvedFiles: resolvedCount,
    tier1AstResolvedFiles: tier1AstCount,
    tier2AiResolvedFiles: tier2AiCount,
    unresolvedFiles: unresolvedCount,
    fileResults,
    testVerification,
    summary,
    timestamp: new Date().toISOString(),
  };
}
