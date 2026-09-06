'use client';

import { Gear, ShieldCheck, UserCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { buildPrimaryNav } from '@/components/shell/nav-items';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, DaysFigure, toast } from '@/components/system';
import { tidyNextActionText } from '@/components/today/next-action-text';
import { PLAN_LABELS } from '@/components/today/plan-labels';
import { clientApi } from '@/lib/api.client';
import { applyTheme } from '@/lib/theme';
import { RECOMMENDER_ROLE_LABELS } from './recommender-role-labels';

const STALE_MS = 60_000;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  agentName: string;
}

/** ⌘K / Ctrl-K anywhere, the rail's search row, and the mobile Search tab all open this. Searches
 * schools, essays, recommenders and next actions, plus the app's own pages and a few actions. */
export function CommandPalette({ open, onOpenChange, isAdmin, agentName }: CommandPaletteProps) {
  const router = useRouter();

  const applicationsQuery = useQuery({ queryKey: ['applications'], queryFn: () => clientApi.call('applicationsList'), enabled: open, staleTime: STALE_MS });
  const essaysQuery = useQuery({ queryKey: ['essays'], queryFn: () => clientApi.call('essaysList'), enabled: open, staleTime: STALE_MS });
  const recommendersQuery = useQuery({ queryKey: ['recommenders'], queryFn: () => clientApi.call('recommendersList'), enabled: open, staleTime: STALE_MS });
  const nextActionsQuery = useQuery({
    queryKey: ['next-actions'],
    queryFn: () => clientApi.call('nextActionsList', { query: { include_closed: false } }),
    enabled: open,
    staleTime: STALE_MS,
  });

  const syncNow = useMutation({
    mutationFn: () => clientApi.call('syncRun'),
    onSuccess: () => toast('Sync started.'),
  });

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const navItems = buildPrimaryNav(agentName);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search schools, essays, people, or type an action" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          {navItems.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <span className="flex items-center gap-2">
                <item.icon size={16} />
                {`Go to ${item.label}`}
              </span>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go('/profile')}>
            <span className="flex items-center gap-2">
              <UserCircle size={16} />
              Go to Profile
            </span>
          </CommandItem>
          <CommandItem onSelect={() => go('/settings')}>
            <span className="flex items-center gap-2">
              <Gear size={16} />
              Go to Settings
            </span>
          </CommandItem>
          {isAdmin ? (
            <CommandItem onSelect={() => go('/admin')}>
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} />
                Go to Admin
              </span>
            </CommandItem>
          ) : null}
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              syncNow.mutate();
            }}
          >
            Sync now
          </CommandItem>
          <CommandItem onSelect={() => go('/schools?add=1')}>Add a school</CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              window.open('/api/proxy/timeline.ics', '_blank');
            }}
          >
            Export timeline (.ics)
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              applyTheme('dark');
            }}
          >
            Use dark theme
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              applyTheme('light');
            }}
          >
            Use light theme
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              applyTheme('system');
            }}
          >
            Follow system theme
          </CommandItem>
        </CommandGroup>

        {applicationsQuery.data && applicationsQuery.data.length > 0 ? (
          <CommandGroup heading="Schools">
            {applicationsQuery.data.map((application) => (
              <CommandItem key={application.id} onSelect={() => go(`/schools/${application.id}`)}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="truncate">{`${application.school.name}, ${PLAN_LABELS[application.plan]}`}</span>
                  <DaysFigure days={application.days_remaining} format="number" />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {essaysQuery.data && essaysQuery.data.length > 0 ? (
          <CommandGroup heading="Essays">
            {essaysQuery.data.map((essay) => (
              <CommandItem key={essay.id} onSelect={() => go(`/essays/${essay.id}`)}>
                <span className="flex flex-col">
                  <span className="truncate">{essay.title}</span>
                  {essay.school_name ? <span className="text-12 text-fg-2">{essay.school_name}</span> : null}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {recommendersQuery.data && recommendersQuery.data.length > 0 ? (
          <CommandGroup heading="Recommenders">
            {recommendersQuery.data.map((recommender) => (
              <CommandItem key={recommender.id} onSelect={() => go('/recommenders')}>
                <span className="flex flex-col">
                  <span className="truncate">{recommender.name}</span>
                  <span className="text-12 text-fg-2">{RECOMMENDER_ROLE_LABELS[recommender.role]}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {nextActionsQuery.data && nextActionsQuery.data.length > 0 ? (
          <CommandGroup heading="Next actions">
            {nextActionsQuery.data.map((action) => (
              <CommandItem
                key={action.id}
                shortcut="Enter"
                onSelect={() => {
                  onOpenChange(false);
                  if (action.application_id) router.push(`/schools/${action.application_id}`);
                }}
              >
                {tidyNextActionText(action.action)}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
