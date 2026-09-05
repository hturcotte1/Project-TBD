import { describe, expect, it } from 'vitest';
import { matchItem } from './util';

const items = [
  { id: '1', title: 'Why Georgetown', kind: 'supplement_essay' as const, schoolName: 'Georgetown University' },
  { id: '2', title: 'Interview', kind: 'interview' as const, schoolName: 'Georgetown University' },
  { id: '3', title: 'Request transcript', kind: 'transcript' as const, schoolName: 'Georgetown University' },
  { id: '4', title: 'Teacher recommendation 1', kind: 'teacher_rec' as const, schoolName: 'University of Michigan' },
  { id: '5', title: 'Teacher recommendation 2 (optional)', kind: 'teacher_rec' as const, schoolName: 'University of Michigan' },
  { id: '6', title: 'Why Michigan', kind: 'supplement_essay' as const, schoolName: 'University of Michigan' },
  { id: '7', title: 'FAFSA', kind: 'fafsa' as const, schoolName: null },
];

describe('matchItem', () => {
  it('needs an item descriptor, never just a school', () => {
    expect(matchItem('done with Georgetown', items)).toEqual({ kind: 'none' });
  });
  it('maps "supp" to the supplement essay at that school', () => {
    expect(matchItem('done with the Georgetown supp', items)).toMatchObject({ kind: 'match', item: { id: '1' } });
  });
  it('reports ambiguity between two equally good candidates', () => {
    const r = matchItem('finished my Michigan teacher rec', items);
    expect(r.kind).toBe('ambiguous');
  });
  it('picks by title words and by kind words', () => {
    expect(matchItem('the why michigan essay is done', items)).toMatchObject({ kind: 'match', item: { id: '6' } });
    expect(matchItem('submitted fafsa', items)).toMatchObject({ kind: 'match', item: { id: '7' } });
    expect(matchItem('sent my georgetown transcript', items)).toMatchObject({ kind: 'match', item: { id: '3' } });
  });
});
