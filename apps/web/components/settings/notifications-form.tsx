'use client';

import type { SettingsDto } from '@apogee/shared/api';
import type { NudgeIntensity } from '@apogee/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { validateQuietHours } from '@/components/settings/quiet-hours';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function NotificationsForm({ settings }: { settings: SettingsDto }) {
  const { toast } = useToast();
  const [phoneDisplay, setPhoneDisplay] = useState(settings.phone_e164 ? formatUsPhoneAsYouType(settings.phone_e164) : '');
  const [timezone, setTimezone] = useState(settings.timezone);
  const [quietStart, setQuietStart] = useState(settings.quiet_hours.start);
  const [quietEnd, setQuietEnd] = useState(settings.quiet_hours.end);
  const [intensity, setIntensity] = useState<NudgeIntensity>(settings.nudge_intensity);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [quietHoursError, setQuietHoursError] = useState<string | null>(null);

  const timezones = listTimezones();

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
      toast({ title: 'Settings saved' });
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
      toast({ title: 'Could not save — try again.', variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPhoneError(null);
            setQuietHoursError(null);
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="settings-phone">Phone number</Label>
            <Input
              id="settings-phone"
              type="tel"
              inputMode="tel"
              required
              value={phoneDisplay}
              onChange={(event) => setPhoneDisplay(formatUsPhoneAsYouType(event.target.value))}
              placeholder="(555) 555-0100"
            />
            {phoneError ? <p className="text-xs text-destructive">{phoneError}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="settings-timezone">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-quiet-start">Quiet hours</Label>
            <div className="flex items-center gap-2">
              <Input id="settings-quiet-start" type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input aria-label="Quiet hours end" type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="w-32" />
            </div>
            {quietHoursError ? <p className="text-xs text-destructive">{quietHoursError}</p> : null}
            <p className="text-xs text-muted-foreground">Vector never texts during quiet hours — except the morning a deadline is actually due.</p>
          </div>

          <div className="space-y-2">
            <Label>How often should Vector check in?</Label>
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

          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save notifications
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
