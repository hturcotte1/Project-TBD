import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapturedPages } from '../extract/snapshot';
import { defaultMockState } from '../mock/state';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GENERATED_FIXTURES_DIR = join(HERE, '../../fixtures/generated');
export const INJECTION_FIXTURES_DIR = join(HERE, '../../fixtures/injection');

/** Reads one fixture written by `src/mock/generate-fixtures.ts`, by its filename without `.html`. */
export function readFixture(name: string): string {
  return readFileSync(join(GENERATED_FIXTURES_DIR, `${name}.html`), 'utf-8');
}

export function readInjectionFixture(name: string): string {
  return readFileSync(join(INJECTION_FIXTURES_DIR, `${name}.html`), 'utf-8');
}

/** Every generated fixture assembled into the shape `extractSnapshot` expects. */
export function capturedPagesFromFixtures(): CapturedPages {
  const state = defaultMockState();
  const pages: CapturedPages = {
    dashboard: readFixture('dashboard'),
    my_colleges: readFixture('my_colleges'),
    ca_profile: readFixture('ca_profile'),
    ca_family: readFixture('ca_family'),
    ca_education: readFixture('ca_education'),
    ca_testing: readFixture('ca_testing'),
    ca_activities: readFixture('ca_activities'),
    ca_writing: readFixture('ca_writing'),
    ca_courses_grades: readFixture('ca_courses_grades'),
  };
  for (const college of state.colleges) {
    pages[`college_questions:${college.slug}`] = readFixture(`college_questions_${college.slug}`);
    pages[`college_writing_supplement:${college.slug}`] = readFixture(`college_writing_supplement_${college.slug}`);
    pages[`college_recommenders:${college.slug}`] = readFixture(`college_recommenders_${college.slug}`);
    pages[`college_review_submit:${college.slug}`] = readFixture(`college_review_submit_${college.slug}`);
  }
  return pages;
}
