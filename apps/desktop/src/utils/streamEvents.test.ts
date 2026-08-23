import { describe, expect, it } from 'vitest';
import { ansiToHtml, cleanAgentLog, formatAgyEvent, normalizeTerminalText, processStreamEvent, stripAnsiToPlainText } from './streamTestUtils';

describe('Real-time Stream & Thought Event Parsing', () => {
  describe('formatAgyEvent parsing under varied payloads', () => {
    it('handles null, undefined, and empty object gracefully without throwing', () => {
      expect(formatAgyEvent(null)).toBe('');
      expect(formatAgyEvent(undefined)).toBe('');
      expect(formatAgyEvent({})).toBe('');
      expect(formatAgyEvent({ event: 'unknown_event' })).toBe('');
    });

    it('parses thought and reasoning deltas from step_update events', () => {
      expect(formatAgyEvent({
        event: 'step_update',
        step_update: { step_type: 'thought', thought_delta: 'Phân tích mã ngu?n...' }
      })).toBe('Phân tích mã ngu?n...');

      expect(formatAgyEvent({
        event: 'step_update',
        step_update: { step_type: 'reasoning', reasoning_content: 'Ki?m tra schema MCP...' }
      })).toBe('Ki?m tra schema MCP...');

      expect(formatAgyEvent({
        event: 'step_update',
        step_update: { step_type: 'thought', thought: 'Fallback thought property' }
      })).toBe('Fallback thought property');

      expect(formatAgyEvent({
        event: 'step_update',
        step_update: { step_type: 'thought', text_delta: 'Fallback text_delta property' }
      })).toBe('Fallback text_delta property');
    });

    it('parses standalone thought events (OpenAI / Gemini reasoning stream)', () => {
      expect(formatAgyEvent({
        event: 'thought',
        thought_delta: 'Thinking chunk 1'
      })).toBe('Thinking chunk 1');

      expect(formatAgyEvent({
        event: 'thought',
        delta: 'Thinking chunk 2'
      })).toBe('Thinking chunk 2');

      expect(formatAgyEvent({
        event: 'thought',
        reasoning_content: 'Thinking chunk 3'
      })).toBe('Thinking chunk 3');

      expect(formatAgyEvent({
        event: 'thought',
        thought: 'Thinking chunk 4'
      })).toBe('Thinking chunk 4');
    });

    it('parses tool calls (active and done states) with varied parameter types', () => {
      // Active tool call with TargetFile
      const active1 = formatAgyEvent({
        event: 'step_update',
        step_update: {
          step_type: 'tool',
          state: 'ACTIVE',
          tool_name: 'view_file',
          tool_info: { parameters: { TargetFile: 'src/main.ts' } }
        }
      });
      expect(active1).toContain('?? [view_file] src/main.ts');

      // Active tool call with CommandLine
      const active2 = formatAgyEvent({
        event: 'step_update',
        step_update: {
          step_type: 'tool',
          state: 'ACTIVE',
          tool_name: 'run_command',
          tool_info: { parameters: { CommandLine: 'npm test' } }
        }
      });
      expect(active2).toContain('?? [run_command] npm test');

      // Completed tool call with duration and output
      const done = formatAgyEvent({
        event: 'step_update',
        step_update: {
          step_type: 'tool',
          state: 'DONE',
          tool_name: 'run_command',
          duration_seconds: 1.456,
          tool_info: { output: 'All 10 tests passed' }
        }
      });
      expect(done).toContain('? [run_command done] (1.46s) ? All 10 tests passed');
    });

    it('parses agent response text deltas and final result with tokens', () => {
      expect(formatAgyEvent({
        event: 'step_update',
        step_update: { step_type: 'agent_response', text_delta: 'Here is the diff.' }
      })).toBe('Here is the diff.');

      const result = formatAgyEvent({
        event: 'result',
        result: {
          response: 'Task complete!',
          usage: { total_tokens: 12500 }
        }
      });
      expect(result).toContain('?? Task complete!');
      expect(result).toContain('Total tokens: 12,500');
    });
  });

  describe('AgentConsoleModal Stream Card state machine simulation', () => {
    it('aggregates multiple incremental thought deltas into a single cohesive thought card', () => {
      const cards: any[] = [];
      const now = '12:00:00';

      // Step 1: thought delta 1
      processStreamEvent(cards, {
        event: 'step_update',
        step_update: { step_index: 0, step_type: 'thought', thought_delta: 'Bu?c 1: Kh?i t?o... ', state: 'RUNNING' }
      }, now);
      expect(cards.length).toBe(1);
      expect(cards[0].type).toBe('thought');
      expect(cards[0].text).toBe('Bu?c 1: Kh?i t?o... ');
      expect(cards[0].status).toBe('in_progress');

      // Step 2: thought delta 2 on same step_index
      processStreamEvent(cards, {
        event: 'step_update',
        step_update: { step_index: 0, step_type: 'thought', thought_delta: 'Bu?c 2: Phân tích dependencies.', state: 'DONE' }
      }, now);
      expect(cards.length).toBe(1);
      expect(cards[0].text).toBe('Bu?c 1: Kh?i t?o... Bu?c 2: Phân tích dependencies.');
      expect(cards[0].status).toBe('completed');
    });

    it('handles standalone thought events stream (unindexed deltas)', () => {
      const cards: any[] = [];
      const now = '12:00:00';

      processStreamEvent(cards, {
        event: 'thought',
        thought_delta: 'Ðang suy nghi...'
      }, now);
      expect(cards.length).toBe(1);
      expect(cards[0].type).toBe('thought');
      expect(cards[0].text).toBe('Ðang suy nghi...');
    });

    it('handles Codex format thought items (item.started and item.completed)', () => {
      const cards: any[] = [];
      const now = '12:00:00';

      processStreamEvent(cards, {
        type: 'item.started',
        item: { id: 'th-100', type: 'thought', text: 'B?t d?u suy nghi...' }
      }, now);
      expect(cards.length).toBe(1);
      expect(cards[0].type).toBe('thought');
      expect(cards[0].status).toBe('in_progress');

      processStreamEvent(cards, {
        type: 'item.completed',
        item: { id: 'th-100', type: 'thought', text: 'Hoàn thành suy nghi v?i k? ho?ch chi ti?t.' }
      }, now);
      expect(cards.length).toBe(1);
      expect(cards[0].text).toBe('Hoàn thành suy nghi v?i k? ho?ch chi ti?t.');
    });

    it('interleaves user messages, tool executions, thoughts, and turn completions correctly', () => {
      const cards: any[] = [];
      const now = '12:00:00';

      // 1. User message
      processStreamEvent(cards, { type: 'user_message', text: 'Tri?n khai tính nang X' }, now);
      // 2. Thought
      processStreamEvent(cards, { event: 'step_update', step_update: { step_index: 1, step_type: 'thought', thought_delta: 'Suy nghi...', state: 'DONE' } }, now);
      // 3. Tool execution
      processStreamEvent(cards, { type: 'item.started', item: { id: 'cmd-1', type: 'command_execution', command: 'git status' } }, now);
      processStreamEvent(cards, { type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'git status', exit_code: 0, aggregated_output: 'clean' } }, now);
      // 4. Agent response
      processStreamEvent(cards, { type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Ðã th?c hi?n xong.' } }, now);
      // 5. Turn completed
      processStreamEvent(cards, { type: 'turn.completed', usage: { total_tokens: 500 } }, now);

      expect(cards.length).toBe(5);
      expect(cards.map(c => c.type)).toEqual(['user_message', 'thought', 'command_execution', 'agent_message', 'turn_completed']);

      // Filter conversation cards (user_message, agent_message, turn_completed, thought)
      const conversationCards = cards.filter(c => c.type === 'user_message' || c.type === 'agent_message' || c.type === 'turn_completed' || c.type === 'thought');
      expect(conversationCards.length).toBe(4);
      expect(conversationCards.find(c => c.type === 'command_execution')).toBeUndefined();
    });
  });

  describe('ANSI terminal cleaning and HTML formatting robustness', () => {
    it('normalizes carriage returns and strips terminal escapes in cleanAgentLog', () => {
      const raw = 'Downloading [=====>    ] 50%\rDownloading [==========] 100%\n\x1b[32mSuccess!\x1b[0m';
      const cleaned = cleanAgentLog(raw);
      expect(cleaned).toContain('Downloading [==========] 100%');
      expect(cleaned).not.toContain('50%');
      expect(cleaned).toContain('Success!');
      expect(cleaned).not.toContain('\x1b');
    });

    it('normalizes complex terminal sequences including DECSCUSR in normalizeTerminalText', () => {
      const raw = 'Progress: 100%\n\x1b[0 q\x1b[?25hReady';
      const normalized = normalizeTerminalText(raw);
      expect(normalized).toContain('Progress: 100%');
      expect(normalized).toContain('Ready');
      expect(normalized).not.toContain('\x1b');
    });

    it('converts ANSI color sequences and SGR styling to valid HTML', () => {
      const raw = '\x1b[31;1mError:\x1b[0m \x1b[32mFound 0 bugs\x1b[0m';
      const html = ansiToHtml(raw);
      expect(html).toContain('color: #f87171');
      expect(html).toContain('font-weight: 700');
      expect(html).toContain('Error:');
      expect(html).toContain('color: #4ade80');
      expect(html).toContain('Found 0 bugs');
    });

    it('strips all ANSI codes to clean plain text', () => {
      const raw = '\x1b[1;34m[INFO]\x1b[0m Service started on \x1b[4mport 8000\x1b[0m';
      const plain = stripAnsiToPlainText(raw);
      expect(plain).toBe('[INFO] Service started on port 8000');
    });
  });
});
