'use client';

import type { ApplicationItemDto } from '@tbd/shared/api';
import type { ItemStatus } from '@tbd/shared/domain';
import { ITEM_STATUSES } from '@tbd/shared/domain';
import { daysUntil } from '@tbd/shared/time';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ItemNotesPopover } from '@/components/schools/item-notes-popover';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatDate, relativeTimeFromNow } from '@/lib/format';

const STATUS_LABELS: Record<ItemStatus, string> = {
  missing: 'Missing',
  in_progress: 'In progress',
  done: 'Done',
  not_applicable: 'N/A',
  blocked: 'Blocked',
};

const STATUS_VARIANT: Record<ItemStatus, 'outline' | 'secondary' | 'success' | 'urgent'> = {
  missing: 'outline',
  in_progress: 'secondary',
  done: 'success',
  not_applicable: 'outline',
  blocked: 'urgent',
};

const ESSAY_KINDS = new Set<ApplicationItemDto['kind']>(['personal_essay', 'supplement_essay']);
const REC_KINDS = new Set<ApplicationItemDto['kind']>(['teacher_rec', 'counselor_rec', 'other_rec']);

function importanceTier(importance: number): { label: string; className: string } {
  if (importance >= 80) return { label: 'High priority', className: 'text-urgent' };
  if (importance >= 50) return { label: 'Medium priority', className: 'text-warn' };
  return { label: 'Low priority', className: 'text-muted-foreground' };
}

function itemLinkHref(item: ApplicationItemDto): string | null {
  if (item.essay_id) return `/essays/${item.essay_id}`;
  if (item.recommender_id || REC_KINDS.has(item.kind)) return '/recommenders';
  return null;
}

export function ChecklistItemRow({ item, timezone, now = new Date() }: { item: ApplicationItemDto; timezone: string; now?: Date }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatus = useMutation({
    mutationFn: (status: ItemStatus) => clientApi.call('itemUpdate', { params: { id: item.id }, body: { status } }),
    onSuccess: () => {
      if (item.application_id) void queryClient.invalidateQueries({ queryKey: ['application', item.application_id] });
    },
    onError: () => toast({ title: 'Could not update that item', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  const deleteItem = useMutation({
    mutationFn: () => clientApi.call('itemDelete', { params: { id: item.id } }),
    onSuccess: () => {
      if (item.application_id) void queryClient.invalidateQueries({ queryKey: ['application', item.application_id] });
      toast({ title: 'Item removed' });
    },
    onError: () => toast({ title: 'Could not remove that item', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  const linkHref = itemLinkHref(item);
  const isLowConfidence = item.evidence !== null && item.evidence.confidence < 0.5;
  const importance = importanceTier(item.importance);
  const canDelete = item.source === 'student';

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {linkHref ? (
            <Link href={linkHref} className="text-sm font-medium hover:underline">
              {item.title}
            </Link>
          ) : (
            <p className="text-sm font-medium">{item.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            {item.due_date ? <DeadlineBadge daysRemaining={daysUntil(item.due_date, now, timezone)} label={formatDate(item.due_date, timezone)} /> : null}
            <span className={`text-xs font-medium ${importance.className}`}>{importance.label}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Select value={item.status} onValueChange={(value) => updateStatus.mutate(value as ItemStatus)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ItemNotesPopover itemId={item.id} notes={item.notes} applicationId={item.application_id} />
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => deleteItem.mutate()}
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {item.evidence ? (
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          {isLowConfidence ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warn" /> : null}
          <span>
            Last seen: {item.evidence.text} ({relativeTimeFromNow(item.evidence.seen_at, now)})
            {isLowConfidence ? <span className="text-warn"> · low confidence</span> : null}
          </span>
        </p>
      ) : null}

      {item.notes ? <p className="rounded-md bg-muted px-2 py-1.5 text-xs">{item.notes}</p> : null}

      {ESSAY_KINDS.has(item.kind) && item.essay_id === null ? <p className="text-xs text-muted-foreground">Not linked to an essay yet — it will connect automatically once Remy sees it on Common App.</p> : null}
    </div>
  );
}
