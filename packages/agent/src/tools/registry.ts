import type { z } from 'zod';
import { addApplicationTool } from './applications';
import { getEssayTool, saveEssayDraftTool } from './essay';
import { proposeFillFieldsTool, approveProposalTool, rejectProposalTool } from './fill';
import { addCustomItemTool, markItemDoneTool, snoozeItemTool } from './items';
import { sendDashboardLinkTool, setQuietHoursTool, snoozeNotificationsTool } from './notify';
import { updateRecommenderStatusTool } from './recommenders';
import { explainRequirementTool, getApplicationStatusTool, listNextActionsTool } from './status';
import { requestSyncTool } from './sync';
import type { AgentTool } from './types';
import { answerVerificationCodeTool } from './verification';

/** Every tool the agent's conversation loop can call. */
export const TOOLS: ReadonlyArray<AgentTool<z.ZodTypeAny>> = [
  getApplicationStatusTool,
  listNextActionsTool,
  explainRequirementTool,
  markItemDoneTool,
  snoozeItemTool,
  addCustomItemTool,
  getEssayTool,
  saveEssayDraftTool,
  requestSyncTool,
  proposeFillFieldsTool,
  approveProposalTool,
  rejectProposalTool,
  answerVerificationCodeTool,
  sendDashboardLinkTool,
  setQuietHoursTool,
  snoozeNotificationsTool,
  addApplicationTool,
  updateRecommenderStatusTool,
];

export function findTool(name: string): AgentTool<z.ZodTypeAny> | undefined {
  return TOOLS.find((t) => t.name === name);
}

export {
  getApplicationStatusTool,
  listNextActionsTool,
  explainRequirementTool,
  markItemDoneTool,
  snoozeItemTool,
  addCustomItemTool,
  getEssayTool,
  saveEssayDraftTool,
  requestSyncTool,
  proposeFillFieldsTool,
  approveProposalTool,
  rejectProposalTool,
  answerVerificationCodeTool,
  sendDashboardLinkTool,
  setQuietHoursTool,
  snoozeNotificationsTool,
  addApplicationTool,
  updateRecommenderStatusTool,
};
