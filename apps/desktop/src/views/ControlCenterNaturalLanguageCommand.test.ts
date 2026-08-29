import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';

describe('ControlCenter Natural Language Command & Chat Trigger Recognition', () => {
  it('parses natural language triggers including run lai tu dau, /run, chay lai and task keys', () => {
    expect(controlCenterSource).toContain('isRunCommand');
    expect(controlCenterSource).toContain('isResetOrRerunFromStart');
    expect(controlCenterSource).toContain('launchEpic(isResetOrRerunFromStart)');
  });

  it('supports resetFromStart parameter in launchEpic to restart sequence from the first task', () => {
    expect(controlCenterSource).toContain('const launchEpic = async (resetFromStart = false)');
    expect(controlCenterSource).toContain('completedIds: resetFromStart ? [] : tasks');
  });

  it('records assistant acknowledgment in conversation thread before triggering execution', () => {
    expect(controlCenterSource).toContain('thread.addAgentMessage');
    expect(controlCenterSource).toContain('Đã nhận lệnh:');
  });
});