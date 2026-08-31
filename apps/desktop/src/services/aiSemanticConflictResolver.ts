/**
 * aiSemanticConflictResolver.ts
 *
 * Tier 2 AI Semantic Conflict Resolver.
 * Resolves overlapping code hunks and AST node conflicts using structured LLM
 * prompt engineering, JSON response schema parsing, and TypeScript compiler
 * syntax verification (ts.createSourceFile).
 */

import ts from 'typescript';
import { hasGitConflictMarkers } from '../utils/safetyGuardrails';

export interface SemanticConflictHunk {
  id?: string;
  filePath: string;
  kind?: string;
  identifier?: string;
  baseCode?: string;
  oursCode: string;
  theirsCode: string;
  contextBefore?: string;
  contextAfter?: string;
  acceptanceCriteria?: string[];
  oursTaskTitle?: string;
  theirsTaskTitle?: string;
}

export interface AiResolutionResponse {
  resolvedCode: string;
  explanation: string;
  confidenceScore: number;
}

export interface AiConflictResolutionResult {
  success: boolean;
  resolvedCode?: string;
  explanation?: string;
  confidenceScore?: number;
  syntaxValid: boolean;
  syntaxErrors?: string[];
  hasConflictMarkers: boolean;
  rawResponse?: string;
  error?: string;
}

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
  filePath: string;
  expectedSchema: string;
}

export type AiLlmCaller = (payload: PromptPayload) => Promise<string | AiResolutionResponse>;

/**
 * Construct structured AI prompt for semantic conflict resolution.
 */
export function buildConflictResolutionPrompt(hunk: SemanticConflictHunk): PromptPayload {
  const systemPrompt = [
    'You are an expert AI software architect and compiler specialist.',
    'Your task is to semantically resolve a Git 3-way merge conflict between two branches (Ours and Theirs) relative to a common Base.',
    'Carefully preserve the business logic, bug fixes, and intentions from both branches without introducing regressions.',
    'Ensure the resolved code is syntactically valid TypeScript/JavaScript, matches surrounding code style, and NEVER contains Git conflict markers (e.g. <<<<<<<, =======, >>>>>>>).',
    'You MUST respond with a single valid JSON object strictly matching the schema.',
  ].join(' ');

  const promptSections: string[] = [];

  promptSections.push(`### File Path:\n\`${hunk.filePath}\``);

  if (hunk.identifier || hunk.kind) {
    promptSections.push(`### Conflicted Symbol / Structure:\n- Identifier: \`${hunk.identifier || 'Unknown'}\`\n- Kind: \`${hunk.kind || 'CodeBlock'}\``);
  }

  if (hunk.acceptanceCriteria && hunk.acceptanceCriteria.length > 0) {
    promptSections.push(`### Acceptance Criteria & Task Context:\n${hunk.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`);
  }

  if (hunk.contextBefore) {
    promptSections.push(`### Context Before Conflict:\n\`\`\`typescript\n${hunk.contextBefore}\n\`\`\``);
  }

  promptSections.push(`### Base Version (Common Ancestor):\n\`\`\`typescript\n${hunk.baseCode || '// (Empty or newly added)'}\n\`\`\``);
  promptSections.push(`### Ours Version (Branch: ${hunk.oursTaskTitle || 'Ours'}):\n\`\`\`typescript\n${hunk.oursCode}\n\`\`\``);
  promptSections.push(`### Theirs Version (Branch: ${hunk.theirsTaskTitle || 'Theirs'}):\n\`\`\`typescript\n${hunk.theirsCode}\n\`\`\``);

  if (hunk.contextAfter) {
    promptSections.push(`### Context After Conflict:\n\`\`\`typescript\n${hunk.contextAfter}\n\`\`\``);
  }

  promptSections.push(
    '### Output Instructions:\n' +
    'Provide your merged resolution strictly in the following JSON format:\n' +
    '```json\n' +
    '{\n' +
    '  "resolvedCode": "<full merged replacement code>",\n' +
    '  "explanation": "<concise explanation of how conflicts were resolved>",\n' +
    '  "confidenceScore": 0.95\n' +
    '}\n' +
    '```'
  );

  return {
    systemPrompt,
    userPrompt: promptSections.join('\n\n'),
    filePath: hunk.filePath,
    expectedSchema: '{"resolvedCode": string, "explanation": string, "confidenceScore": number}',
  };
}

/**
 * Validate TypeScript syntax of a code fragment or statement.
 */
export function validateCodeSyntax(code: string, fileName: string = 'snippet.ts'): { valid: boolean; errors: string[] } {
  const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const parseDiagnostics = (sourceFile as any).parseDiagnostics || [];
  if (parseDiagnostics.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors = parseDiagnostics.map((d: ts.Diagnostic) => {
    const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
    const line = d.start ? sourceFile.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
    return `Line ${line}: ${msg}`;
  });

  return { valid: false, errors };
}

/**
 * Parse LLM JSON output with markdown fence stripping and fallback handling.
 */
export function parseAiResolutionResponse(raw: string | AiResolutionResponse): AiResolutionResponse {
  if (typeof raw === 'object' && raw !== null && 'resolvedCode' in raw) {
    return {
      resolvedCode: String(raw.resolvedCode || ''),
      explanation: String(raw.explanation || ''),
      confidenceScore: typeof raw.confidenceScore === 'number' ? raw.confidenceScore : 0.9,
    };
  }

  const text = String(raw).trim();

  // Try extracting JSON from markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text;

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.resolvedCode === 'string') {
      return {
        resolvedCode: parsed.resolvedCode,
        explanation: parsed.explanation || 'Resolved via AI semantic analysis',
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
      };
    }
  } catch (_e) {
    // If not strict JSON, treat entire response as code if it has valid code markers
    const codeMatch = text.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      return {
        resolvedCode: codeMatch[1].trim(),
        explanation: 'Extracted code block from AI text response',
        confidenceScore: 0.75,
      };
    }
  }

  return {
    resolvedCode: text,
    explanation: 'Raw AI text fallback',
    confidenceScore: 0.5,
  };
}

/**
 * Built-in heuristic synthesizer when offline or when no LLM provider is configured.
 * Combines statements or sequential modifications cleanly.
 */
function heuristicSynthesizeHunk(hunk: SemanticConflictHunk): AiResolutionResponse {
  // If either side matches base, use the other
  if (hunk.baseCode && hunk.oursCode === hunk.baseCode) {
    return { resolvedCode: hunk.theirsCode, explanation: 'Heuristic: ours unchanged, adopted theirs', confidenceScore: 0.9 };
  }
  if (hunk.baseCode && hunk.theirsCode === hunk.baseCode) {
    return { resolvedCode: hunk.oursCode, explanation: 'Heuristic: theirs unchanged, adopted ours', confidenceScore: 0.9 };
  }

  // If one side has more complete logic or both are independent blocks
  const oursLines = hunk.oursCode.split('\n');
  const theirsLines = hunk.theirsCode.split('\n');

  // Check if theirs is purely appended statements or modifications inside function body
  if (hunk.kind === 'FunctionDeclaration' || hunk.kind === 'MethodDeclaration') {
    // Merge function bodies by unioning inner statements
    const oursBodyMatch = hunk.oursCode.match(/\{([\s\S]*)\}/);
    const theirsBodyMatch = hunk.theirsCode.match(/\{([\s\S]*)\}/);

    if (oursBodyMatch && theirsBodyMatch) {
      const oursBody = oursBodyMatch[1].trim();
      const theirsBody = theirsBodyMatch[1].trim();

      const combinedBody = oursBody.includes(theirsBody)
        ? oursBody
        : theirsBody.includes(oursBody)
        ? theirsBody
        : `${oursBody}\n\n  // Merged changes from complementary branch\n  ${theirsBody}`;

      const header = hunk.oursCode.slice(0, hunk.oursCode.indexOf('{') + 1);
      const footer = hunk.oursCode.slice(hunk.oursCode.lastIndexOf('}'));
      const synthesized = `${header}\n  ${combinedBody}\n${footer}`;

      return {
        resolvedCode: synthesized,
        explanation: 'Heuristic: combined non-conflicting inner function logic',
        confidenceScore: 0.8,
      };
    }
  }

  // Default heuristic: concatenate distinct lines
  const combined = Array.from(new Set([...oursLines, ...theirsLines])).join('\n');
  return {
    resolvedCode: combined,
    explanation: 'Heuristic: union of statement lines',
    confidenceScore: 0.7,
  };
}

/**
 * Resolve a conflicted code hunk using AI semantic reasoning + compiler syntax verification.
 */
export async function resolveSemanticConflictHunk(
  hunk: SemanticConflictHunk,
  llmCaller?: AiLlmCaller
): Promise<AiConflictResolutionResult> {
  const prompt = buildConflictResolutionPrompt(hunk);
  let parsed: AiResolutionResponse;
  let rawText = '';

  try {
    if (llmCaller) {
      const response = await llmCaller(prompt);
      rawText = typeof response === 'string' ? response : JSON.stringify(response);
      parsed = parseAiResolutionResponse(response);
    } else {
      parsed = heuristicSynthesizeHunk(hunk);
      rawText = JSON.stringify(parsed);
    }
  } catch (err: any) {
    return {
      success: false,
      syntaxValid: false,
      hasConflictMarkers: false,
      error: `LLM invocation failed: ${err.message}`,
    };
  }

  // 1. Check for conflict markers
  const hasMarkers = hasGitConflictMarkers(parsed.resolvedCode);
  if (hasMarkers) {
    return {
      success: false,
      resolvedCode: parsed.resolvedCode,
      explanation: parsed.explanation,
      confidenceScore: parsed.confidenceScore,
      syntaxValid: false,
      hasConflictMarkers: true,
      rawResponse: rawText,
      error: 'AI generated code contains residual Git conflict markers',
    };
  }

  // 2. Validate syntax via TypeScript compiler
  const syntaxCheck = validateCodeSyntax(parsed.resolvedCode, hunk.filePath);

  return {
    success: syntaxCheck.valid && !hasMarkers,
    resolvedCode: parsed.resolvedCode,
    explanation: parsed.explanation,
    confidenceScore: parsed.confidenceScore,
    syntaxValid: syntaxCheck.valid,
    syntaxErrors: syntaxCheck.errors.length > 0 ? syntaxCheck.errors : undefined,
    hasConflictMarkers: false,
    rawResponse: rawText,
  };
}
