import type { IsoDate } from '../schemas/common';
import type { ApplicationPlan, ApplicationStatus, EffortLevel, ItemKind, ItemStatus, NudgeIntensity } from '../domain/enums';

/**
 * A flattened, student-scoped view of one `application_items` row plus the bits of context
 * the scorer needs. The worker builds this from `applicationItems` (+ joined essay/recommender
 * evidence text); this package never touches the database.
 */
export interface PrioritizeItem {
  id: string;
  applicationId: string | null;
  schoolName: string | null;
  ruleKey: string;
  kind: ItemKind;
  title: string;
  status: ItemStatus;
  dueDate: IsoDate | null;
  importance: number;
  effort: EffortLevel;
  /** True when someone other than the student must act (recommender, counselor, testing agency). */
  dependsOnOthers: boolean;
  blocking: boolean;
  notes: string;
  /** Short human-readable state, e.g. "143/550 words" or "invited Sep 2". Null when there is none. */
  evidenceText: string | null;
  /** Linked recommender / essay, so nudges about them can be acknowledged or snoozed through the item. */
  recommenderId?: string | null;
  essayId?: string | null;
}

/** A flattened `applications` row. */
export interface PrioritizeApplication {
  id: string;
  schoolName: string;
  plan: ApplicationPlan;
  deadline: IsoDate;
  status: ApplicationStatus;
}

export interface PrioritizeInput {
  /** The student's local calendar date ("today"), already resolved by the caller. */
  today: IsoDate;
  items: PrioritizeItem[];
  applications: PrioritizeApplication[];
  nudgeIntensity: NudgeIntensity;
}

/** One row of `next_actions`, ready to upsert. */
export interface NextActionSpec {
  applicationItemId: string;
  applicationId: string | null;
  action: string;
  reason: string;
  priorityScore: number;
  rank: number;
  dueDate: IsoDate | null;
  daysRemaining: number | null;
}
