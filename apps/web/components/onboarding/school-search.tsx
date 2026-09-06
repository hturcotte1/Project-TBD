'use client';

import type { SchoolWithRequirementsDto } from '@apogee/shared/api';
import { Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, SearchInput } from '@/components/system';
import { clientApi } from '@/lib/api.client';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface SchoolSearchProps {
  excludedSlugs: Set<string>;
  onAdd: (school: SchoolWithRequirementsDto) => void;
  onAddFreeText: (name: string) => void;
}

export function SchoolSearch({ excludedSlugs, onAdd, onAddFreeText }: SchoolSearchProps) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);

  const results = useQuery({
    queryKey: ['schools-search', debounced],
    queryFn: () => clientApi.call('schoolsSearch', { query: { q: debounced } }),
    enabled: debounced.length > 0,
  });

  const visible = (results.data ?? []).filter((school) => !excludedSlugs.has(school.slug));

  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="Search for a school" />
      {debounced.length > 0 ? (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {results.isFetching ? <p className="px-1 text-12 text-fg-2">Searching</p> : null}
          {visible.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => onAdd(school)}
              className="flex h-row-touch w-full items-center justify-between gap-2 rounded px-3 text-left text-14 hover:bg-s2 focus-inset lg:h-row"
            >
              <span className="truncate">
                {school.name}, <span className="text-fg-2">{school.city}, {school.state}</span>
              </span>
              <Plus className="shrink-0 text-fg-3" />
            </button>
          ))}
          {results.data && visible.length === 0 && !results.isFetching ? (
            <div className="flex flex-col gap-1.5 rounded border border-dashed border-line-strong p-3">
              <p className="text-14 text-fg-2">No match in our dataset.</p>
              <Button variant="text" size="sm" className="h-auto w-fit px-0" onClick={() => onAddFreeText(query.trim())}>
                Add &ldquo;{query.trim()}&rdquo; anyway
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
