import { describe, expect, it } from 'vitest';
import mainSource from './main.ts?raw';

describe('Control Center button feedback', () => {
  it('marks a clicked button as processing and blocks repeat clicks during acknowledgement', () => {
    expect(mainSource).toContain("target.closest('.cc-shell button')");
    expect(mainSource).toContain("button.dataset.actionPending = 'true'");
    expect(mainSource).toContain("button.setAttribute('aria-busy', 'true')");
    expect(mainSource).toContain('event.stopImmediatePropagation()');
    expect(mainSource).toContain('clearPendingButton');
  });
});
