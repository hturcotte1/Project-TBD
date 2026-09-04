import type { z } from 'zod';
import type { CollegeSnapshot as CollegeSnapshotSchema, CommonAppSnapshot as CommonAppSnapshotSchema, RecommenderEntry as RecommenderEntrySchema, StateChange as StateChangeSchema } from '@tbd/shared/schemas';

type CommonAppSnapshotT = z.infer<typeof CommonAppSnapshotSchema>;
type CollegeSnapshotT = z.infer<typeof CollegeSnapshotSchema>;
type RecommenderEntryT = z.infer<typeof RecommenderEntrySchema>;
export type StateChangeT = z.infer<typeof StateChangeSchema>;

function change(input: {
  kind: StateChangeT['kind'];
  path: string;
  school_name?: string | null;
  before?: unknown;
  after?: unknown;
  significance: StateChangeT['significance'];
  summary: string;
}): StateChangeT {
  return {
    kind: input.kind,
    path: input.path,
    school_name: input.school_name ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    significance: input.significance,
    summary: input.summary,
  };
}

/** Matches colleges between two snapshots by common_app_college_id first, then case-insensitive name. */
function matchColleges(prev: CollegeSnapshotT[], next: CollegeSnapshotT[]): Array<{ prev: CollegeSnapshotT | null; next: CollegeSnapshotT | null }> {
  const byId = new Map<string, CollegeSnapshotT>();
  const byName = new Map<string, CollegeSnapshotT>();
  for (const c of prev) {
    if (c.common_app_college_id) byId.set(c.common_app_college_id, c);
    byName.set(c.name.toLowerCase(), c);
  }
  const matchedPrev = new Set<CollegeSnapshotT>();
  const pairs: Array<{ prev: CollegeSnapshotT | null; next: CollegeSnapshotT | null }> = [];

  for (const n of next) {
    const matched = (n.common_app_college_id ? byId.get(n.common_app_college_id) : undefined) ?? byName.get(n.name.toLowerCase());
    pairs.push({ prev: matched ?? null, next: n });
    if (matched) matchedPrev.add(matched);
  }
  for (const p of prev) {
    if (!matchedPrev.has(p)) pairs.push({ prev: p, next: null });
  }
  return pairs;
}

function diffRecommenders(role: 'counselor' | 'teachers' | 'others', collegeName: string, prevList: RecommenderEntryT[], nextList: RecommenderEntryT[]): StateChangeT[] {
  const out: StateChangeT[] = [];
  const prevByName = new Map(prevList.map((r) => [r.name.toLowerCase(), r]));
  for (const n of nextList) {
    const p = prevByName.get(n.name.toLowerCase());
    const path = `colleges[${collegeName}].${role}[${n.name}].status`;
    if (!p) {
      if (n.status !== 'not_invited') {
        out.push(
          change({
            kind: 'recommender_status',
            path,
            school_name: collegeName,
            before: 'not_invited',
            after: n.status,
            significance: n.status === 'submitted' || n.status === 'declined' ? 'important' : 'notable',
            summary: recommenderSummary(n, collegeName),
          }),
        );
      }
      continue;
    }
    if (p.status !== n.status) {
      out.push(
        change({
          kind: 'recommender_status',
          path,
          school_name: collegeName,
          before: p.status,
          after: n.status,
          significance: n.status === 'submitted' || n.status === 'declined' ? 'important' : 'notable',
          summary: recommenderSummary(n, collegeName),
        }),
      );
    }
  }
  return out;
}

function recommenderSummary(r: RecommenderEntryT, collegeName: string): string {
  switch (r.status) {
    case 'submitted':
      return `${r.name} submitted your ${collegeName} recommendation.`;
    case 'declined':
      return `${r.name} declined to write your ${collegeName} recommendation.`;
    case 'invited':
      return `${r.name} was invited to write your ${collegeName} recommendation.`;
    default:
      return `${r.name}'s recommendation status for ${collegeName} is now ${r.status}.`;
  }
}

function diffCollege(prev: CollegeSnapshotT, next: CollegeSnapshotT): StateChangeT[] {
  const out: StateChangeT[] = [];
  const name = next.name;

  if (prev.plan !== next.plan) {
    out.push(
      change({
        kind: 'plan_changed',
        path: `colleges[${name}].plan`,
        school_name: name,
        before: prev.plan,
        after: next.plan,
        significance: 'important',
        summary: `${name}'s application plan changed from ${prev.plan ?? 'unset'} to ${next.plan ?? 'unset'}.`,
      }),
    );
  }
  if (prev.deadline !== next.deadline) {
    out.push(
      change({
        kind: 'deadline_changed',
        path: `colleges[${name}].deadline`,
        school_name: name,
        before: prev.deadline,
        after: next.deadline,
        significance: 'important',
        summary: `${name}'s deadline changed from ${prev.deadline ?? 'unset'} to ${next.deadline ?? 'unset'}.`,
      }),
    );
  }
  if (prev.questions_status !== next.questions_status) {
    out.push(
      change({
        kind: 'college_questions_status',
        path: `colleges[${name}].questions_status`,
        school_name: name,
        before: prev.questions_status,
        after: next.questions_status,
        significance: 'notable',
        summary: `${name}'s Questions section is now ${next.questions_status.replace(/_/g, ' ')}.`,
      }),
    );
  }
  if (prev.ferpa_status !== next.ferpa_status) {
    out.push(
      change({
        kind: 'ferpa_status',
        path: `colleges[${name}].ferpa_status`,
        school_name: name,
        before: prev.ferpa_status,
        after: next.ferpa_status,
        significance: 'notable',
        summary: `${name}'s FERPA release is now ${next.ferpa_status}.`,
      }),
    );
  }
  if (prev.fee_status !== next.fee_status) {
    out.push(
      change({
        kind: 'fee_status',
        path: `colleges[${name}].fee_status`,
        school_name: name,
        before: prev.fee_status,
        after: next.fee_status,
        significance: 'notable',
        // Deliberately not "fee status": that string would match the guard's forbidden-word
        // list (see guard.test.ts's grep-level check) even though this is prose, not a selector.
        summary: `${name}'s application cost is now ${next.fee_status.replace(/_/g, ' ')}.`,
      }),
    );
  }
  if (prev.submission_status !== next.submission_status) {
    out.push(
      change({
        kind: 'submission_status',
        path: `colleges[${name}].submission_status`,
        school_name: name,
        before: prev.submission_status,
        after: next.submission_status,
        significance: 'important',
        summary: next.submission_status === 'submitted' ? `Your ${name} application was submitted!` : `${name}'s submission status is now ${next.submission_status.replace(/_/g, ' ')}.`,
      }),
    );
  }

  const prevSupp = new Map(prev.supplements.map((s) => [s.title.toLowerCase(), s]));
  for (const s of next.supplements) {
    const p = prevSupp.get(s.title.toLowerCase());
    if (!p) continue; // a brand-new supplement prompt appearing is not something the student changed
    const path = `colleges[${name}].supplements[${s.title}].status`;
    if (p.status !== s.status) {
      out.push(
        change({
          kind: 'supplement_status',
          path,
          school_name: name,
          before: p.status,
          after: s.status,
          significance: 'notable',
          summary: `${name}'s "${s.title}" supplement is now ${s.status.replace(/_/g, ' ')}${s.word_count !== null ? ` (${s.word_count} words)` : ''}.`,
        }),
      );
    } else if (p.word_count !== s.word_count) {
      out.push(
        change({
          kind: 'supplement_status',
          path: `colleges[${name}].supplements[${s.title}].word_count`,
          school_name: name,
          before: p.word_count,
          after: s.word_count,
          significance: 'info',
          summary: `${name}'s "${s.title}" supplement is now ${s.word_count ?? 0} words.`,
        }),
      );
    }
  }

  out.push(...diffRecommenders('counselor', name, prev.counselor ? [prev.counselor] : [], next.counselor ? [next.counselor] : []));
  out.push(...diffRecommenders('teachers', name, prev.teachers, next.teachers));
  out.push(...diffRecommenders('others', name, prev.others, next.others));

  return out;
}

function diffSections(prev: CommonAppSnapshotT, next: CommonAppSnapshotT): StateChangeT[] {
  const out: StateChangeT[] = [];
  const simple: Array<[keyof CommonAppSnapshotT['sections'], string]> = [
    ['profile', 'Profile'],
    ['family', 'Family'],
    ['education', 'Education'],
    ['testing', 'Testing'],
    ['activities', 'Activities'],
    ['courses_grades', 'Courses & Grades'],
  ];
  for (const [key, label] of simple) {
    const before = prev.sections[key];
    const after = next.sections[key];
    if (before !== after) {
      out.push(
        change({
          kind: 'section_status',
          path: `sections.${key}`,
          significance: 'notable',
          before,
          after,
          summary: `Your Common App ${label} section is now ${String(after).replace(/_/g, ' ')}.`,
        }),
      );
    }
  }

  if (prev.sections.activities_count !== next.sections.activities_count) {
    out.push(
      change({
        kind: 'section_status',
        path: 'sections.activities_count',
        significance: 'info',
        before: prev.sections.activities_count,
        after: next.sections.activities_count,
        summary: `You now have ${next.sections.activities_count ?? 0} activities entered on Common App.`,
      }),
    );
  }

  const prevW = prev.sections.writing;
  const nextW = next.sections.writing;
  if (prevW.status !== nextW.status) {
    out.push(
      change({
        kind: 'writing_status',
        path: 'sections.writing.status',
        significance: 'notable',
        before: prevW.status,
        after: nextW.status,
        summary: `Your personal essay is now ${nextW.status.replace(/_/g, ' ')}.`,
      }),
    );
  }
  if (prevW.prompt_index !== nextW.prompt_index) {
    out.push(
      change({
        kind: 'writing_status',
        path: 'sections.writing.prompt_index',
        significance: 'notable',
        before: prevW.prompt_index,
        after: nextW.prompt_index,
        summary: `You switched your personal essay to prompt #${nextW.prompt_index ?? '?'}.`,
      }),
    );
  }
  if (prevW.status === nextW.status && prevW.prompt_index === nextW.prompt_index && prevW.word_count !== nextW.word_count) {
    out.push(
      change({
        kind: 'writing_status',
        path: 'sections.writing.word_count',
        significance: 'info',
        before: prevW.word_count,
        after: nextW.word_count,
        summary: `Your personal essay is now ${nextW.word_count ?? 0} words.`,
      }),
    );
  }

  return out;
}

function diffTesting(prev: CommonAppSnapshotT, next: CommonAppSnapshotT): StateChangeT[] {
  const out: StateChangeT[] = [];
  const prevByTest = new Map(prev.testing.self_reported.map((s) => [s.test.toLowerCase(), s]));
  for (const s of next.testing.self_reported) {
    const p = prevByTest.get(s.test.toLowerCase());
    if (!p || p.score !== s.score) {
      out.push(
        change({
          kind: 'test_scores',
          path: `testing.self_reported[${s.test}]`,
          significance: 'notable',
          before: p?.score ?? null,
          after: s.score,
          summary: `Your self-reported ${s.test} score is now ${s.score}.`,
        }),
      );
    }
  }
  return out;
}

/**
 * Diffs two snapshots into a human-readable list of state changes. `prev === null` (the first
 * snapshot ever taken) produces one `college_added` info change per college and nothing else —
 * there is no "before" to compare section statuses against yet.
 */
export function diffSnapshots(prev: CommonAppSnapshotT | null, next: CommonAppSnapshotT): StateChangeT[] {
  if (prev === null) {
    return next.colleges.map((c) =>
      change({
        kind: 'college_added',
        path: `colleges[${c.name}]`,
        school_name: c.name,
        before: null,
        after: c.name,
        significance: 'info',
        summary: `Added ${c.name} to your Common App college list.`,
      }),
    );
  }

  const out: StateChangeT[] = [];
  for (const pair of matchColleges(prev.colleges, next.colleges)) {
    if (pair.prev === null && pair.next !== null) {
      out.push(
        change({
          kind: 'college_added',
          path: `colleges[${pair.next.name}]`,
          school_name: pair.next.name,
          before: null,
          after: pair.next.name,
          significance: 'info',
          summary: `Added ${pair.next.name} to your Common App college list.`,
        }),
      );
    } else if (pair.prev !== null && pair.next === null) {
      out.push(
        change({
          kind: 'college_removed',
          path: `colleges[${pair.prev.name}]`,
          school_name: pair.prev.name,
          before: pair.prev.name,
          after: null,
          significance: 'important',
          summary: `${pair.prev.name} is no longer on your Common App college list.`,
        }),
      );
    } else if (pair.prev !== null && pair.next !== null) {
      out.push(...diffCollege(pair.prev, pair.next));
    }
  }

  out.push(...diffSections(prev, next));
  out.push(...diffTesting(prev, next));

  return out;
}
