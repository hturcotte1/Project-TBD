import type { EssayDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { sortEssays } from '@/components/essays/sort';

function makeEssay(overrides: Partial<EssayDto> & Pick<EssayDto, 'id'>): EssayDto {
  return {
    application_id: null,
    application_item_id: null,
    school_name: null,
    title: 'Essay',
    prompt: '',
    word_limit: null,
    due_date: null,
    days_remaining: null,
    current_word_count: 0,
    draft_count: 0,
    last_edited_at: null,
    feedback_count: 0,
    status: null,
    ...overrides,
  };
}

describe('sortEssays', () => {
  it('orders by nearest due date first', () => {
    const far = makeEssay({ id: 'far', due_date: '2026-12-01' });
    const near = makeEssay({ id: 'near', due_date: '2026-10-01' });
    const middle = makeEssay({ id: 'middle', due_date: '2026-11-01' });
    expect(sortEssays([far, near, middle]).map((e) => e.id)).toEqual(['near', 'middle', 'far']);
  });

  it('sinks essays with no due date to the end', () => {
    const dated = makeEssay({ id: 'dated', due_date: '2026-11-01' });
    const undated = makeEssay({ id: 'undated', due_date: null });
    expect(sortEssays([undated, dated]).map((e) => e.id)).toEqual(['dated', 'undated']);
  });

  it('breaks ties (including two undated essays) by school name', () => {
    const zebra = makeEssay({ id: 'zebra', due_date: null, school_name: 'Zebra State' });
    const apple = makeEssay({ id: 'apple', due_date: null, school_name: 'Apple College' });
    const personal = makeEssay({ id: 'personal', due_date: null, school_name: null });
    expect(sortEssays([zebra, apple, personal]).map((e) => e.id)).toEqual(['personal', 'apple', 'zebra']);
  });

  it('does not mutate the input array', () => {
    const essays = [makeEssay({ id: 'b', due_date: '2026-12-01' }), makeEssay({ id: 'a', due_date: '2026-10-01' })];
    const original = [...essays];
    sortEssays(essays);
    expect(essays).toEqual(original);
  });
});
