/**
 * Some provider CLIs exit with code 0 after producing a natural-language
 * failure response. Treat those responses as failed runs so a handoff cannot
 * incorrectly move an unexecuted task into review.
 */
export function hasAgentReportedFailure(output: string): boolean {
  // CAO may echo the staged Task Hub protocol before its actual response.
  // That protocol intentionally contains the words "cannot be read" and
  // "prompt", which must not be mistaken for a provider-reported failure.
  const withoutProtocolEcho = output.replace(
    /Task Hub Desktop execution protocol:\s*1\.[\s\S]*?3\.\s*If the file cannot be read,[\s\S]*?Do not claim success\.?/gi,
    ' ',
  );
  const text = withoutProtocolEcho.replace(/\s+/g, ' ').trim();
  return /\bTASK_HUB_RUN_BLOCKED\b/i.test(text)
    || /\b(?:encountered|hit|reported) (?:a )?blocking error\b/i.test(text)
    || /\b(?:cannot|can't|could not|unable to|failed to)\b.{0,180}\b(?:read|access|open|load|follow|execute)\b.{0,180}\b(?:prompt|instructions?|task file|requirements?)\b/i.test(text);
}

/**
 * Calculates a composite outcome score (0-100) and verdict based on run metrics.
 */
export function calculateOutcomeScore(metrics: {
  testsPassed?: number;
  testsFailed?: number;
  hasHandoff?: boolean;
  hasSafetyViolations?: boolean;
  durationMs?: number;
}): { score: number; verdict: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' } {
  let score = 100;
  const passed = metrics.testsPassed || 0;
  const failed = metrics.testsFailed || 0;
  const total = passed + failed;

  if (total > 0) {
    const passRate = passed / total;
    score = Math.round(passRate * 80);
  }
  if (metrics.hasHandoff) score += 20;
  if (metrics.hasSafetyViolations) score -= 40;
  if (failed > 0) score -= Math.min(failed * 10, 30);

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 80 ? 'PASSED' : score >= 50 ? 'NEEDS_REVIEW' : 'FAILED';
  return { score, verdict };
}
