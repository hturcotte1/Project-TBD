/**
 * Single import surface for the shared domain engines used by the agent tools and runtimes:
 * the requirements engine (`@tbd/shared/requirements`) and the proactive templates
 * (`@tbd/shared/proactive`). Keeping the imports here means a change in those packages' public
 * API touches one file in this package.
 */
import { buildChecklist, findSchool, resolveDeadline, SCHOOL_DATASET, type SchoolDatasetEntry } from '@tbd/shared/requirements';
import { factsMentioned, templateForTrigger } from '@tbd/shared/proactive';

export type { SchoolDatasetEntry };
export { buildChecklist, findSchool, resolveDeadline, factsMentioned, templateForTrigger };

/** Plain-object view of the dataset (the real export is a `ReadonlyMap`), for callers that want to scan every entry. */
export const SCHOOL_BY_SLUG: Record<string, SchoolDatasetEntry> = Object.fromEntries(SCHOOL_DATASET.map((entry) => [entry.slug, entry]));
