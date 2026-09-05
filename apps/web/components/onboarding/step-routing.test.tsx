import type { OnboardingStateDto } from '@apogee/shared/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ONBOARDING_STEPS, getOnboardingStep } from '@/components/onboarding/step-config';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function fakeOnboarding(step: number): OnboardingStateDto {
  return {
    step,
    completed: false,
    student: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'demo@example.com',
      role: 'student',
      status: 'active',
      first_name: 'Dee',
      last_name: 'Demo',
      preferred_name: 'Dee',
      phone_e164: null,
      high_school: 'Lincoln High School',
      graduation_year: 2027,
      timezone: 'America/Chicago',
      quiet_hours: { start: '22:00', end: '07:00' },
      nudge_intensity: 'normal',
      onboarding_step: step,
      onboarding_completed_at: null,
      sync_paused_reason: null,
      snoozed_until: null,
      created_at: '2026-09-01T00:00:00.000Z',
    },
    profile: null,
    activities: [],
    narrative: null,
    applications: [],
    credentials: { provider: 'common_app', connected: false, status: null, username: null, verified_at: null, last_used_at: null, failure_count: 0 },
    agent_phone_number: '+15555550100',
    agent_name: 'Vector',
    privacy_url: '/privacy',
  };
}

function renderStep(step: number) {
  const def = getOnboardingStep(step);
  if (!def) throw new Error(`no step definition for ${step}`);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const StepComponent = def.component;
  return render(
    <QueryClientProvider client={client}>
      <StepComponent onboarding={fakeOnboarding(step)} step={step} />
    </QueryClientProvider>,
  );
}

describe('getOnboardingStep', () => {
  it('maps every step from 1 to 7 to a distinct component', () => {
    for (let step = 1; step <= 7; step += 1) {
      expect(getOnboardingStep(step)).not.toBeNull();
    }
    const titles = new Set(Object.values(ONBOARDING_STEPS).map((s) => s.title));
    expect(titles.size).toBe(7);
  });

  it('returns null outside the 1-7 range', () => {
    expect(getOnboardingStep(0)).toBeNull();
    expect(getOnboardingStep(8)).toBeNull();
    expect(getOnboardingStep(-1)).toBeNull();
  });
});

describe('onboarding step page renders the component matching its step number', () => {
  it('step 1 renders the basics form', () => {
    renderStep(1);
    expect(screen.getByText('The basics')).toBeTruthy();
  });

  it('step 2 renders the academics form', () => {
    renderStep(2);
    expect(screen.getByText('Academics')).toBeTruthy();
  });

  it('step 3 renders the activities editor', () => {
    renderStep(3);
    expect(screen.getByText('Activities')).toBeTruthy();
  });

  it('step 5 renders goals & schools', () => {
    renderStep(5);
    expect(screen.getByText('Goals & schools')).toBeTruthy();
  });
});
