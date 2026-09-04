'use client';

import { TIMELINE_KINDS, TIMELINE_KIND_DOT_CLASS, TIMELINE_KIND_LABELS, type TimelineKind } from '@/components/timeline/kind-meta';
import { cn } from '@/lib/utils';

export function KindFilterChips({ active, onToggle }: { active: Set<TimelineKind>; onToggle: (kind: TimelineKind) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIMELINE_KINDS.map((kind) => {
        const isActive = active.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', TIMELINE_KIND_DOT_CLASS[kind])} />
            {TIMELINE_KIND_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}
