import type { ApplicationPlan, SelfAssessment } from '@tbd/shared/domain';

export const PLAN_LABELS: Record<ApplicationPlan, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision II',
  EA: 'Early Action',
  REA: 'Restrictive Early Action',
  RD: 'Regular Decision',
  rolling: 'Rolling',
};

export const SELF_ASSESSMENT_LABELS: Record<SelfAssessment, string> = {
  reach: 'Reach',
  target: 'Target',
  safety: 'Safety',
};
