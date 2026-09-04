import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { studentsRepo } from '@tbd/shared/db';
import { AuthorizationError } from '@tbd/shared/db';
import { mapStudent } from '../mappers';
import { authed, type Handlers } from './contract';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = readVersion();

export const identityHandlers: Pick<Handlers, 'health' | 'me'> = {
  health: async () => ({ ok: true, version: VERSION }),

  me: authed(async ({ auth, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    return mapStudent(student);
  }),
};
