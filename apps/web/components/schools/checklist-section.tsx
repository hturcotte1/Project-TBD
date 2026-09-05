import type { ApplicationItemDto } from '@apogee/shared/api';
import { ChecklistItemRow } from '@/components/schools/checklist-item-row';

export function ChecklistSection({ title, items, timezone }: { title: string; items: ApplicationItemDto[]; timezone: string }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({items.length})</span>
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}
