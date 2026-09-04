import type { FastifyInstance } from 'fastify';
import type { ApiDeps } from '../deps';
import type { AuthVerifier } from '../auth/verifier';
import { registerContract, type Handlers } from './contract';
import { identityHandlers } from './identity';
import { onboardingHandlers } from './onboarding';
import { overviewHandlers } from './overview';
import { profileHandlers } from './profile';
import { documentHandlers } from './documents';
import { registerDocumentUpload } from './documentsUpload';
import { schoolHandlers } from './schools';
import { applicationHandlers } from './applications';
import { itemHandlers } from './items';
import { nextActionHandlers } from './nextActions';
import { timelineHandlers } from './timeline';
import { essayHandlers } from './essays';
import { recommenderHandlers } from './recommenders';
import { conversationHandlers } from './conversations';
import { approvalHandlers } from './approvals';
import { syncHandlers } from './sync';
import { activityHandlers } from './activity';
import { settingsHandlers } from './settings';
import { adminHandlers } from './admin';

const handlers: Handlers = {
  ...identityHandlers,
  ...onboardingHandlers,
  ...overviewHandlers,
  ...profileHandlers,
  ...documentHandlers,
  ...schoolHandlers,
  ...applicationHandlers,
  ...itemHandlers,
  ...nextActionHandlers,
  ...timelineHandlers,
  ...essayHandlers,
  ...recommenderHandlers,
  ...conversationHandlers,
  ...approvalHandlers,
  ...syncHandlers,
  ...activityHandlers,
  ...settingsHandlers,
  ...adminHandlers,
};

export function registerApiRoutes(app: FastifyInstance, deps: ApiDeps, verifier: AuthVerifier): void {
  registerContract(app, deps, verifier, handlers);
  registerDocumentUpload(app, deps, verifier);
}
