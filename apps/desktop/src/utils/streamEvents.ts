/**
 * Stream Event Serialization & Parsing Utilities
 */

export interface StreamEvent {
  type: string;
  [key: string]: any;
}

export function serializeStreamEvent(event: StreamEvent): string {
  return JSON.stringify(event);
}

export function parseStreamEvent(payload: string): StreamEvent {
  try {
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    return { type: 'unknown', raw: payload };
  }
}
