/**
 * Grep-level guard: application code must not query student-owned tables without going through
 * StudentDb (scoped). Only the allow-listed files may use raw `db.select().from(<student table>)`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const STUDENT_TABLES = [
  'studentProfiles',
  'studentNarratives',
  'activities',
  'documents',
  'applications',
  'applicationItems',
  'commonAppSnapshots',
  'essays',
  'essayDrafts',
  'essayFeedback',
  'recommenders',
  'recommenderAssignments',
  'nextActions',
  'conversations',
  'messages',
  'approvals',
  'browserJobs',
  'credentials',
  'nudges',
  'weeklyPlans',
];

/** Files that legitimately query across students (identity, admin, maintenance, tests, seeds). */
const ALLOW = [
  /packages\/shared\/src\/db\/repos\/core\.ts$/,
  /packages\/shared\/src\/seed\//,
  /packages\/shared\/src\/testing\//,
  /\.test\.ts$/,
  /apps\/api\/src\/routes\/admin/,
  /apps\/api\/src\/auth\//,
  /apps\/api\/src\/webhooks\//,
  /apps\/worker\/src\/jobs\/maintenance/,
  /apps\/worker\/src\/scheduler\//,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', '.turbo', 'drizzle'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe('authorization scan', () => {
  it('no raw cross-student queries outside the allow-list', () => {
    const files = [...walk(join(ROOT, 'apps')), ...walk(join(ROOT, 'packages'))];
    const pattern = new RegExp(`\\.from\\(\\s*(?:S\\.|schema\\.)?(${STUDENT_TABLES.join('|')})\\s*\\)`, 'g');
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOW.some((re) => re.test(rel))) continue;
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(src))) {
        // A raw query is fine when its predicate comes from the scope: `.where(sdb.where(table, ...))`.
        const tail = src.slice(m.index, m.index + 400);
        if (/\.where\(\s*(?:sdb|scope|studentDb|this)\.where\(/.test(tail)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        violations.push(`${rel}:${line} queries ${m[1]} without StudentDb`);
      }
    }
    expect(violations).toEqual([]);
  });
});
