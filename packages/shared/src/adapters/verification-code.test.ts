import { describe, expect, it } from 'vitest';
import { MemoryVerificationCodeChannel } from './verification-code';

describe('MemoryVerificationCodeChannel', () => {
  it('delivers a code published after the wait started, once', async () => {
    const ch = new MemoryVerificationCodeChannel();
    const p = ch.waitFor('job1', 1000);
    await ch.publish('job1', '123456');
    expect(await p).toBe('123456');
    expect(await ch.waitFor('job1', 10)).toBeNull();
  });
  it('delivers a code published before the wait', async () => {
    const ch = new MemoryVerificationCodeChannel();
    await ch.publish('job2', '654321');
    expect(await ch.waitFor('job2', 10)).toBe('654321');
  });
  it('times out and honours abort', async () => {
    const ch = new MemoryVerificationCodeChannel();
    expect(await ch.waitFor('none', 5)).toBeNull();
    const ac = new AbortController();
    const p = ch.waitFor('job3', 10_000, ac.signal);
    ac.abort();
    expect(await p).toBeNull();
  });
});
