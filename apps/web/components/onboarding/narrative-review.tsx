'use client';

import type { StudentNarrative } from '@apogee/shared/schemas';
import { Trash } from '@phosphor-icons/react';
import { Button, Field, Input, Textarea } from '@/components/system';

const TEXT_FIELDS: Array<{ key: 'summary' | 'cares_about' | 'wants_to_do' | 'free_saturday' | 'proud_of_not_on_resume' | 'home_vs_school' | 'family_context' | 'anxieties'; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'cares_about', label: 'What you care about' },
  { key: 'wants_to_do', label: 'What you want to do next' },
  { key: 'free_saturday', label: 'A free Saturday' },
  { key: 'proud_of_not_on_resume', label: "Something you're proud of that isn't on a resume" },
  { key: 'home_vs_school', label: 'Home life vs. school life' },
  { key: 'family_context', label: 'Family context' },
  { key: 'anxieties', label: 'What worries you about applying' },
];

/** Editable summary of the interview transcript, reviewed before it becomes the profile's
 * narrative. Also used unchanged from `/profile/interview` — props stay exactly
 * `{ narrative, onChange }`. */
export function NarrativeReview({ narrative, onChange }: { narrative: StudentNarrative; onChange: (next: StudentNarrative) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {TEXT_FIELDS.map(({ key, label }) => (
        <Field key={key} label={label}>
          <Textarea rows={key === 'summary' ? 4 : 2} value={narrative[key]} onChange={(event) => onChange({ ...narrative, [key]: event.target.value })} />
        </Field>
      ))}

      {narrative.themes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-14 font-medium text-fg">Themes</span>
          {narrative.themes.map((theme, index) => (
            <div key={index} className="flex items-start gap-2 rounded border border-line p-2.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Input value={theme.title} onChange={(event) => onChange({ ...narrative, themes: narrative.themes.map((t, i) => (i === index ? { ...t, title: event.target.value } : t)) })} />
                <Textarea
                  rows={2}
                  value={theme.description}
                  onChange={(event) => onChange({ ...narrative, themes: narrative.themes.map((t, i) => (i === index ? { ...t, description: event.target.value } : t)) })}
                />
              </div>
              <Button variant="quiet" size="sm" iconOnly aria-label="Remove theme" onClick={() => onChange({ ...narrative, themes: narrative.themes.filter((_, i) => i !== index) })}>
                <Trash />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {narrative.stories.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-14 font-medium text-fg">Stories</span>
          {narrative.stories.map((story, index) => (
            <div key={index} className="flex items-start gap-2 rounded border border-line p-2.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Input value={story.title} onChange={(event) => onChange({ ...narrative, stories: narrative.stories.map((st, i) => (i === index ? { ...st, title: event.target.value } : st)) })} />
                <Textarea
                  rows={3}
                  value={story.summary}
                  onChange={(event) => onChange({ ...narrative, stories: narrative.stories.map((st, i) => (i === index ? { ...st, summary: event.target.value } : st)) })}
                />
              </div>
              <Button variant="quiet" size="sm" iconOnly aria-label="Remove story" onClick={() => onChange({ ...narrative, stories: narrative.stories.filter((_, i) => i !== index) })}>
                <Trash />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {narrative.values.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-14 font-medium text-fg">Values</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {narrative.values.map((value, index) => (
              <div key={index} className="flex flex-col gap-1.5 rounded border border-line p-2.5">
                <Input value={value.name} onChange={(event) => onChange({ ...narrative, values: narrative.values.map((v, i) => (i === index ? { ...v, name: event.target.value } : v)) })} />
                <Textarea rows={2} value={value.why} onChange={(event) => onChange({ ...narrative, values: narrative.values.map((v, i) => (i === index ? { ...v, why: event.target.value } : v)) })} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
