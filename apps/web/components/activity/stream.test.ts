import type { AuditEntryDto, SnapshotSummaryDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import {
  dayDividerLabel,
  dayKey,
  filterStream,
  groupByDay,
  isStreamFilter,
  matchesStreamFilter,
  rowTimeLabel,
  toStreamItems,
  type StreamItem,
} from '@/components/activity/stream';

const TZ = 'America/Chicago';

function entry(overrides: Partial<AuditEntryDto> & { id: string }): AuditEntryDto {
  return {
    actor: 'system',
    action: 'sync.completed',
    entity_type: null,
    entity_id: null,
    details: {},
    replay_url: null,
    created_at: '2026-09-04T12:00:00.000Z',
    ...overrides,
  };
}

function snapshot(overrides: Partial<SnapshotSummaryDto> & { id: string }): SnapshotSummaryDto {
  return {
    created_at: '2026-09-04T12:00:00.000Z',
    overall_confidence: 0.9,
    low_confidence_sections: [],
    changes: [],
    ...overrides,
  };
}

describe('isStreamFilter', () => {
  it('accepts every known filter value', () => {
    expect(isStreamFilter('all')).toBe(true);
    expect(isStreamFilter('syncs')).toBe(true);
    expect(isStreamFilter('vector')).toBe(true);
    expect(isStreamFilter('changes')).toBe(true);
    expect(isStreamFilter('you')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isStreamFilter('bogus')).toBe(false);
    expect(isStreamFilter('')).toBe(false);
  });
});

describe('toStreamItems', () => {
  it('merges entries and per-change rows, newest first', () => {
    const older = entry({ id: 'older', created_at: '2026-09-01T00:00:00.000Z' });
    const newer = entry({ id: 'newer', created_at: '2026-09-03T00:00:00.000Z' });
    const snap = snapshot({
      id: 'snap-1',
      created_at: '2026-09-02T00:00:00.000Z',
      changes: [
        { kind: 'section_status', path: 'a', school_name: 'Michigan', before: null, after: null, significance: 'notable', summary: 'Michigan added an interview.' },
        { kind: 'section_status', path: 'b', school_name: null, before: null, after: null, significance: 'info', summary: 'A minor update.' },
      ],
    });

    const items = toStreamItems([older, newer], [snap]);
    expect(items.map((i) => i.id)).toEqual(['newer', 'snap-1:0', 'snap-1:1', 'older']);
    expect(items[1]).toMatchObject({ kind: 'change', schoolName: 'Michigan', summary: 'Michigan added an interview.' });
  });

  it('returns an empty list when there is nothing to show', () => {
    expect(toStreamItems([], [])).toEqual([]);
  });
});

describe('matchesStreamFilter / filterStream', () => {
  it('classifies sync-prefixed actions as syncs regardless of actor', () => {
    const items: StreamItem[] = [
      { kind: 'entry', id: '1', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'sync.started', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '2', created_at: '2026-09-01T00:00:00.000Z', actor: 'agent', action: 'credentials.connected', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '3', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'verification_code.requested', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '4', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'drift.detected', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '5', created_at: '2026-09-01T00:00:00.000Z', actor: 'student', action: 'approval.approved', entity_type: null, entity_id: null, details: {}, replay_url: null },
    ];
    expect(filterStream(items, 'syncs').map((i) => i.id)).toEqual(['1', '2', '3', '4']);
  });

  it('classifies the agent actor and specific action names as vector', () => {
    const items: StreamItem[] = [
      { kind: 'entry', id: '1', created_at: '2026-09-01T00:00:00.000Z', actor: 'agent', action: 'anything.at.all', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '2', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'message.sent', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '3', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'fill.completed', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '4', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'recommender.reminder_drafted', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '5', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'essay.feedback_requested', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '6', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'narrative.summarized', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '7', created_at: '2026-09-01T00:00:00.000Z', actor: 'student', action: 'approval.approved', entity_type: null, entity_id: null, details: {}, replay_url: null },
    ];
    expect(filterStream(items, 'vector').map((i) => i.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('classifies student-actor entries as you', () => {
    const items: StreamItem[] = [
      { kind: 'entry', id: '1', created_at: '2026-09-01T00:00:00.000Z', actor: 'student', action: 'approval.approved', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'entry', id: '2', created_at: '2026-09-01T00:00:00.000Z', actor: 'agent', action: 'approval.created', entity_type: null, entity_id: null, details: {}, replay_url: null },
    ];
    expect(filterStream(items, 'you').map((i) => i.id)).toEqual(['1']);
  });

  it('classifies sync.completed entries that carry changes (either key spelling) as changes, and every change row', () => {
    const items: StreamItem[] = [
      { kind: 'entry', id: '1', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'sync.completed', entity_type: null, entity_id: null, details: { changesCount: 2 }, replay_url: null },
      { kind: 'entry', id: '2', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'sync.completed', entity_type: null, entity_id: null, details: { changes_count: 1 }, replay_url: null },
      { kind: 'entry', id: '3', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'sync.completed', entity_type: null, entity_id: null, details: { changesCount: 0 }, replay_url: null },
      { kind: 'entry', id: '4', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'sync.started', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'change', id: 'c1', created_at: '2026-09-01T00:00:00.000Z', schoolName: null, summary: 'x' },
    ];
    expect(filterStream(items, 'changes').map((i) => i.id)).toEqual(['1', '2', 'c1']);
  });

  it('all matches everything', () => {
    const items: StreamItem[] = [
      { kind: 'entry', id: '1', created_at: '2026-09-01T00:00:00.000Z', actor: 'system', action: 'anything', entity_type: null, entity_id: null, details: {}, replay_url: null },
      { kind: 'change', id: 'c1', created_at: '2026-09-01T00:00:00.000Z', schoolName: null, summary: 'x' },
    ];
    expect(items.every((i) => matchesStreamFilter(i, 'all'))).toBe(true);
  });
});

describe('dayKey / dayDividerLabel', () => {
  it('resolves the calendar day in the given timezone, not UTC', () => {
    // 2026-09-05T02:00:00Z is still Sep 4 evening in America/Chicago (UTC-5 in September).
    expect(dayKey('2026-09-05T02:00:00.000Z', TZ)).toBe('2026-09-04');
    expect(dayDividerLabel('2026-09-05T02:00:00.000Z', TZ)).toBe('Friday, September 4');
  });
});

describe('rowTimeLabel', () => {
  const now = new Date('2026-09-05T18:00:00.000Z'); // 1:00 PM America/Chicago

  it('shows a clock time for a row from today', () => {
    expect(rowTimeLabel('2026-09-05T20:45:00.000Z', TZ, now)).toBe('3:45 PM');
  });

  it('shows a short date for a row from an earlier day', () => {
    expect(rowTimeLabel('2026-09-03T20:45:00.000Z', TZ, now)).toBe('Sep 3');
  });
});

describe('groupByDay', () => {
  it('starts a new group only when the day actually changes', () => {
    const items = [
      { id: 'a', created_at: '2026-09-05T20:00:00.000Z' },
      { id: 'b', created_at: '2026-09-05T14:00:00.000Z' },
      { id: 'c', created_at: '2026-09-04T14:00:00.000Z' },
    ];
    const groups = groupByDay(items, (i) => i.created_at, TZ);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[0]?.label).toBe('Saturday, September 5');
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['c']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupByDay([], (i: { created_at: string }) => i.created_at, TZ)).toEqual([]);
  });
});
