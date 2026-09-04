import type { ApplicationPlan, ApplicationStatus, ItemStatus, NudgeIntensity, RecommenderAssignmentStatus, RecommenderRole } from '../domain/enums';
import type { PrioritizeItem } from '../prioritize';
import type { IsoDate } from '../schemas/common';
import type { QuietHours } from '../schemas/profile';

export interface TriggerStudent {
  id: string;
  timezone: string;
  quietHours: QuietHours;
  nudgeIntensity: NudgeIntensity;
  snoozedUntil: Date | null;
  onboardingCompletedAt: Date | null;
  /** Set when browser sync has failed repeatedly; while set, nothing here should sync. */
  syncPausedReason: string | null;
  lastSyncAt: Date | null;
}

export interface TriggerApplication {
  id: string;
  schoolName: string;
  plan: ApplicationPlan;
  deadline: IsoDate;
  status: ApplicationStatus;
}

export interface TriggerRecommenderAssignment {
  applicationId: string;
  status: RecommenderAssignmentStatus;
  invitedAt: IsoDate | null;
}

export interface TriggerRecommender {
  id: string;
  name: string;
  role: RecommenderRole;
  assignments: TriggerRecommenderAssignment[];
}

export interface TriggerEssay {
  id: string;
  /** Null for the Common App personal essay, which isn't scoped to one application. */
  applicationId: string | null;
  title: string;
  lastEditedAt: Date | null;
  wordCount: number;
  wordLimit: number | null;
  /** Status of the linked `application_items` row, if any. */
  itemStatus: ItemStatus | null;
}

/** Same shape the prioritizer scores; the proactive engine reads items, never mutates them. */
export type TriggerItem = PrioritizeItem;

export interface TriggerState {
  student: TriggerStudent;
  applications: TriggerApplication[];
  items: TriggerItem[];
  recommenders: TriggerRecommender[];
  essays: TriggerEssay[];
  /** trigger_key values already recorded in `nudges` for this student; makes every rule idempotent. */
  sentTriggerKeys: Set<string>;
}
