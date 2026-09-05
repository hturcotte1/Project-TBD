// commonapp-map
export { AUTHENTICATED_MARKER_SELECTOR, COMMONAPP_MAP, FORBIDDEN_ACTION_PATTERNS, LOGIN_ERROR_MARKERS, MAINTENANCE_MARKERS, PER_COLLEGE_PAGES, resolveCollegePath, VERIFICATION_MARKERS } from './commonapp-map';
export type { CommonAppPageDef, PageName } from './commonapp-map';

// guard
export { assertSafeAction, SafePage, SubmitGuardError } from './guard';

// extractors + snapshot
export {
  detectPageState,
  extractActivities,
  extractCollegeQuestions,
  extractCommonAppSections,
  extractDashboard,
  extractMyColleges,
  extractRecommenders,
  extractReviewSubmit,
  extractSnapshot,
  extractTesting,
  extractWriting,
  extractWritingSupplement,
} from './extract/index';
export type {
  ActivityRow,
  CapturedPages,
  CaTabName,
  CollegeQuestionsSection,
  CommonAppSectionsValue,
  CommonAppSnapshotValue,
  DashboardSummary,
  ExtractedResult,
  ExtractSnapshotResult,
  MyCollegeRow,
  PageState,
  RecommenderRow,
  RecommendersSection,
  ReviewSubmitSection,
  SelfReportedScoreRow,
  SupplementRow,
  TestingSection,
  WritingSection,
} from './extract/index';

// diff
export { diffSnapshots } from './diff';
export type { StateChangeT } from './diff';

// sessions
export { BrowserbaseSessionProvider, createBrowserSessionProvider, LocalChromiumSessionProvider } from './session/index';
export type { BrowserbaseSessionProviderOptions, BrowserSessionHandle, BrowserSessionProvider, LocalChromiumSessionProviderOptions } from './session/index';

// fallback
export { createFallbackExtractor, StagehandExtractor, STAGEHAND_FALLBACK_CONFIDENCE } from './fallback/stagehand';
export type { PageExtractorFallback } from './fallback/stagehand';

// client
export { createCommonAppClient, fingerprintValue, redactLongVerification } from './client';
export type { CaptureHooks, CaptureResult, CommonAppClient, CreateCommonAppClientOptions, FillResult, LoginHooks, LoginResult } from './client';

// mock
export { defaultMockState, startMockCommonApp } from './mock/index';
export type { MockAccountState, MockCommonAppHandle, StartMockCommonAppOptions } from './mock/index';
