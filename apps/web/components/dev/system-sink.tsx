'use client';

import { DotsThree, Info, MagnifyingGlass } from '@phosphor-icons/react';
import { Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CompletionBar,
  Countdown,
  DaysFigure,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
  Empty,
  ErrorNote,
  Field,
  Input,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  OkNote,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProgressTop,
  SearchInput,
  Section,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableExpansion,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextLink,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from '@/components/system';
import { HEAT_LABELS, HEAT_TEXT_CLASSES, type HeatStep } from '@/lib/urgency';
import { type ThemeSetting, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** One row of the kitchen sink: a component name, a sentence on when to use it, then the thing
 * itself. Keeps every entry below to the same shape instead of re-deriving it each time. */
function Demo({ title, when, children }: { title: string; when: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <p className="text-14 text-fg-2">{when}</p>
      {children}
    </Section>
  );
}

interface QueueRow {
  action: string;
  school: string;
  progress?: string;
  days: number;
  /** Demonstrates TableRow's `selected` state. */
  selected?: boolean;
  /** Demonstrates TableRow's `expanded` state plus a TableExpansion of evidence beneath it. */
  expandable?: boolean;
}

const QUEUE_ROWS: QueueRow[] = [
  { action: 'Ask Ms. Park to submit your Michigan rec', school: 'Michigan', days: 2 },
  { action: 'Finish the Why Michigan supplement', school: 'Michigan', progress: '180/300', days: 12, selected: true },
  { action: 'Send your Georgia Tech transcript request', school: 'Georgia Tech', days: 14, expandable: true },
  { action: 'Confirm your SAT score report for Purdue', school: 'Purdue', days: 15 },
  { action: 'Draft the Purdue honors essay', school: 'Purdue', days: 15 },
];

const DAYS_FIGURE_SAMPLES = [45, 20, 12, 6, 2, 0, -3];

const TYPE_SPECIMEN: { token: string; className: string; sample: string; face?: 'ui' | 'count' }[] = [
  { token: 'text-12', className: 'text-12', sample: 'Common App, submitted Sep 3' },
  { token: 'text-14', className: 'text-14', sample: 'Ask Ms. Park to submit your Michigan rec' },
  { token: 'text-17', className: 'text-17', sample: 'days until Michigan, Early Action.' },
  { token: 'text-22', className: 'text-22', sample: 'Today' },
  { token: 'text-28', className: 'text-28', sample: 'Schools' },
  { token: 'text-34', className: 'text-34', sample: 'Michigan' },
  { token: 'text-43', className: 'text-43', sample: '12', face: 'count' },
  { token: 'text-54', className: 'text-54', sample: '57', face: 'count' },
  { token: 'text-67', className: 'text-67', sample: '57', face: 'count' },
  { token: 'text-84', className: 'text-84', sample: '57', face: 'count' },
];

const SURFACE_SWATCHES: { name: string; bg: string; carriesTertiary: boolean }[] = [
  { name: 'Page', bg: 'bg-page', carriesTertiary: true },
  { name: 'Surface 1', bg: 'bg-s1', carriesTertiary: true },
  { name: 'Surface 2', bg: 'bg-s2', carriesTertiary: true },
  { name: 'Surface 3', bg: 'bg-s3', carriesTertiary: false },
];

const HEAT_STEPS: HeatStep[] = [0, 1, 2, 3, 4, 5];

export function SystemSink() {
  const [theme, setTheme] = useTheme();
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRow, setExpandedRow] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Lets a screenshot or a manual visit force a theme via /dev/system?theme=dark, on top of the
  // Segmented control below (both end up calling the same applyTheme).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    if (requested === 'dark' || requested === 'light' || requested === 'system') {
      setTheme(requested);
    }
  }, [setTheme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const sortedQueue = [...QUEUE_ROWS].sort((a, b) => (sortDir === 'asc' ? a.days - b.days : b.days - a.days));

  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <div>
          <h1 className="text-28 font-semibold">Component system</h1>
          <p className="text-14 text-fg-2">Every piece of apps/web/components/system, in every state, with real Apogee content.</p>
        </div>
        <Segmented
          aria-label="Theme"
          value={theme}
          onValueChange={(value) => setTheme(value as ThemeSetting)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>

      <Stack>
        <Demo title="Button" when="The one verb someone can click to do a thing — text by default, filled once per screen for the thing the page most wants done.">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Approve all</Button>
              <Button variant="text">Review</Button>
              <Button variant="quiet">Skip</Button>
              <Button variant="danger">Remove from queue</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg">
                Sync now
              </Button>
              <Button variant="primary" size="md">
                Sync now
              </Button>
              <Button variant="primary" size="sm">
                Sync now
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" loading>
                Sending
              </Button>
              <Button variant="primary" disabled>
                Sync now
              </Button>
              <Button variant="text" iconOnly aria-label="Row actions">
                <DotsThree />
              </Button>
            </div>
          </div>
        </Demo>

        <Demo title="Link" when="An inline link inside a sentence — brand-colored, underlines on hover and focus.">
          <p className="text-14 text-fg">
            Common App marked your Purdue transcript as received. See the <TextLink href="/timeline">full timeline</TextLink> for every update since
            yesterday.
          </p>
        </Demo>

        <Demo title="Input, Textarea, Search" when="Text entry, form fields, and mobile search — same skin, three shapes.">
          <div className="grid max-w-md gap-3">
            <Input placeholder="Recommender's email" />
            <Input defaultValue="ms.park@annarbor.k12.mi.us" />
            <Input defaultValue="not-an-email" invalid />
            <Input leading={<MagnifyingGlass />} placeholder="Search schools" />
            <SearchInputDemo />
            <Textarea defaultValue="Ms. Park hasn't submitted yet. Want me to draft a nudge?" />
          </div>
        </Demo>

        <Demo title="Select" when="Choosing one of a short, known list — a school, a status, a term.">
          <Select defaultValue="michigan">
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="michigan">Michigan</SelectItem>
              <SelectItem value="georgia-tech">Georgia Tech</SelectItem>
              <SelectItem value="purdue">Purdue</SelectItem>
            </SelectContent>
          </Select>
        </Demo>

        <Demo title="Checkbox, Switch" when="A single yes/no: an item on a checklist, a setting that's on or off.">
          <div className="flex flex-wrap items-center gap-8">
            <label className="flex items-center gap-2 text-14 text-fg">
              <Checkbox defaultChecked id="checklist-transcript" />
              Send an official transcript
            </label>
            <label className="flex items-center gap-2 text-14 text-fg">
              <Checkbox id="checklist-interview" />
              Schedule the optional interview
            </label>
            <label className="flex items-center gap-2 text-14 text-fg">
              <Switch defaultChecked id="setting-email" />
              Email me when Vector drafts something
            </label>
            <label className="flex items-center gap-2 text-14 text-fg">
              <Switch id="setting-sms" />
              Text me for urgent deadlines
            </label>
          </div>
        </Demo>

        <Demo title="Field" when="Labels a control and wires it to its help or error text, with one generated id.">
          <div className="grid max-w-md gap-4">
            <Field label="Recommender's email" help="We'll email Ms. Park an invitation right away.">
              <Input placeholder="ms.park@annarbor.k12.mi.us" />
            </Field>
            <Field label="Verification code" error="That code expired. Ask Ms. Park to resend it.">
              <Input invalid className="font-mono" defaultValue="8K2P91" />
            </Field>
          </div>
        </Demo>

        <Demo title="Segmented" when="A single-choice control for filters and settings — the track above switches this page's theme.">
          <SegmentedDemo />
        </Demo>

        <Demo title="Dialog" when="A focused decision that blocks the page until it's answered — confirming, snoozing, naming something.">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="text">Snooze a week</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Snooze this action</DialogTitle>
              <DialogDescription>
                &ldquo;Ask Ms. Park to submit your Michigan rec&rdquo; comes back into your queue in a week. It still counts down in the background.
              </DialogDescription>
              <DialogActions>
                <Button variant="quiet">Cancel</Button>
                <Button variant="primary">Snooze a week</Button>
              </DialogActions>
            </DialogContent>
          </Dialog>
        </Demo>

        <Demo title="Drawer" when="Detail on a row without leaving the page — a right panel on desktop, a bottom sheet on mobile.">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="text">Open Michigan</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerTitle>Michigan</DrawerTitle>
              <DrawerBody>
                <div className="flex flex-col gap-4">
                  <Countdown days={57} size="row" label="days until Early Action." />
                  <p className="text-14 text-fg">Ms. Park was invited to submit a recommendation on Aug 20 and hasn't submitted yet.</p>
                  <p className="text-14 text-fg-2">Common App last synced 3 hours ago.</p>
                </div>
              </DrawerBody>
              <DrawerFooter>
                <Button variant="quiet">Close</Button>
                <Button variant="primary">Draft a nudge to Ms. Park</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </Demo>

        <Demo title="Menu" when="A short list of actions on one row, tucked behind a trigger instead of crowding the row.">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="quiet" iconOnly aria-label="Row actions">
                <DotsThree />
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuLabel>Ask Ms. Park to submit your Michigan rec</MenuLabel>
              <MenuItem>Open</MenuItem>
              <MenuItem>Snooze a week</MenuItem>
              <MenuSeparator />
              <MenuItem danger>Remove from queue</MenuItem>
            </MenuContent>
          </Menu>
        </Demo>

        <Demo title="Popover" when="A small amount of extra content anchored to a control — more than a tooltip, less than a drawer.">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="text">Snooze options</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-14 text-fg">Choose how long "Ask Ms. Park to submit your Michigan rec" stays out of your queue.</p>
              <div className="mt-3 flex flex-col items-start gap-1">
                <Button variant="text" size="sm" className="h-auto px-0">
                  Until tomorrow
                </Button>
                <Button variant="text" size="sm" className="h-auto px-0">
                  A week
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </Demo>

        <Demo title="Tooltip" when="A short label for a control that has no room for one, like the collapsed rail's icons.">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="quiet" iconOnly aria-label="About the collapsed rail">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse the rail to icons only</TooltipContent>
          </Tooltip>
        </Demo>

        <Demo title="Toast" when="A brief confirmation after an action, gone in five seconds unless it needs a follow-up.">
          <div className="flex flex-wrap gap-3">
            <Button variant="text" onClick={() => toast('Marked as done.')}>
              Mark as done
            </Button>
            <Button
              variant="text"
              onClick={() =>
                toast('Removed from your queue.', {
                  action: { label: 'Undo', onClick: () => toast('Restored to your queue.') },
                })
              }
            >
              Remove, with undo
            </Button>
          </div>
        </Demo>

        <Demo title="Table" when="The default shape for a list of things — rows, not cards, with detail one tap away.">
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>#</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>School</TableHeaderCell>
                  <TableHeaderCell>Progress</TableHeaderCell>
                  <TableHeaderCell sort={sortDir} onSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                    Days
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedQueue.map((row, index) => (
                  <Fragment key={row.action}>
                    <TableRow
                      interactive
                      selected={row.selected}
                      expanded={row.expandable ? expandedRow : undefined}
                      onClick={row.expandable ? () => setExpandedRow((open) => !open) : () => toast(`Opened "${row.action}".`)}
                    >
                      <TableCell muted className="tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{row.action}</TableCell>
                      <TableCell muted>{row.school}</TableCell>
                      <TableCell numeric muted>
                        {row.progress ?? '–'}
                      </TableCell>
                      <TableCell numeric>
                        <DaysFigure days={row.days} format="number" />
                      </TableCell>
                    </TableRow>
                    {row.expandable && expandedRow ? (
                      <TableExpansion colSpan={5}>
                        <p className="text-14 text-fg">
                          Evidence: Common App shows this request as sent, but not yet acknowledged by Georgia Tech's registrar, as of Sep 3.
                        </p>
                      </TableExpansion>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Demo>

        <Demo title="Countdown" when="The hero number on Today and every school header — how long until the next deadline.">
          <div className="flex flex-col gap-8">
            <Countdown days={57} size="page" label="days until Michigan, Early Action." />
            <Countdown days={12} size="header" label="days until the Why Michigan supplement is due." />
            <div className="flex flex-wrap items-end gap-8">
              <Countdown days={2} size="row" label="Michigan" />
              <Countdown days={-1} size="row" label="days overdue" />
              <Countdown days={null} size="row" />
            </div>
          </div>
        </Demo>

        <Demo title="DaysFigure" when="A compact, heat-colored day count for a table cell or an inline mention.">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-6">
              {DAYS_FIGURE_SAMPLES.map((days) => (
                <DaysFigure key={`number-${days}`} days={days} format="number" />
              ))}
            </div>
            <div className="flex flex-wrap gap-6">
              {DAYS_FIGURE_SAMPLES.map((days) => (
                <DaysFigure key={`relative-${days}`} days={days} format="relative" />
              ))}
            </div>
          </div>
        </Demo>

        <Demo title="CompletionBar" when="How much of a multi-part checklist is done, grouped by kind.">
          <div className="max-w-md">
            <CompletionBar
              groups={[
                { label: 'Forms', done: 4, total: 4 },
                { label: 'Essays', done: 1, total: 3 },
                { label: 'Recommendations', done: 0, total: 2 },
              ]}
            />
          </div>
        </Demo>

        <Demo title="ProgressTop" when="The one loading indicator in the app — a thin bar at the top of the content column, nothing else.">
          <div className="relative h-8 w-full max-w-md overflow-hidden rounded bg-s1">
            <ProgressTop active className="absolute" />
          </div>
        </Demo>

        <Demo title="Empty" when="Nothing to show yet — one sentence and one link, never an illustration.">
          <Empty sentence="No essays started yet." action={{ label: 'Start the Why Michigan supplement', href: '/essays' }} />
        </Demo>

        <Demo title="PageTitle" when="Every page's own heading, with optional meta on the right and its primary actions.">
          <PageTitle meta="Thursday, September 5" actions={<Button variant="primary">Sync now</Button>}>
            Today
          </PageTitle>
        </Demo>

        <Demo title="Kbd" when="A keyboard hint in a sentence, for the shortcuts the queue and palette support.">
          <p className="text-14 text-fg-2">
            <Kbd>j</Kbd> and <Kbd>k</Kbd> to move, <Kbd>e</Kbd> to open, <Kbd>s</Kbd> to snooze.
          </p>
        </Demo>

        <Demo title="Avatar" when="A person's initials where a photo would otherwise go — the student menu, a recommender.">
          <div className="flex items-center gap-4">
            <Avatar name="Dee Demo" size={32} />
            <Avatar name="Ms. Park" size={24} />
            <Avatar name="Vector" size={24} />
          </div>
        </Demo>

        <Demo title="OkNote, ErrorNote" when="Quiet success and plain-sentence failure — no banners, nothing that moves.">
          <div className="flex flex-col gap-2">
            <OkNote>Your Common App is linked.</OkNote>
            <ErrorNote>Couldn't reach Georgia Tech's portal. Try syncing again.</ErrorNote>
          </div>
        </Demo>

        <Demo title="Command palette" when="⌘K or Ctrl-K anywhere: search schools, essays, recommenders, next actions and pages.">
          <Button variant="text" onClick={() => setCommandOpen(true)}>
            Open the command palette (⌘K / Ctrl-K)
          </Button>
          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <CommandInput placeholder="Search schools, essays, recommenders…" />
            <CommandList>
              <CommandEmpty>No matches. Try a school or essay name.</CommandEmpty>
              <CommandGroup heading="Schools">
                <CommandItem onSelect={() => setCommandOpen(false)}>Michigan</CommandItem>
                <CommandItem onSelect={() => setCommandOpen(false)}>Georgia Tech</CommandItem>
                <CommandItem onSelect={() => setCommandOpen(false)}>Purdue</CommandItem>
              </CommandGroup>
              <CommandGroup heading="Actions">
                <CommandItem shortcut="A" onSelect={() => setCommandOpen(false)}>
                  Approve all
                </CommandItem>
                <CommandItem shortcut="S" onSelect={() => setCommandOpen(false)}>
                  Sync now
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </CommandDialog>
        </Demo>

        <Demo title="Type specimen" when="Every size the type scale defines, each with the content it's actually used for.">
          <div className="flex flex-col gap-3">
            {TYPE_SPECIMEN.map((row) => (
              <div key={row.token} className="flex flex-wrap items-baseline gap-4">
                <span className="w-16 shrink-0 font-mono text-12 text-fg-3">{row.token}</span>
                <span className={cn(row.className, row.face === 'count' ? 'font-count font-semibold tracking-[-0.03em] tabular-nums' : 'font-ui')}>
                  {row.sample}
                </span>
              </div>
            ))}
          </div>
        </Demo>

        <Demo title="Color" when="Every surface with the text colors allowed on it, and the six-step heat scale.">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {SURFACE_SWATCHES.map((surface) => (
                <div key={surface.name} className={cn('flex flex-col gap-1 rounded p-4', surface.bg)}>
                  <span className="text-12 text-fg-3">{surface.name}</span>
                  <span className="text-14 text-fg">Body text</span>
                  <span className="text-14 text-fg-2">Secondary text</span>
                  {surface.carriesTertiary ? <span className="text-14 text-fg-3">Tertiary text</span> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6">
              {HEAT_STEPS.map((step) => (
                <div key={step} className="flex flex-col items-center gap-1">
                  <span className={cn('font-count text-28 font-semibold tabular-nums', HEAT_TEXT_CLASSES[step])}>{step}</span>
                  <span className="text-12 text-fg-2">{HEAT_LABELS[step]}</span>
                </div>
              ))}
            </div>
          </div>
        </Demo>
      </Stack>
    </div>
  );
}

function SearchInputDemo() {
  const [value, setValue] = useState('Michigan');
  return <SearchInput value={value} onChange={(event) => setValue(event.target.value)} onClear={() => setValue('')} />;
}

function SegmentedDemo() {
  const [filter, setFilter] = useState('all');
  return (
    <Segmented
      aria-label="Filter the queue"
      value={filter}
      onValueChange={setFilter}
      options={[
        { value: 'all', label: 'All' },
        { value: 'mine', label: 'Waiting on you' },
        { value: 'done', label: 'Done' },
      ]}
    />
  );
}
