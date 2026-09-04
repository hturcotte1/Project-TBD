import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { StorageProvider, StoredObject } from './storage';

function safeKey(key: string): string {
  if (!/^[A-Za-z0-9_\-./]+$/.test(key) || key.includes('..')) throw new Error(`invalid storage key: ${key}`);
  return key;
}

/** Local-disk storage for development. Served by the API at `${baseUrl}/dev/storage/<key>`. */
export class LocalDiskStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  constructor(
    private readonly rootDir: string,
    private readonly baseUrl: string,
  ) {}

  private pathFor(key: string): string {
    const p = resolve(this.rootDir, safeKey(key));
    if (!p.startsWith(resolve(this.rootDir) + sep)) throw new Error('storage path escape');
    return p;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    await writeFile(`${p}.meta.json`, JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<StoredObject | null> {
    const p = this.pathFor(key);
    try {
      const [body, meta] = await Promise.all([readFile(p), readFile(`${p}.meta.json`, 'utf8')]);
      return { body, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const p = this.pathFor(key);
    await rm(p, { force: true });
    await rm(`${p}.meta.json`, { force: true });
  }

  async deletePrefix(prefix: string): Promise<number> {
    const p = this.pathFor(prefix.replace(/\/$/, ''));
    let count = 0;
    try {
      const s = await stat(p);
      if (s.isDirectory()) {
        const walk = async (dir: string): Promise<void> => {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (!entry.name.endsWith('.meta.json')) count++;
          }
        };
        await walk(p);
        await rm(p, { recursive: true, force: true });
      }
    } catch {
      return 0;
    }
    return count;
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl.replace(/\/$/, '')}/dev/storage/${safeKey(key)}`;
  }
}
