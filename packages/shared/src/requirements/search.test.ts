import { describe, expect, it } from 'vitest';
import { findSchool, findSchools, planConflicts } from './search';

describe('findSchools / findSchool', () => {
  it('finds an exact alias match with high confidence ("michigan" -> umich)', () => {
    const match = findSchool('michigan');
    expect(match?.slug).toBe('umich');
  });

  it('finds an exact slug match', () => {
    expect(findSchool('umich')?.slug).toBe('umich');
    expect(findSchool('UMICH')?.slug).toBe('umich'); // case-insensitive
  });

  it('finds a prefix match', () => {
    expect(findSchool('northw')?.slug).toBe('northwestern');
  });

  it('a shared prefix across two schools ("north") still resolves deterministically', () => {
    const results = findSchools('north', 5);
    expect(results.map((r) => r.slug)).toContain('northwestern');
    expect(results.map((r) => r.slug)).toContain('northeastern');
  });

  it('returns null for a bare, ambiguous token like "state"', () => {
    expect(findSchool('state')).toBeNull();
  });

  it('returns null for a query matching nothing at all', () => {
    expect(findSchool('zzz-not-a-school-zzz')).toBeNull();
    expect(findSchools('zzz-not-a-school-zzz')).toEqual([]);
  });

  it('returns null for an empty or whitespace-only query', () => {
    expect(findSchool('')).toBeNull();
    expect(findSchool('   ')).toBeNull();
  });

  it('ranks exact and prefix matches above plain token overlap', () => {
    const results = findSchools('georgetown', 5);
    expect(results[0]?.slug).toBe('georgetown');
  });

  it('respects the limit parameter', () => {
    const results = findSchools('university', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('finds Georgetown by its own name even though it is not a Common App member', () => {
    expect(findSchool('Georgetown')?.slug).toBe('georgetown');
  });
});

describe('planConflicts', () => {
  it('returns no warnings for a normal mixed list', () => {
    const warnings = planConflicts([
      { schoolName: 'University of Michigan', plan: 'EA' },
      { schoolName: 'Emory University', plan: 'RD' },
      { schoolName: 'Loyola University Chicago', plan: 'rolling' },
    ]);
    expect(warnings).toEqual([]);
  });

  it('flags more than one binding Early Decision commitment', () => {
    const warnings = planConflicts([
      { schoolName: 'Duke University', plan: 'ED' },
      { schoolName: 'Northwestern University', plan: 'ED' },
    ]);
    expect(warnings.some((w) => w.includes('Duke University') && w.includes('Northwestern University'))).toBe(true);
  });

  it('treats ED and ED2 as both binding for the "more than one" check', () => {
    const warnings = planConflicts([
      { schoolName: 'Duke University', plan: 'ED' },
      { schoolName: 'Tufts University', plan: 'ED2' },
    ]);
    expect(warnings.some((w) => w.toLowerCase().includes('binding'))).toBe(true);
  });

  it('flags REA alongside an ED or EA application elsewhere', () => {
    const warnings = planConflicts([
      { schoolName: 'Yale University', plan: 'REA' },
      { schoolName: 'University of Michigan', plan: 'EA' },
    ]);
    expect(warnings.some((w) => w.includes('Yale University') && w.includes('University of Michigan'))).toBe(true);
  });

  it('flags more than one REA commitment', () => {
    const warnings = planConflicts([
      { schoolName: 'Yale University', plan: 'REA' },
      { schoolName: 'Stanford University', plan: 'REA' },
    ]);
    expect(warnings.some((w) => w.toLowerCase().includes('restrictive early action'))).toBe(true);
  });

  it('does not flag a single REA alongside only RD/rolling applications', () => {
    const warnings = planConflicts([
      { schoolName: 'Yale University', plan: 'REA' },
      { schoolName: 'Emory University', plan: 'RD' },
    ]);
    expect(warnings).toEqual([]);
  });

  it('returns no warnings for an empty list', () => {
    expect(planConflicts([])).toEqual([]);
  });
});
