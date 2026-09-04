import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export interface KeyRing {
  currentVersion: number;
  keys: Map<number, Buffer>;
}

/**
 * Parse `CREDENTIALS_ENCRYPTION_KEYS` ("1:base64,2:base64") into a key ring.
 * Every key must decode to exactly 32 bytes (AES-256).
 */
export function parseKeyRing(spec: string, currentVersion: number): KeyRing {
  const keys = new Map<number, Buffer>();
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(':');
    if (idx < 1) throw new Error('CREDENTIALS_ENCRYPTION_KEYS entries must look like "version:base64key"');
    const version = Number(part.slice(0, idx));
    const key = Buffer.from(part.slice(idx + 1), 'base64');
    if (!Number.isInteger(version) || version < 1) throw new Error(`bad key version "${part.slice(0, idx)}"`);
    if (key.length !== 32) throw new Error(`key version ${version} must be 32 bytes (got ${key.length})`);
    keys.set(version, key);
  }
  if (!keys.has(currentVersion)) throw new Error(`no key for CREDENTIALS_ENCRYPTION_KEY_VERSION=${currentVersion}`);
  return { currentVersion, keys };
}

export function encryptSecret(ring: KeyRing, plaintext: string, aad?: string): EncryptedBlob {
  const key = ring.keys.get(ring.currentVersion);
  if (!key) throw new Error('current encryption key missing');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: ring.currentVersion };
}

export function decryptSecret(ring: KeyRing, blob: EncryptedBlob, aad?: string): string {
  const key = ring.keys.get(blob.keyVersion);
  if (!key) throw new Error(`no key for version ${blob.keyVersion}; add it to CREDENTIALS_ENCRYPTION_KEYS`);
  const decipher = createDecipheriv('aes-256-gcm', key, blob.iv);
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]).toString('utf8');
}

/** Re-encrypt under the current key (key rotation). */
export function rotateSecret(ring: KeyRing, blob: EncryptedBlob, aad?: string): EncryptedBlob {
  return encryptSecret(ring, decryptSecret(ring, blob, aad), aad);
}

export function generateKeyBase64(): string {
  return randomBytes(32).toString('base64');
}
