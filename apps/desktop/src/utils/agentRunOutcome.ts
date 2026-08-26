/**
 * Some provider CLIs exit with code 0 after producing a natural-language
 * failure response. Treat those responses as failed runs so a handoff cannot
 * incorrectly move an unexecuted task into review.
 */
export function hasAgentReportedFailure(output: string): boolean {
  const text = output.replace(/\s+/g, ' ').trim();
  return /\bTASK_HUB_RUN_BLOCKED\b/i.test(text)
    || /\b(?:encountered|hit|reported) (?:a )?blocking error\b/i.test(text)
    || /\b(?:cannot|can't|could not|unable to|failed to)\b.{0,180}\b(?:read|access|open|load|follow|execute)\b.{0,180}\b(?:prompt|instructions?|task file|requirements?)\b/i.test(text);
}
