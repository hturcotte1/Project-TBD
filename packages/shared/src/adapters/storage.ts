export interface StoredObject {
  body: Buffer;
  contentType: string;
}

/** Object storage for uploads, inbound photos, and screenshots. Keys are `<studentId>/<kind>/<uuid>.<ext>`. */
export interface StorageProvider {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Delete everything under a prefix (account deletion). */
  deletePrefix(prefix: string): Promise<number>;
  /** URL a browser or the messaging provider can fetch; signed and time-limited where supported. */
  getUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string>;
}
