import type { OnboardingStateDto } from '@apogee/shared/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_STEPS, getOnboardingStep } from '@/components/onboarding/step-config';
import { getQuestions } from '@/components/onboarding/step-questions';

// Vitest doesn't expose a global `afterEach` unless `test.globals` is set (it isn't here), so
// @testing-library/react's built-in auto-cleanup never fires — do it explicitly between tests.
afterEach(cleanup);

let mockPathname = '/onboarding/1';
let mockSearch = '';
const mockRouter = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
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

/** Renders one step at a given `?q=` question index (defaults to the step's first question). The
 * URL — not any local mode state — is what the step reads (see `use-question-nav.ts`), so the
 * pathname mock is kept in sync with `step` on every render. */
function renderStep(step: number, question?: number) {
  const def = getOnboardingStep(step);
  if (!def) throw new Error(`no step definition for ${step}`);
  mockPathname = `/onboarding/${step}`;
  mockSearch = question ? `q=${question}` : '';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const StepComponent = def;
  return render(
    <QueryClientProvider client={client}>
      <StepComponent onboarding={fakeOnboarding(step)} step={step} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
});

describe('getOnboardingStep', () => {
  it('maps every step from 1 to 7 to a distinct component', () => {
    for (let step = 1; step <= 7; step += 1) {
      expect(getOnboardingStep(step)).not.toBeNull();
    }
    const components = new Set(Object.values(ONBOARDING_STEPS));
    expect(components.size).toBe(7);
  });

  it('returns null outside the 1-7 range', () => {
    expect(getOnboardingStep(0)).toBeNull();
    expect(getOnboardingStep(8)).toBeNull();
    expect(getOnboardingStep(-1)).toBeNull();
  });
});

// Steps 4 (interview), 6 (Common App connect) and 7 (first sync) fetch on mount and are covered by
// their own component tests instead — this suite is about the shared question-index routing, not
// re-testing every step's data fetching.
describe('a step renders the first question from its URL by default', () => {
  it.each([1, 2, 3, 5])('step %i shows its first question as an h1', (step) => {
    renderStep(step);
    const firstQuestion = getQuestions(step)[0];
    expect(firstQuestion).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: firstQuestion!.label })).toBeTruthy();
  });
});

describe('Back', () => {
  it('is hidden on the very first question of the whole flow', () => {
    renderStep(1);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('is shown on the first question of any later step, to step back into the previous one', () => {
    renderStep(2);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
});

describe('Continue advances the question index in the URL', () => {
  it("advances this step's own question param, leaving the step segment unchanged", () => {
    renderStep(1);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Dee' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/1?q=2');
  });

  it('does not advance when the current question is invalid', () => {
    renderStep(1);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your first and last name.')).toBeTruthy();
  });
});
