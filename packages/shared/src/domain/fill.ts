import type { Activity, StudentProfile, Student } from '../db/schema';
import type { FillFieldsPayload } from '../schemas/approvals';

/**
 * Build the exact payload the writer will type into Common App, from the student's own data.
 * The agent never invents values: everything here comes from rows the student created or confirmed.
 */
export function buildActivitiesFillPayload(activities: Activity[]): FillFieldsPayload {
  const sorted = [...activities].sort((a, b) => a.position - b.position).slice(0, 10);
  const fields: FillFieldsPayload['fields'] = [];
  sorted.forEach((a, i) => {
    const p = `activities[${i}]`;
    fields.push(
      { path: `${p}.activity_type`, label: `Activity ${i + 1} type`, value: a.activityType },
      { path: `${p}.position`, label: `Activity ${i + 1} position`, value: a.positionTitle },
      { path: `${p}.organization`, label: `Activity ${i + 1} organization`, value: a.organization },
      { path: `${p}.description`, label: `Activity ${i + 1} description`, value: a.description },
      { path: `${p}.grade_levels`, label: `Activity ${i + 1} grades`, value: a.gradeLevels.join(',') },
      { path: `${p}.timing`, label: `Activity ${i + 1} timing`, value: a.timing.join(',') },
      { path: `${p}.hours_per_week`, label: `Activity ${i + 1} hours/week`, value: Number(a.hoursPerWeek) },
      { path: `${p}.weeks_per_year`, label: `Activity ${i + 1} weeks/year`, value: a.weeksPerYear },
      { path: `${p}.continue_in_college`, label: `Activity ${i + 1} continue in college`, value: a.continueInCollege },
    );
  });
  return { kind: 'fill_fields', section: 'activities', school_slug: null, fields, origin: 'student_profile' };
}

export function buildProfileFillPayload(student: Student, profile: StudentProfile): FillFieldsPayload {
  const fields: FillFieldsPayload['fields'] = [
    { path: 'profile.first_name', label: 'First name', value: student.firstName },
    { path: 'profile.last_name', label: 'Last name', value: student.lastName },
    { path: 'education.high_school', label: 'High school', value: student.highSchool },
  ];
  if (student.graduationYear) fields.push({ path: 'education.graduation_year', label: 'Graduation year', value: student.graduationYear });
  if (profile.academics.gpa_unweighted !== null)
    fields.push({ path: 'education.gpa_unweighted', label: 'Unweighted GPA', value: profile.academics.gpa_unweighted });
  if (profile.academics.gpa_weighted !== null)
    fields.push({ path: 'education.gpa_weighted', label: 'Weighted GPA', value: profile.academics.gpa_weighted });
  if (profile.academics.class_rank !== null)
    fields.push({ path: 'education.class_rank', label: 'Class rank', value: profile.academics.class_rank });
  return { kind: 'fill_fields', section: 'profile', school_slug: null, fields, origin: 'student_profile' };
}

/** Personal essay: text must have been authored by the student (dashboard editor or a text). */
export function buildPersonalEssayFillPayload(text: string, origin: 'dashboard_editor' | 'student_message', promptIndex: number | null): FillFieldsPayload {
  const fields: FillFieldsPayload['fields'] = [{ path: 'writing.personal_essay', label: 'Personal essay', value: text }];
  if (promptIndex) fields.push({ path: 'writing.prompt_index', label: 'Prompt', value: promptIndex });
  return { kind: 'fill_fields', section: 'personal_essay', school_slug: null, fields, origin };
}

/** Short, human summary the agent texts before asking for a yes. */
export function summarizeFillPayload(p: FillFieldsPayload): string {
  switch (p.section) {
    case 'activities': {
      const n = p.fields.filter((f) => f.path.endsWith('.position')).length;
      return `${n} activit${n === 1 ? 'y' : 'ies'} into the Common App Activities section`;
    }
    case 'profile':
      return `${p.fields.length} profile/education fields into Common App`;
    case 'personal_essay':
      return 'your personal essay (the text you wrote) into Common App Writing';
    case 'college_questions':
      return `${p.fields.length} answers into ${p.school_slug ?? 'the college'}'s questions`;
  }
}
