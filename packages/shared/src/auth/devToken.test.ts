import { describe, expect, it } from 'vitest';
import { createDevToken, verifyDevToken } from './devToken';

describe('dev token', () => {
  it('round-trips and rejects tampering, wrong secret, and expiry', () => {
    const t = createDevToken({ sub: 'dev:alice', email: 'alice@example.com' }, 'secret-1');
    expect(verifyDevToken(t, 'secret-1')).toMatchObject({ sub: 'dev:alice', email: 'alice@example.com' });
    expect(verifyDevToken(t, 'secret-2')).toBeNull();
    expect(verifyDevToken(t.replace('dev.', 'dev.x'), 'secret-1')).toBeNull();
    const expired = createDevToken({ sub: 'a', email: 'a@x.com', exp: 1 }, 'secret-1');
    expect(verifyDevToken(expired, 'secret-1')).toBeNull();
    expect(verifyDevToken('garbage', 'secret-1')).toBeNull();
  });
});
