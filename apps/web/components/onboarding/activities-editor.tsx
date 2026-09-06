'use client';

import type { ActivityInput } from '@apogee/shared/schemas';
import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, GRADE_LEVELS } from '@apogee/shared/domain';
import { CaretDown, CaretUp, Plus, Trash } from '@phosphor-icons/react';
import { DESCRIPTION_MAX_LENGTH, MAX_ACTIVITIES, canAddActivity, descriptionRemaining } from '@/components/onboarding/activities-editor-utils';
import { Button, Checkbox, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/system';

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

/** Up to 10 activities as plain rows of Inputs, not a card per activity. */
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
    <div className="flex flex-col gap-6">
      {activities.length === 0 ? <p className="text-14 text-fg-2">No activities yet. Upload a resume above, or add one below.</p> : null}

      {activities.map((activity, index) => (
        <div key={index} className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between">
            <span className="text-12 text-fg-2">
              Activity {index + 1} of {MAX_ACTIVITIES}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="quiet" size="sm" iconOnly aria-label="Move activity up" disabled={index === 0} onClick={() => move(index, -1)}>
                <CaretUp />
              </Button>
              <Button variant="quiet" size="sm" iconOnly aria-label="Move activity down" disabled={index === activities.length - 1} onClick={() => move(index, 1)}>
                <CaretDown />
              </Button>
              <Button variant="danger" size="sm" iconOnly aria-label="Remove activity" onClick={() => onChange(activities.filter((_, i) => i !== index))}>
                <Trash />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
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
            </Field>
            <Field label="Position or leadership">
              <Input value={activity.position} maxLength={50} onChange={(event) => update(index, { position: event.target.value })} placeholder="Editor-in-Chief" />
            </Field>
          </div>

          <Field label="Organization">
            <Input value={activity.organization} maxLength={100} onChange={(event) => update(index, { organization: event.target.value })} placeholder="The Lincoln Log" />
          </Field>

          <Field label="Description" help={`${descriptionRemaining(activity.description)} characters left`}>
            <Textarea value={activity.description} maxLength={DESCRIPTION_MAX_LENGTH} rows={2} onChange={(event) => update(index, { description: event.target.value })} placeholder="What you did, Common App style." />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Grade levels</span>
              <div className="flex flex-wrap gap-3">
                {GRADE_LEVELS.map((grade) => (
                  <label key={grade} className="flex items-center gap-1.5 text-14 text-fg">
                    <Checkbox checked={activity.grade_levels.includes(grade)} onCheckedChange={() => update(index, { grade_levels: toggle(activity.grade_levels, grade) })} />
                    {grade}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Timing</span>
              <div className="flex flex-wrap gap-3">
                {ACTIVITY_TIMINGS.map((timing) => (
                  <label key={timing} className="flex items-center gap-1.5 text-14 text-fg">
                    <Checkbox checked={activity.timing.includes(timing)} onCheckedChange={() => update(index, { timing: toggle(activity.timing, timing) })} />
                    {TIMING_LABELS[timing]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
            <Field label="Hours/week">
              <Input type="number" min={0} max={168} value={activity.hours_per_week} onChange={(event) => update(index, { hours_per_week: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Weeks/year">
              <Input type="number" min={1} max={52} value={activity.weeks_per_year} onChange={(event) => update(index, { weeks_per_year: Number(event.target.value) || 1 })} />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-14 text-fg">
              <Checkbox checked={activity.continue_in_college} onCheckedChange={(checked) => update(index, { continue_in_college: checked === true })} />
              Continue in college
            </label>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <Button variant="text" size="sm" className="h-auto w-fit px-0" disabled={!canAddActivity(activities.length)} onClick={() => onChange([...activities, emptyActivity()])}>
          <Plus /> Add activity
        </Button>
        {!canAddActivity(activities.length) ? <p className="text-12 text-fg-2">Common App caps activities at {MAX_ACTIVITIES}.</p> : null}
      </div>
    </div>
  );
}
