'use client';

import type { SchoolWithRequirementsDto } from '@tbd/shared/api';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a school…" className="pl-8" />
      </div>
      {debounced.length > 0 ? (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {results.isFetching ? <p className="px-1 text-xs text-muted-foreground">Searching…</p> : null}
          {visible.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => onAdd(school)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">
                {school.name} <span className="text-xs text-muted-foreground">— {school.city}, {school.state}</span>
              </span>
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {results.data && visible.length === 0 && !results.isFetching ? (
            <div className="space-y-1.5 rounded-md border border-dashed border-border p-3 text-sm">
              <p className="text-muted-foreground">No match in our dataset.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => onAddFreeText(query.trim())}>
                Add &ldquo;{query.trim()}&rdquo; anyway
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
