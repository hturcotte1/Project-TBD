/**
 * Types for the requirements engine: the school dataset shape and the pure inputs/outputs of the
 * checklist builder. Nothing here touches the database — `packages/shared/src/db/repos` maps
 * `ChecklistItemSpec` to `NewApplicationItem` rows.
 */
import type { z } from 'zod';
import type {
  ApplicationPlan,
  ApplicationStatus,
  EffortLevel,
  ItemKind,
  ItemSource,
  ItemStatus,
  TestOptionalStance,
} from '../domain/enums';
import type { CollegeSnapshot, CommonAppSections as CommonAppSectionsSchema, CommonAppSnapshot } from '../schemas/snapshot';
import type { IsoDate } from '../schemas/common';
import type { ItemEvidence } from '../schemas/items';
import type { SchoolRequirementsData } from '../schemas/requirements';

// `CommonAppSections` (unlike its siblings) has no companion `z.infer` type export from the
// schemas package, so it is derived here from the schema value.
type CommonAppSections = z.infer<typeof CommonAppSectionsSchema>;

/** One school for one admission cycle, as carried in the internal dataset. */
export interface SchoolDatasetEntry {
  slug: string;
  name: string;
  ceeb_code: string | null;
  common_app_member: boolean;
  portal_url: string | null;
  website: string;
  city: string;
  state: string;
  type: 'public' | 'private';
  /** Alternate names the reader (or a student's own typing) may use, e.g. ["UMich", "Michigan"]. */
  aliases: string[];
  requirements: SchoolRequirementsData;
}

/** The slice of an `applications` row the checklist builder needs. */
export interface ChecklistApplication {
  id: string;
  plan: ApplicationPlan;
  deadline: IsoDate;
  schoolSlug: string;
  schoolName: string;
  commonAppMember: boolean;
  status: ApplicationStatus;
}

/** The slice of student profile/testing state the checklist builder needs. */
export interface ChecklistStudent {
  testStance: TestOptionalStance;
  hasSatOrAct: boolean;
  financialConstraints: boolean | null;
  firstGeneration: boolean | null;
}

/** Everything `buildChecklist` needs to produce the items for one application. */
export interface ChecklistInput {
  application: ChecklistApplication;
  requirements: SchoolRequirementsData;
  snapshotCollege: CollegeSnapshot | null;
  sections: CommonAppSections | null;
  student: ChecklistStudent;
  today: IsoDate;
  capturedAt: string | null;
}

/** Everything `buildStudentWideChecklist` needs to produce the student-level items. */
export interface StudentWideChecklistInput {
  applications: ChecklistApplication[];
  sections: CommonAppSections | null;
  testing: CommonAppSnapshot['testing'] | null;
  student: ChecklistStudent;
  today: IsoDate;
  capturedAt: string | null;
  earliestCssDeadline: IsoDate | null;
  needsCss: boolean;
  earliestFafsaPriority: IsoDate | null;
}

/** A pure, deterministic description of one checklist row. Mapped to `NewApplicationItem` by callers. */
export interface ChecklistItemSpec {
  ruleKey: string;
  kind: ItemKind;
  title: string;
  description: string;
  source: ItemSource;
  status: ItemStatus;
  evidence: ItemEvidence | null;
  dueDate: IsoDate | null;
  /** 0-100. */
  importance: number;
  effort: EffortLevel;
  dependsOnOthers: boolean;
  blocking: boolean;
}
