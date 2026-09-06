import type { RecommenderRole } from '@apogee/shared/domain';

export const RECOMMENDER_ROLE_LABELS: Record<RecommenderRole, string> = {
  teacher: 'Teacher',
  counselor: 'Counselor',
  other: 'Other',
};
