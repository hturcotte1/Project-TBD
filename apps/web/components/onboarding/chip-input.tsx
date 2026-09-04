'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface ChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  id?: string;
}

/** Free-text chip picker (senior courses, intended majors, geography preferences...). Enter or comma commits a chip. */
export function ChipInput({ value, onChange, placeholder, max, id }: ChipInputProps) {
  const [draft, setDraft] = useState('');
  const atMax = max !== undefined && value.length >= max;

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || atMax) {
      setDraft('');
      return;
    }
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((chip) => (
            <Badge key={chip} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1.5">
              {chip}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== chip))}
                className="rounded-full p-0.5 hover:bg-background/60"
                aria-label={`Remove ${chip}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      {!atMax ? (
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Max {max} reached.</p>
      )}
    </div>
  );
}
