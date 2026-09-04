'use client';

import type { NudgeIntensity } from '@tbd/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatUsPhoneAsYouType, isValidE164, toE164 } from '@/lib/phone';
import { cn } from '@/lib/utils';

const NUDGE_OPTIONS: Array<{ value: NudgeIntensity; label: string; description: string }> = [
  { value: 'chill', label: 'Chill', description: 'Only the essentials — deadlines and anything urgent.' },
  { value: 'normal', label: 'Normal', description: 'Regular check-ins and reminders, most weeks.' },
  { value: 'intense', label: 'Intense', description: "Daily nudges — don't let anything slip." },
];

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Chicago';
  }
}

export function StepBasics({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();
  const s = onboarding.student;

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
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
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
      toast({ title: 'Could not save — try again.', variant: 'destructive' });
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setPhoneError(null);
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">The basics</h1>
        <p className="text-sm text-muted-foreground">So Remy knows who it&rsquo;s texting, and when not to.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">First name</Label>
          <Input id="first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Last name</Label>
          <Input id="last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferred-name">Preferred name (optional)</Label>
        <Input id="preferred-name" value={preferredName} onChange={(event) => setPreferredName(event.target.value)} maxLength={80} placeholder={firstName} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          required
          value={phoneDisplay}
          onChange={(event) => setPhoneDisplay(formatUsPhoneAsYouType(event.target.value))}
          placeholder="(555) 555-0100"
        />
        {phoneError ? <p className="text-xs text-destructive">{phoneError}</p> : null}
        <WhyWeAsk>This is the number Remy texts. Nudges, reminders, and verification-code requests all come through this one thread.</WhyWeAsk>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="high-school">High school</Label>
          <Input id="high-school" required value={highSchool} onChange={(event) => setHighSchool(event.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grad-year">Graduation year</Label>
          <Select value={gradYear} onValueChange={setGradYear}>
            <SelectTrigger id="grad-year">
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
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        <p className="text-xs text-muted-foreground">Detected automatically from this device — edit it if you&rsquo;ll be somewhere else this fall.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quiet-start">Quiet hours</Label>
        <div className="flex items-center gap-2">
          <Input id="quiet-start" type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="w-32" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input aria-label="Quiet hours end" type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="w-32" />
        </div>
        <WhyWeAsk>Remy never texts during quiet hours — except the morning a deadline is actually due.</WhyWeAsk>
      </div>

      <div className="space-y-2">
        <Label>How often should Remy check in?</Label>
        <div className="grid gap-2">
          {NUDGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setIntensity(option.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                intensity === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <StepActions step={step} loading={save.isPending} />
    </form>
  );
}
