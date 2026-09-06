import type { Page } from 'playwright';
import type { Shot } from './types';

interface EssaySummary {
  id: string;
  feedback_count: number;
  title: string;
}

/** The essay to open for the detail shots: whichever already has the most feedback rounds, or the
 * personal essay as a fallback (its current draft naturally trips one of the fake LLM's generic-
 * phrase detectors, so requesting feedback on it produces an anchored note worth screenshotting). */
async function pickEssayId(page: Page): Promise<string> {
  const origin = new URL(page.url()).origin;
  const response = await page.request.get(`${origin}/api/proxy/essays`);
  const essays = (await response.json()) as EssaySummary[];
  if (essays.length === 0) throw new Error('essay shots need at least one seeded essay');
  const mostFeedback = [...essays].sort((a, b) => b.feedback_count - a.feedback_count)[0]!;
  if (mostFeedback.feedback_count > 0) return mostFeedback.id;
  const personal = essays.find((essay) => essay.title === 'Personal essay');
  return (personal ?? mostFeedback).id;
}

/** Best-effort: if the target essay has no feedback yet, ask for a round (the dev stack runs the
 * deterministic fake LLM, so this resolves in a couple seconds) so the anchored-notes UI has
 * something real to show. Never throws — a shot with no feedback is still a valid state to capture. */
async function ensureFeedback(page: Page): Promise<void> {
  const askButton = page.getByRole('button', { name: 'Ask Vector for feedback' });
  if (!(await askButton.isVisible().catch(() => false))) return;
  const alreadyHasFeedback = await page
    .getByText('Answers the prompt:')
    .first()
    .isVisible()
    .catch(() => false);
  if (alreadyHasFeedback) return;
  await askButton.click();
  await page.waitForSelector('text=Answers the prompt:', { timeout: 20_000 }).catch(() => undefined);
}

/** Screens owned by the essays page task. */
export const SHOTS: Shot[] = [
  {
    name: 'essays',
    path: '/essays',
    prepare: async (page) => {
      await page.waitForSelector('tbody tr');
    },
  },
  {
    name: 'essay',
    path: '/essays',
    prepare: async (page) => {
      const id = await pickEssayId(page);
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/essays/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('textarea');
      await ensureFeedback(page);
    },
  },
  {
    name: 'essay-feedback-sheet',
    path: '/essays',
    prepare: async (page) => {
      const id = await pickEssayId(page);
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/essays/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('textarea');
      await ensureFeedback(page);
      const feedbackButton = page.getByRole('button', { name: /^Feedback \(/ });
      if (await feedbackButton.isVisible().catch(() => false)) {
        await feedbackButton.click();
        await page.waitForSelector('text=Feedback', { timeout: 5000 }).catch(() => undefined);
      }
    },
  },
];
