import { describe, expect, it } from 'vitest';
import { jobIds, safeJobIdPart } from './definitions';
import { MemoryJobEnqueuer } from './memory';

describe('job ids', () => {
  it('never contain ":" even when components do', () => {
    const ids = [
      jobIds.sync('s1', '2026-10-30T2'),
      jobIds.proactive('s1', '2026-10-30T00:35:00.000Z'),
      jobIds.proactive('s1', 'deferred-2026-10-30T07:00:00.000Z'),
      jobIds.inbound('m1'),
      jobIds.weekly('s1', '2026-11-02'),
      jobIds.tick(),
      jobIds.browserPrefix('s1'),
    ];
    for (const id of ids) expect(id).not.toContain(':');
    expect(jobIds.sync('s1', 'b').startsWith(jobIds.browserPrefix('s1'))).toBe(true);
    expect(safeJobIdPart('a:b:c')).toBe('a-b-c');
  });

  it('the memory enqueuer rejects raw ids with ":" like BullMQ does', async () => {
    const q = new MemoryJobEnqueuer();
    await expect(q.enqueue('scheduler.tick', {}, { jobId: 'bad:id' })).rejects.toThrow(/contains ":"/);
    await expect(q.enqueue('scheduler.tick', {}, { jobId: jobIds.tick() })).resolves.toBeTruthy();
  });
});
