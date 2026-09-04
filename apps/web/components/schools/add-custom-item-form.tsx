'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function AddCustomItemForm({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      clientApi.call('itemCreate', {
        body: { application_id: applicationId, title: title.trim(), description: description.trim(), due_date: dueDate || null },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      toast({ title: 'Item added' });
      setTitle('');
      setDescription('');
      setDueDate('');
      setOpen(false);
    },
    onError: () => toast({ title: 'Could not add that item', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add custom item
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) create.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="custom-item-title">Title</Label>
        <Input id="custom-item-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Mail thank-you card to Ms. Park" maxLength={200} required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-item-description">Notes (optional)</Label>
        <Textarea id="custom-item-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-item-due">Due date (optional)</Label>
        <Input id="custom-item-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setTitle('');
            setDescription('');
            setDueDate('');
          }}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={create.isPending} disabled={!title.trim()}>
          Add item
        </Button>
      </div>
    </form>
  );
}
