import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, nullableText, text, type ExtractedResult } from './util';

const ROLE_VALUES = ['teacher', 'counselor', 'other'] as const;
const RECOMMENDER_STATUS_VALUES = ['not_invited', 'invited', 'submitted', 'declined', 'unknown'] as const;
const FERPA_VALUES = ['complete', 'incomplete', 'unknown'] as const;

export interface RecommenderRow {
  name: string;
  role: (typeof ROLE_VALUES)[number];
  subject: string | null;
  status: (typeof RECOMMENDER_STATUS_VALUES)[number];
  invitedAt: string | null;
  submittedAt: string | null;
}

export interface RecommendersSection {
  ferpaStatus: (typeof FERPA_VALUES)[number];
  counselor: RecommenderRow | null;
  teachers: RecommenderRow[];
  others: RecommenderRow[];
}

/** FERPA release status plus every invited counselor/teacher/other recommender. Read-only. */
export function extractRecommenders(html: string): ExtractedResult<RecommendersSection> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.college_recommenders.selectors;

  const ferpaStatus = asEnum(text($(sel.ferpaStatus)), FERPA_VALUES, 'unknown');

  const counselor: RecommenderRow[] = [];
  const teachers: RecommenderRow[] = [];
  const others: RecommenderRow[] = [];
  $(sel.recommenderRow).each((_i, el) => {
    const $row = $(el);
    const row: RecommenderRow = {
      name: text($row.find(sel.recommenderName)),
      role: asEnum(text($row.find(sel.recommenderRole)), ROLE_VALUES, 'other'),
      subject: nullableText(text($row.find(sel.recommenderSubject))),
      status: asEnum(text($row.find(sel.recommenderStatus)), RECOMMENDER_STATUS_VALUES, 'unknown'),
      invitedAt: nullableText(text($row.find(sel.recommenderInvitedAt))),
      submittedAt: nullableText(text($row.find(sel.recommenderSubmittedAt))),
    };
    if (row.role === 'counselor') counselor.push(row);
    else if (row.role === 'teacher') teachers.push(row);
    else others.push(row);
  });

  const rowCount = counselor.length + teachers.length + others.length;
  const anchors = [
    COMMONAPP_MAP.college_recommenders.waitFor,
    sel.ferpaStatus,
    ...(rowCount > 0 ? [sel.recommenderRow, sel.recommenderName, sel.recommenderRole, sel.recommenderStatus] : []),
  ];
  const confidence = anchorConfidence($, anchors);
  const raw = [counselor[0], ...teachers, ...others].filter(Boolean).map((r) => `${r?.name}:${r?.status}`).join('; ');
  return makeExtracted({ ferpaStatus, counselor: counselor[0] ?? null, teachers, others }, confidence, raw);
}
