'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Input, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

/** The single-line "Add an item for this school" field used on both the Schools list's row
 * expansion and the bottom of the school detail page — Enter creates a custom item. */
export function AddItemInput({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const create = useMutation({
    mutationFn: (value: string) => clientApi.call('itemCreate', { body: { application_id: applicationId, title: value, description: '', due_date: null } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      setTitle('');
      toast('Added.');
    },
    onError: () => toast('Could not add that item. Try again in a moment.'),
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    const value = title.trim();
    if (!value || create.isPending) return;
    create.mutate(value);
  }

  return (
    <Input
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Add an item for this school"
      disabled={create.isPending}
      maxLength={200}
    />
  );
}
