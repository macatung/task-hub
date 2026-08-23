import { ansiToHtml, escapeHtml, normalizeTerminalText, stripAnsiToPlainText } from './ansi';

export { ansiToHtml, escapeHtml, normalizeTerminalText, stripAnsiToPlainText };

export function formatAgyEvent(event: any): string {
  if (!event) return '';
  if (event.event === 'step_update') {
    const su = event.step_update;
    if (su.step_type === 'tool') {
      const toolName = su.tool_name || su.tool_info?.name || 'tool';
      const params = su.tool_info?.parameters || {};
      const target = params.AbsolutePath || params.TargetFile || params.CommandLine || params.Query || (Object.keys(params).length ? JSON.stringify(params) : '');
      if (su.state === 'ACTIVE') {
        return `\n?? [${toolName}] ${target}\n`;
      }
      if (su.state === 'DONE') {
        const dur = su.duration_seconds ? ` (${su.duration_seconds.toFixed(2)}s)` : '';
        const out = su.tool_info?.output ? ` ? ${su.tool_info.output}` : '';
        return `? [${toolName} done]${dur}${out}\n`;
      }
    } else if (su.step_type === 'thought' || su.step_type === 'reasoning') {
      const thought = su.thought_delta || su.reasoning_content || su.thought || su.text_delta || '';
      return thought;
    } else if (su.step_type === 'agent_response' && su.text_delta) {
      return su.text_delta;
    }
  } else if (event.event === 'thought') {
    const thought = event.thought_delta || event.delta || event.reasoning_content || event.thought || '';
    return thought;
  } else if (event.event === 'result') {
    const res = event.result;
    const resp = res?.response ? `\n?? ${res.response}\n` : '';
    const tokens = res?.usage?.total_tokens ? `? Hoàn t?t · Total tokens: ${res.usage.total_tokens.toLocaleString()}\n` : '';
    return `${resp}${tokens}`;
  }
  return '';
}

export function cleanAgentLog(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n');
  text = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
  text = text.replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, '');
  text = text.replace(/\x1b\([0-2B]/g, '');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F]/g, '');

  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.includes('\r')) {
      const parts = rawLine.split('\r');
      const last = parts.filter((p) => p.length > 0).pop() ?? '';
      lines.push(last);
    } else {
      lines.push(rawLine);
    }
  }
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

export function processStreamEvent(streamCards: any[], ev: any, now: string) {
  // 1. Codex format events
  if (ev.type === 'user_message') {
    streamCards.push({
      id: `user-${Date.now()}`,
      type: 'user_message',
      text: ev.text,
      time: now,
    });
  } else if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
    streamCards.push({
      id: ev.item.id || `msg-${Date.now()}`,
      type: 'agent_message',
      text: ev.item.text,
      time: now,
    });
  } else if ((ev.type === 'item.completed' || ev.type === 'item.started') && (ev.item?.type === 'thought' || ev.item?.type === 'reasoning')) {
    const cardId = ev.item.id || `thought-${Date.now()}`;
    const existing = streamCards.find((c) => c.id === cardId);
    if (existing && existing.type === 'thought') {
      if (ev.item.text) existing.text = ev.item.text;
    } else if (ev.item?.text) {
      streamCards.push({
        id: cardId,
        type: 'thought',
        text: ev.item.text,
        status: ev.type === 'item.completed' ? 'completed' : 'in_progress',
        time: now,
      });
    }
  } else if (ev.type === 'item.started' && ev.item?.type === 'command_execution') {
    const existing = streamCards.find((c) => c.id === ev.item.id);
    if (existing) {
      existing.status = 'in_progress';
      existing.command = ev.item.command;
    } else {
      streamCards.push({
        id: ev.item.id || `cmd-${Date.now()}`,
        type: 'command_execution',
        command: ev.item.command,
        status: 'in_progress',
        expanded: false,
        time: now,
      });
    }
  } else if (ev.type === 'item.completed' && ev.item?.type === 'command_execution') {
    const existing = streamCards.find((c) => c.id === ev.item.id);
    if (existing) {
      existing.status = ev.item.status || (ev.item.exit_code === 0 ? 'completed' : 'failed');
      existing.output = ev.item.aggregated_output;
      existing.exitCode = ev.item.exit_code;
    } else {
      streamCards.push({
        id: ev.item.id || `cmd-${Date.now()}`,
        type: 'command_execution',
        command: ev.item.command,
        status: ev.item.status || 'completed',
        output: ev.item.aggregated_output,
        exitCode: ev.item.exit_code,
        expanded: false,
        time: now,
      });
    }
  } else if (ev.type === 'turn.completed') {
    streamCards.push({
      id: `turn-${Date.now()}`,
      type: 'turn_completed',
      usage: ev.usage,
      time: now,
    });
  }

  // 2. Antigravity (agy) format events
  else if (ev.event === 'step_update' && (ev.step_update?.step_type === 'thought' || ev.step_update?.step_type === 'reasoning' || ev.step_update?.thought_delta || ev.step_update?.reasoning_content)) {
    const su = ev.step_update;
    const cardId = `agy-thought-${su.step_index ?? 'current'}`;
    const thoughtDelta = su.thought_delta || su.reasoning_content || su.thought || su.text_delta || '';
    const existing = streamCards.find((c) => c.id === cardId);

    if (existing && existing.type === 'thought') {
      if (thoughtDelta) existing.text = (existing.text || '') + thoughtDelta;
      if (su.state === 'DONE') existing.status = 'completed';
    } else if (thoughtDelta) {
      streamCards.push({
        id: cardId,
        type: 'thought',
        text: thoughtDelta,
        status: su.state === 'DONE' ? 'completed' : 'in_progress',
        time: now,
      });
    }
  } else if (ev.event === 'thought') {
    const cardId = `agy-thought-${Date.now()}`;
    const thoughtDelta = ev.thought_delta || ev.delta || ev.reasoning_content || ev.thought || '';
    const lastThought = [...streamCards].reverse().find((c) => c.type === 'thought' && c.status === 'in_progress');
    if (lastThought && thoughtDelta) {
      lastThought.text = (lastThought.text || '') + thoughtDelta;
    } else if (thoughtDelta) {
      streamCards.push({
        id: cardId,
        type: 'thought',
        text: thoughtDelta,
        status: 'completed',
        time: now,
      });
    }
  } else if (ev.event === 'step_update' && ev.step_update?.step_type === 'tool') {
    const su = ev.step_update;
    const cardId = `agy-tool-${su.step_index ?? Date.now()}`;
    const toolName = su.tool_name || su.tool_info?.name || 'tool';
    const params = su.tool_info?.parameters || {};
    const paramSummary = params.AbsolutePath || params.TargetFile || params.CommandLine || params.Query || (Object.keys(params).length ? JSON.stringify(params) : '');
    const existing = streamCards.find((c) => c.id === cardId);

    if (existing) {
      existing.status = su.state === 'DONE' ? 'completed' : 'in_progress';
      if (su.duration_seconds) existing.duration = `${su.duration_seconds.toFixed(2)}s`;
      if (su.tool_info?.output) existing.output = su.tool_info.output;
    } else {
      streamCards.push({
        id: cardId,
        type: 'tool_execution',
        toolName,
        command: paramSummary,
        status: su.state === 'DONE' ? 'completed' : 'in_progress',
        expanded: false,
        duration: su.duration_seconds ? `${su.duration_seconds.toFixed(2)}s` : undefined,
        output: su.tool_info?.output,
        time: now,
      });
    }
  }
}
