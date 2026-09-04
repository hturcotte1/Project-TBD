'use client';

import type { ActivityInput } from '@tbd/shared/schemas';
import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, GRADE_LEVELS } from '@tbd/shared/domain';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { DESCRIPTION_MAX_LENGTH, MAX_ACTIVITIES, canAddActivity, descriptionRemaining } from '@/components/onboarding/activities-editor-utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const ACTIVITY_TYPE_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  academic: 'Academic',
  art: 'Art',
  athletics_club: 'Athletics (club)',
  athletics_jv_varsity: 'Athletics (JV/varsity)',
  career_oriented: 'Career-oriented',
  community_service: 'Community service',
  computer_technology: 'Computer/technology',
  cultural: 'Cultural',
  dance: 'Dance',
  debate_speech: 'Debate/speech',
  environmental: 'Environmental',
  family_responsibilities: 'Family responsibilities',
  foreign_exchange: 'Foreign exchange',
  foreign_language: 'Foreign language',
  internship: 'Internship',
  journalism_publication: 'Journalism/publication',
  junior_rotc: 'Junior ROTC',
  lgbtq: 'LGBTQ+',
  music_instrumental: 'Music: instrumental',
  music_vocal: 'Music: vocal',
  other_club: 'Other club',
  religious: 'Religious',
  research: 'Research',
  robotics: 'Robotics',
  school_spirit: 'School spirit',
  science_math: 'Science/math',
  social_justice: 'Social justice',
  student_government: 'Student government',
  theater_drama: 'Theater/drama',
  work_paid: 'Work (paid)',
  other: 'Other',
};

const TIMING_LABELS: Record<(typeof ACTIVITY_TIMINGS)[number], string> = {
  school_year: 'School year',
  school_break: 'School break',
  all_year: 'All year',
};

export function emptyActivity(): ActivityInput {
  return {
    activity_type: 'other',
    position: '',
    organization: '',
    description: '',
    grade_levels: [],
    timing: [],
    hours_per_week: 0,
    weeks_per_year: 1,
    continue_in_college: false,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ActivitiesEditor({ activities, onChange }: { activities: ActivityInput[]; onChange: (next: ActivityInput[]) => void }) {
  function update(index: number, patch: Partial<ActivityInput>) {
    onChange(activities.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    const a = activities[index];
    const b = activities[target];
    if (a === undefined || b === undefined) return;
    const next = [...activities];
    next[index] = b;
    next[target] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No activities yet. Upload a resume above, or add one manually.
        </p>
      ) : null}

      {activities.map((activity, index) => (
        <div key={index} className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Activity {index + 1} of {MAX_ACTIVITIES}
            </p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move activity up">
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === activities.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Move activity down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onChange(activities.filter((_, i) => i !== index))}
                aria-label="Remove activity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={activity.activity_type} onValueChange={(value) => update(index, { activity_type: value as ActivityInput['activity_type'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACTIVITY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Position/leadership</Label>
              <Input value={activity.position} maxLength={50} onChange={(event) => update(index, { position: event.target.value })} placeholder="e.g. Editor-in-Chief" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Input
              value={activity.organization}
              maxLength={100}
              onChange={(event) => update(index, { organization: event.target.value })}
              placeholder="e.g. The Lincoln Log"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={activity.description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={2}
              onChange={(event) => update(index, { description: event.target.value })}
              placeholder="What you did, Common App style — abbreviations are fine."
            />
            <p className={cn('text-right text-xs', descriptionRemaining(activity.description) < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {descriptionRemaining(activity.description)} characters left
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Grade levels</Label>
              <div className="flex flex-wrap gap-1.5">
                {GRADE_LEVELS.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => update(index, { grade_levels: toggle(activity.grade_levels, grade) })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      activity.grade_levels.includes(grade) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Timing</Label>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_TIMINGS.map((timing) => (
                  <button
                    key={timing}
                    type="button"
                    onClick={() => update(index, { timing: toggle(activity.timing, timing) })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      activity.timing.includes(timing) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    {TIMING_LABELS[timing]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Hours/week</Label>
              <Input
                type="number"
                min={0}
                max={168}
                value={activity.hours_per_week}
                onChange={(event) => update(index, { hours_per_week: Number(event.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weeks/year</Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={activity.weeks_per_year}
                onChange={(event) => update(index, { weeks_per_year: Number(event.target.value) || 1 })}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={activity.continue_in_college} onCheckedChange={(checked) => update(index, { continue_in_college: checked === true })} />
              Continue in college
            </label>
          </div>
        </div>
      ))}

      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" disabled={!canAddActivity(activities.length)} onClick={() => onChange([...activities, emptyActivity()])}>
          <Plus className="h-3.5 w-3.5" /> Add activity
        </Button>
        {!canAddActivity(activities.length) ? <p className="text-xs text-muted-foreground">Common App caps activities at {MAX_ACTIVITIES}.</p> : null}
      </div>
    </div>
  );
}

