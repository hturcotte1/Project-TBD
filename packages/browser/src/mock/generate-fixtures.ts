#!/usr/bin/env node
// Generates fixtures/generated/*.html once from the mock site's own render functions, so the
// extractor tests can run against realistic HTML with no browser at all. Run with:
//   pnpm -F @tbd/browser exec tsx src/mock/generate-fixtures.ts
// and check the output into git — CI does not regenerate these on the fly.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activitiesPage,
  collegeQuestionsPage,
  collegeRecommendersPage,
  collegeReviewSubmitPage,
  collegeWritingSupplementPage,
  coursesGradesPage,
  dashboardPage,
  educationPage,
  familyPage,
  loginPage,
  maintenancePage,
  myCollegesPage,
  profilePage,
  testingPage,
  verificationPage,
  writingPage,
} from './render';
import { defaultMockState } from './state';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '../../fixtures/generated');

async function main(): Promise<void> {
  const state = defaultMockState();
  await mkdir(OUT_DIR, { recursive: true });

  const pages: Record<string, string> = {
    login: loginPage(),
    login_error: loginPage({ error: 'Incorrect email or password. Please try again.' }),
    verification: verificationPage(),
    verification_error: verificationPage({ error: "That code didn't match. Please check your email and try again." }),
    maintenance: maintenancePage(),
    dashboard: dashboardPage(state),
    my_colleges: myCollegesPage(state),
    ca_profile: profilePage(state),
    ca_family: familyPage(state),
    ca_education: educationPage(state),
    ca_testing: testingPage(state),
    ca_activities: activitiesPage(state, state.activities.length),
    ca_writing: writingPage(state),
    ca_courses_grades: coursesGradesPage(state),
  };

  for (const college of state.colleges) {
    pages[`college_questions_${college.slug}`] = collegeQuestionsPage(college);
    pages[`college_writing_supplement_${college.slug}`] = collegeWritingSupplementPage(college);
    pages[`college_recommenders_${college.slug}`] = collegeRecommendersPage(college);
    pages[`college_review_submit_${college.slug}`] = collegeReviewSubmitPage(college);
  }

  for (const [name, html] of Object.entries(pages)) {
    await writeFile(join(OUT_DIR, `${name}.html`), html);
  }
  console.error(`wrote ${Object.keys(pages).length} fixtures to ${OUT_DIR}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
