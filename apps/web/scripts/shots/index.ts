import { SHOTS as activitySettings } from './activity-settings';
import { SHOTS as essays } from './essays';
import { SHOTS as onboarding } from './onboarding';
import { SHOTS as recsChat } from './recs-chat';
import { SHOTS as schools } from './schools';
import { SHOTS as system } from './system';
import { SHOTS as timeline } from './timeline';
import { SHOTS as today } from './today';

export type { Shot } from './types';
export { settle } from './types';

/** Every screen the screenshot runner captures, one file per page area so parallel work never collides. */
export const SHOTS = [...system, ...today, ...schools, ...timeline, ...essays, ...recsChat, ...activitySettings, ...onboarding];
