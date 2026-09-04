import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/api.server';
import { requireStudent } from '@/lib/auth';

/** Landing on bare /onboarding resumes wherever the student left off. */
export default async function OnboardingIndexPage() {
  await requireStudent();
  const api = serverApi();
  const state = await api.call('onboardingGet');
  redirect(state.completed ? '/' : `/onboarding/${state.step}`);
}
