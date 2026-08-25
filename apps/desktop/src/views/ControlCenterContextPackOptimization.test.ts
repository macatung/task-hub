import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';

describe('ControlCenter Context Pack Optimization & Local Cache Flow', () => {
  it('imports and initializes useContextPackCache in ControlCenter', () => {
    expect(controlCenterSource).toContain("import { useContextPackCache } from '../composables/useContextPackCache'");
    expect(controlCenterSource).toContain('const contextPackCache = useContextPackCache()');
  });

  it('triggers background prefetchQueue when tasks are refreshed', () => {
    expect(controlCenterSource).toContain('contextPackCache.prefetchQueue(sync.agentTasks.value, mcp)');
  });

  it('triggers instant prefetch when a task is selected from queue', () => {
    expect(controlCenterSource).toContain('contextPackCache.prefetch(task.id, mcp, (task as any).updated_at)');
  });

  it('optimizes launch by checking fresh local cache before network fetch', () => {
    expect(controlCenterSource).toContain('contextPackCache.get(selectedTask.value.id)');
    expect(controlCenterSource).toContain('contextPackCache.isFresh(selectedTask.value.id, taskUpdatedAt)');
    expect(controlCenterSource).toContain('Nạp Context Pack cục bộ đã đồng bộ sẵn…');
  });

  it('invalidates cached context packs when documentation is saved or synced to Hub', () => {
    expect(controlCenterSource).toContain('contextPackCache.invalidate()');
  });
});
