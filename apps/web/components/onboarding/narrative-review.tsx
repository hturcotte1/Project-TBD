'use client';

import type { StudentNarrative } from '@tbd/shared/schemas';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

export function NarrativeReview({ narrative, onChange }: { narrative: StudentNarrative; onChange: (next: StudentNarrative) => void }) {
  return (
    <div className="space-y-5">
      {TEXT_FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`narrative-${key}`}>{label}</Label>
          <Textarea
            id={`narrative-${key}`}
            rows={key === 'summary' ? 4 : 2}
            value={narrative[key]}
            onChange={(event) => onChange({ ...narrative, [key]: event.target.value })}
          />
        </div>
      ))}

      {narrative.themes.length > 0 ? (
        <div className="space-y-2">
          <Label>Themes</Label>
          {narrative.themes.map((theme, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border border-border p-2.5">
              <div className="flex-1 space-y-1.5">
                <Input
                  value={theme.title}
                  onChange={(event) => onChange({ ...narrative, themes: narrative.themes.map((t, i) => (i === index ? { ...t, title: event.target.value } : t)) })}
                />
                <Textarea
                  rows={2}
                  value={theme.description}
                  onChange={(event) =>
                    onChange({ ...narrative, themes: narrative.themes.map((t, i) => (i === index ? { ...t, description: event.target.value } : t)) })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange({ ...narrative, themes: narrative.themes.filter((_, i) => i !== index) })}
                aria-label="Remove theme"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {narrative.stories.length > 0 ? (
        <div className="space-y-2">
          <Label>Stories</Label>
          {narrative.stories.map((story, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border border-border p-2.5">
              <div className="flex-1 space-y-1.5">
                <Input
                  value={story.title}
                  onChange={(event) => onChange({ ...narrative, stories: narrative.stories.map((st, i) => (i === index ? { ...st, title: event.target.value } : st)) })}
                />
                <Textarea
                  rows={3}
                  value={story.summary}
                  onChange={(event) =>
                    onChange({ ...narrative, stories: narrative.stories.map((st, i) => (i === index ? { ...st, summary: event.target.value } : st)) })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange({ ...narrative, stories: narrative.stories.filter((_, i) => i !== index) })}
                aria-label="Remove story"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {narrative.values.length > 0 ? (
        <div className="space-y-2">
          <Label>Values</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {narrative.values.map((value, index) => (
              <div key={index} className="space-y-1.5 rounded-md border border-border p-2.5">
                <Input
                  value={value.name}
                  onChange={(event) => onChange({ ...narrative, values: narrative.values.map((v, i) => (i === index ? { ...v, name: event.target.value } : v)) })}
                />
                <Textarea
                  rows={2}
                  value={value.why}
                  onChange={(event) => onChange({ ...narrative, values: narrative.values.map((v, i) => (i === index ? { ...v, why: event.target.value } : v)) })}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
