'use client';

import { X } from '@phosphor-icons/react';
import { useState } from 'react';
import { Input } from '@/components/system';

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}

/** Free-text tag picker (senior courses, intended majors, geography preferences). Enter or comma
 * commits a tag. A local rebuild of the onboarding area's ChipInput, which depends on a
 * pre-migration shim component being removed at the end of this migration. */
export function TagInput({ value, onChange, placeholder, max }: TagInputProps) {
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
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded bg-s2 py-1 pl-2 pr-1 text-12 text-fg">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} className="flex rounded p-0.5 text-fg-2 hover:text-fg" aria-label={`Remove ${tag}`}>
                <X />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {!atMax ? (
        <Input
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
        <p className="text-12 text-fg-2">Max {max} reached.</p>
      )}
    </div>
  );
}
