import { normalizeTerminalText } from './ansi';

export type ParsedResponseOutput = {
  responses: string[];
  latestResponse: string;
  latestProgress?: string;
  technicalLines: string[];
  hasTechnicalDetails: boolean;
  hasRuntimeError: boolean;
};

const RESPONSE_MARKER = /^(?:💬\s*|(?:assistant|agent)\s*(?:response|message)?\s*[:：]|(?:final\s+answer|final\s+response|user-facing\s+response)\s*[:：])\s*/i;
const ERROR_LINE = /(?:\b(?:error|errors|fatal|exception|failed|failure|stderr)\b|✕|🛑|exit code:\s*(?!0\b)\d+)/i;
const PROGRESS_LINE = /^(?:[•▸>›]\s*)?(?:working(?:\s*\([^)]*\))?|i['’]?ll\s+(?:first\s+)?(?:load|check|inspect|review|run|start)|called\s+|explored\s+|read\s+|calling\s+|processing\b|loading\b|initiali[sz]ing\b|poll(?:ing)?\b|waiting\b|step\s+\d+|ca[o0]\s+(?:supervisor|session)|supervisor\s+|worker\s+|session\s+|process\s+(?:exited|started)|turn\s+(?:completed|started)|token(?:s| usage)?\s*[:=]|duration\s*[:=])/i;

const looksLikeJson = (line: string): boolean => {
  const value = line.trim();
  if (!(value.startsWith('{') || value.startsWith('['))) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return /["'](?:success|memories|memory_type|scope|tags|file_path|updated_at)["']\s*:/.test(value);
  }
};

const isTechnicalLine = (line: string): boolean => {
  const value = line.trim();
  if (!value) return true;
  if (looksLikeJson(value)) return true;
  if (/memory_recall|cao-mcp-server|code_supervisor|task-hub-\d|\b(?:stdout|stderr|tool call|tool_calls|command_execution)\b/i.test(value)) return true;
  if (/^(?:\[[^\]]+\]|\$\s|⚙|✓|✕|🛑|\d+\s+(?:progress|result|tool|thinking)\b)/i.test(value)) return true;
  if (ERROR_LINE.test(value)) return true;
  if (PROGRESS_LINE.test(value)) return true;
  return false;
};

const cleanResponseLine = (line: string): string => {
  const value = line.replace(/\s+$/, '');
  return value.replace(RESPONSE_MARKER, '').trimEnd();
};

const isUsefulProgress = (line: string): boolean => {
  const value = line.trim();
  return Boolean(value) && !looksLikeJson(value) && !/memory_recall|cao-mcp-server/i.test(value) && value.length <= 180;
};

/**
 * Separates user-facing agent prose from operational CAO/terminal output.
 * The input is never mutated and callers can continue to persist/display it as raw output.
 */
export function parseResponseOutput(raw: string): ParsedResponseOutput {
  const normalized = normalizeTerminalText(raw || '').replace(/\x1b\[[0-9;]*m/g, '');
  const lines = normalized.split(/\r?\n/);
  const responses: string[] = [];
  const technicalLines: string[] = [];
  const responseBuffer: string[] = [];
  let latestProgress: string | undefined;
  let hasRuntimeError = false;
  let explicitResponse = false;

  const flushResponse = () => {
    const text = responseBuffer.join('\n').trim();
    responseBuffer.length = 0;
    if (text) responses.push(text);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const value = line.trim();
    if (!value) {
      if (responseBuffer.length) responseBuffer.push('');
      continue;
    }

    const marker = RESPONSE_MARKER.test(value);
    if (marker) {
      flushResponse();
      explicitResponse = true;
      responseBuffer.push(cleanResponseLine(line));
      continue;
    }

    const technical = isTechnicalLine(line);
    if (technical) {
      flushResponse();
      technicalLines.push(line);
      if (ERROR_LINE.test(value)) hasRuntimeError = true;
      if (isUsefulProgress(line) && !ERROR_LINE.test(value)) latestProgress = value;
      continue;
    }

    // Unmarked prose is accepted as a response for normal agent runtimes.
    // Explicitly marked responses may contain markdown paragraphs separated by blanks.
    responseBuffer.push(line);
  }
  flushResponse();

  // If an output stream only contains operational text, expose its last meaningful line
  // as progress but never promote it to a user-facing response.
  const filteredResponses = responses.filter((text) => {
    if (!text) return false;
    if (!explicitResponse && text.split('\n').every((line) => isTechnicalLine(line))) return false;
    return true;
  });
  const latestResponse = filteredResponses.at(-1) || '';

  return {
    responses: filteredResponses,
    latestResponse,
    latestProgress,
    technicalLines,
    hasTechnicalDetails: technicalLines.length > 0,
    hasRuntimeError,
  };
}

export const responseOutputForDisplay = (raw: string, running: boolean, runStatus?: string): string => {
  const parsed = parseResponseOutput(raw);
  if (parsed.latestResponse) return parsed.latestResponse;
  if (running) return parsed.latestProgress ? `Đang xử lý · ${parsed.latestProgress}` : 'Agent đang xử lý ngữ cảnh…';
  if (runStatus === 'failed' || parsed.hasRuntimeError) return 'Run thất bại trước khi có phản hồi cuối từ agent.';
  if (runStatus === 'cancelled') return 'Run đã bị dừng.';
  if (runStatus === 'completed') return 'Run đã hoàn tất nhưng không có phản hồi hiển thị.';
  return '';
};
