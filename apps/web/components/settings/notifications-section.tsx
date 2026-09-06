'use client';

import type { SettingsDto } from '@apogee/shared/api';
import type { NudgeIntensity } from '@apogee/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { validateQuietHours } from '@/components/settings/quiet-hours';
import { Button, Field, Input, Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Section, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { formatUsPhoneAsYouType, isValidE164, toE164 } from '@/lib/phone';

const NUDGE_OPTIONS: Array<{ value: NudgeIntensity; label: string; description: string }> = [
  { value: 'chill', label: 'Chill', description: 'Only the essentials, deadlines and anything urgent.' },
  { value: 'normal', label: 'Normal', description: 'Regular check-ins and reminders, most weeks.' },
  { value: 'intense', label: 'Intense', description: 'Daily nudges so nothing slips.' },
];

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

export function NotificationsSection({ settings }: { settings: SettingsDto }) {
  const [phoneDisplay, setPhoneDisplay] = useState(settings.phone_e164 ? formatUsPhoneAsYouType(settings.phone_e164) : '');
  const [timezone, setTimezone] = useState(settings.timezone);
  const [quietStart, setQuietStart] = useState(settings.quiet_hours.start);
  const [quietEnd, setQuietEnd] = useState(settings.quiet_hours.end);
  const [intensity, setIntensity] = useState<NudgeIntensity>(settings.nudge_intensity);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [quietHoursError, setQuietHoursError] = useState<string | null>(null);

  const timezones = listTimezones();
  const selectedNudge = NUDGE_OPTIONS.find((option) => option.value === intensity) ?? NUDGE_OPTIONS[1];

  const dirty =
    phoneDisplay !== (settings.phone_e164 ? formatUsPhoneAsYouType(settings.phone_e164) : '') ||
    timezone !== settings.timezone ||
    quietStart !== settings.quiet_hours.start ||
    quietEnd !== settings.quiet_hours.end ||
    intensity !== settings.nudge_intensity;

  const save = useMutation({
    mutationFn: async () => {
      const phoneE164 = toE164(phoneDisplay);
      if (!phoneE164 || !isValidE164(phoneE164)) throw new Error('invalid_phone');
      const quietHours = { start: quietStart, end: quietEnd };
      const quietHoursIssue = validateQuietHours(quietHours);
      if (quietHoursIssue) throw new Error('invalid_quiet_hours');
      return clientApi.call('settingsUpdate', { body: { phone_e164: phoneE164, timezone, quiet_hours: quietHours, nudge_intensity: intensity } });
    },
    onSuccess: (updated) => {
      setPhoneDisplay(updated.phone_e164 ? formatUsPhoneAsYouType(updated.phone_e164) : '');
      setTimezone(updated.timezone);
      setQuietStart(updated.quiet_hours.start);
      setQuietEnd(updated.quiet_hours.end);
      setIntensity(updated.nudge_intensity);
      toast('Saved.');
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'invalid_phone') {
        setPhoneError('Enter a valid phone number.');
        return;
      }
      if (error instanceof Error && error.message === 'invalid_quiet_hours') {
        setQuietHoursError(validateQuietHours({ start: quietStart, end: quietEnd }));
        return;
      }
      toast('Could not save. Try again.');
    },
  });

  return (
    <Section title="Notifications">
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPhoneError(null);
          setQuietHoursError(null);
          save.mutate();
        }}
      >
        <Field label="Phone" error={phoneError ?? undefined}>
          <Input type="tel" inputMode="tel" required value={phoneDisplay} onChange={(event) => setPhoneDisplay(formatUsPhoneAsYouType(event.target.value))} placeholder="(555) 555-0100" />
        </Field>

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

        <div className="flex flex-col gap-1">
          <span id="quiet-hours-label" className="text-14 font-medium text-fg">
            Quiet hours
          </span>
          <div className="flex items-center gap-2" role="group" aria-labelledby="quiet-hours-label">
            <Input type="time" aria-label="Quiet hours start" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="w-32" />
            <span className="text-14 text-fg-2">to</span>
            <Input type="time" aria-label="Quiet hours end" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="w-32" />
          </div>
          {quietHoursError ? (
            <p role="alert" className="text-12 text-err">
              {quietHoursError}
            </p>
          ) : (
            <p className="text-12 text-fg-2">Vector never texts during quiet hours, except the morning a deadline is due.</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span id="nudge-intensity-label" className="text-14 font-medium text-fg">
            How often Vector checks in
          </span>
          <Segmented
            aria-label="How often Vector checks in"
            value={intensity}
            onValueChange={(value) => setIntensity(value as NudgeIntensity)}
            options={NUDGE_OPTIONS.map(({ value, label }) => ({ value, label }))}
          />
          <p className="text-12 text-fg-2">{selectedNudge?.description}</p>
        </div>

        <div>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Section>
  );
}
