'use client';

import type { NudgeIntensity } from '@apogee/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Field, Input, Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { formatUsPhoneAsYouType, isValidE164, toE164 } from '@/lib/phone';

const NUDGE_OPTIONS: Array<{ value: NudgeIntensity; label: string; description: string }> = [
  { value: 'chill', label: 'Chill', description: 'Only the essentials: deadlines and anything urgent.' },
  { value: 'normal', label: 'Normal', description: 'Regular check-ins and reminders, most weeks.' },
  { value: 'intense', label: 'Intense', description: 'Daily nudges, nothing slips.' },
];

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

/** Used only if the runtime doesn't support `Intl.supportedValuesOf` (older engines). */
const CURATED_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

function listTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch {
    // fall through to the curated list
  }
  return CURATED_TIMEZONES;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Chicago';
  }
}

/** Step 1: name, phone, school, timezone, quiet hours, nudge intensity — one question per screen. */
export function StepBasics({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const s = onboarding.student;
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);

  const [firstName, setFirstName] = useState(s.first_name);
  const [lastName, setLastName] = useState(s.last_name);
  const [preferredName, setPreferredName] = useState(s.preferred_name);
  const [phoneDisplay, setPhoneDisplay] = useState(s.phone_e164 ? formatUsPhoneAsYouType(s.phone_e164) : '');
  const [highSchool, setHighSchool] = useState(s.high_school);
  const [gradYear, setGradYear] = useState(String(s.graduation_year ?? CURRENT_YEAR + 1));
  const [timezone, setTimezone] = useState(s.timezone || detectTimezone());
  const [quietStart, setQuietStart] = useState(s.quiet_hours.start || '22:00');
  const [quietEnd, setQuietEnd] = useState(s.quiet_hours.end || '07:00');
  const [intensity, setIntensity] = useState<NudgeIntensity>(s.nudge_intensity);

  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  const timezones = listTimezones();
  const selectedNudge = NUDGE_OPTIONS.find((option) => option.value === intensity) ?? NUDGE_OPTIONS[1];

  const save = useMutation({
    mutationFn: () => {
      const phoneE164 = toE164(phoneDisplay);
      if (!phoneE164 || !isValidE164(phoneE164)) throw new Error('invalid_phone');
      return clientApi.call('onboardingStep', {
        body: {
          step: 1,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            preferred_name: preferredName.trim(),
            phone_e164: phoneE164,
            high_school: highSchool.trim(),
            graduation_year: Number(gradYear),
            timezone,
            quiet_hours: { start: quietStart, end: quietEnd },
            nudge_intensity: intensity,
          },
        },
      });
    },
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: (error) => {
      if (error instanceof Error && error.message === 'invalid_phone') {
        setPhoneError('Enter a valid phone number.');
        return;
      }
      toast('Could not save. Try again.');
    },
  });

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nav.question < total) nav.goNext();
    else save.mutate();
  }

  if (questionId === 'name') {
    return (
      <QuestionLayout
        question="What's your name?"
        onSubmit={(event) => {
          event.preventDefault();
          if (!firstName.trim() || !lastName.trim()) {
            setNameError('Enter your first and last name.');
            return;
          }
          setNameError(null);
          nav.goNext();
        }}
        onBack={nav.goBack}
        backHidden={nav.isFirstOverall}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={nameError ?? undefined}>
            <Input required value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Last name">
            <Input required value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} />
          </Field>
        </div>
        <Field label="Preferred name (optional)">
          <Input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} maxLength={80} placeholder={firstName} />
        </Field>
      </QuestionLayout>
    );
  }

  if (questionId === 'phone') {
    return (
      <QuestionLayout
        question="What number should Vector text?"
        whyWeAsk={<WhyWeAsk>This is the number Vector texts. Nudges, reminders and verification-code requests all come through this one thread.</WhyWeAsk>}
        onSubmit={(event) => {
          event.preventDefault();
          const e164 = toE164(phoneDisplay);
          if (!e164 || !isValidE164(e164)) {
            setPhoneError('Enter a valid phone number.');
            return;
          }
          setPhoneError(null);
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <Field label="Phone number" error={phoneError ?? undefined}>
          <Input
            type="tel"
            inputMode="tel"
            required
            value={phoneDisplay}
            onChange={(event) => setPhoneDisplay(formatUsPhoneAsYouType(event.target.value))}
            placeholder="(555) 555-0100"
          />
        </Field>
      </QuestionLayout>
    );
  }

  if (questionId === 'school') {
    return (
      <QuestionLayout
        question="Where do you go to school?"
        onSubmit={(event) => {
          event.preventDefault();
          if (!highSchool.trim()) {
            setSchoolError('Enter your high school.');
            return;
          }
          setSchoolError(null);
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <Field label="High school" error={schoolError ?? undefined}>
          <Input required value={highSchool} onChange={(event) => setHighSchool(event.target.value)} maxLength={200} />
        </Field>
        <Field label="Graduation year">
          <Select value={gradYear} onValueChange={setGradYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRAD_YEARS.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </QuestionLayout>
    );
  }

  if (questionId === 'timezone') {
    return (
      <QuestionLayout question="What time zone are you in?" context="Detected automatically. Change it if you'll be somewhere else this fall." onSubmit={advance} onBack={nav.goBack}>
        <Field label="Time zone">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {(timezones.includes(timezone) ? timezones : [timezone, ...timezones]).map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </QuestionLayout>
    );
  }

  if (questionId === 'quiet-hours') {
    return (
      <QuestionLayout
        question="When should Vector stay quiet?"
        whyWeAsk={<WhyWeAsk>Vector never texts during quiet hours, except the morning a deadline is actually due.</WhyWeAsk>}
        onSubmit={advance}
        onBack={nav.goBack}
      >
        <div className="flex items-center gap-2">
          <Input type="time" aria-label="Quiet hours start" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="w-32" />
          <span className="text-14 text-fg-2">to</span>
          <Input type="time" aria-label="Quiet hours end" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="w-32" />
        </div>
      </QuestionLayout>
    );
  }

  // 'nudge-intensity' — the last question of this step.
  return (
    <QuestionLayout question="How often should Vector nudge you?" onSubmit={advance} onBack={nav.goBack} continueLoading={save.isPending}>
      <Segmented
        aria-label="How often should Vector nudge you?"
        value={intensity}
        onValueChange={(value) => setIntensity(value as NudgeIntensity)}
        options={NUDGE_OPTIONS.map(({ value, label }) => ({ value, label }))}
      />
      <p className="text-14 text-fg-2">{selectedNudge?.description}</p>
    </QuestionLayout>
  );
}
