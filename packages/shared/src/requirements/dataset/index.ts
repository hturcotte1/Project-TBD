import { FLAGSHIPS } from './flagships';
import { IVY_PLUS } from './ivy-plus';
import { LACS } from './lacs';
import { ROLLING_SAFETIES } from './rolling-safeties';
import { TOP_PRIVATES } from './top-privates';
import type { SchoolDatasetEntry } from '../types';

export { FLAGSHIPS } from './flagships';
export { IVY_PLUS } from './ivy-plus';
export { LACS } from './lacs';
export { ROLLING_SAFETIES } from './rolling-safeties';
export { TOP_PRIVATES } from './top-privates';

/** Every school in the internal dataset for the 2026-27 cycle. */
export const SCHOOL_DATASET: SchoolDatasetEntry[] = [
  ...IVY_PLUS,
  ...TOP_PRIVATES,
  ...FLAGSHIPS,
  ...LACS,
  ...ROLLING_SAFETIES,
];

/** Fast lookup by slug. */
export const SCHOOL_BY_SLUG: ReadonlyMap<string, SchoolDatasetEntry> = new Map(
  SCHOOL_DATASET.map((entry) => [entry.slug, entry]),
);
