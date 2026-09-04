import type { StateChange } from '@tbd/shared/schemas';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SIGNIFICANCE_VARIANT = { important: 'warn', notable: 'secondary', info: 'outline' } as const;

export function ChangesStrip({ changes }: { changes: StateChange[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Since yesterday</CardTitle>
      </CardHeader>
      {changes.length === 0 ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">Nothing changed on Common App since yesterday&rsquo;s sync.</CardContent>
      ) : (
        <CardContent className="flex gap-3 overflow-x-auto pb-1 pt-0">
          {changes.map((change, index) => (
            <div key={`${change.kind}-${change.path}-${index}`} className="flex min-w-56 shrink-0 flex-col gap-1 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-muted-foreground">{change.school_name ?? 'Common App'}</span>
                <Badge variant={SIGNIFICANCE_VARIANT[change.significance]} className="shrink-0">
                  {change.significance}
                </Badge>
              </div>
              <p className="text-sm">{change.summary}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
