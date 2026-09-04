import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateKeyBase64, parseKeyRing, rotateSecret } from './credentials';

describe('credential encryption', () => {
  const k1 = generateKeyBase64();
  const k2 = generateKeyBase64();

  it('round-trips with AAD and never stores plaintext', () => {
    const ring = parseKeyRing(`1:${k1}`, 1);
    const blob = encryptSecret(ring, 'hunter2', 'student:abc');
    expect(blob.ciphertext.toString('utf8')).not.toContain('hunter2');
    expect(blob.iv.length).toBe(12);
    expect(blob.authTag.length).toBe(16);
    expect(decryptSecret(ring, blob, 'student:abc')).toBe('hunter2');
  });

  it('fails on wrong AAD or tampered ciphertext', () => {
    const ring = parseKeyRing(`1:${k1}`, 1);
    const blob = encryptSecret(ring, 'hunter2', 'student:abc');
    expect(() => decryptSecret(ring, blob, 'student:other')).toThrow();
    const tampered = { ...blob, ciphertext: Buffer.from(blob.ciphertext.map((b) => b ^ 1)) };
    expect(() => decryptSecret(ring, tampered, 'student:abc')).toThrow();
  });

  it('supports key rotation across versions', () => {
    const ringV1 = parseKeyRing(`1:${k1}`, 1);
    const blob = encryptSecret(ringV1, 'secret');
    const ringV2 = parseKeyRing(`1:${k1},2:${k2}`, 2);
    expect(decryptSecret(ringV2, blob)).toBe('secret');
    const rotated = rotateSecret(ringV2, blob);
    expect(rotated.keyVersion).toBe(2);
    expect(decryptSecret(ringV2, rotated)).toBe('secret');
    const ringOnlyV2 = parseKeyRing(`2:${k2}`, 2);
    expect(() => decryptSecret(ringOnlyV2, blob)).toThrow(/no key for version 1/);
  });

  it('rejects malformed keys', () => {
    expect(() => parseKeyRing('1:notbase64enough', 1)).toThrow(/32 bytes/);
    expect(() => parseKeyRing(`1:${k1}`, 2)).toThrow(/no key for/);
  });
});
