import { Button } from './button';
import { TextLink } from './link';
import { cn } from '@/lib/utils';

export interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyProps {
  /** The one sentence explaining the empty state — no icon, no headline. */
  sentence: string;
  action?: EmptyAction;
  className?: string;
}

/** DESIGN.md: "one sentence and one link, in the page's own voice" — no illustration, no card. */
export function Empty({ sentence, action, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-start gap-2 py-12', className)}>
      <p className="text-14 text-fg-2">{sentence}</p>
      {action ? (
        action.href ? (
          <TextLink href={action.href}>{action.label}</TextLink>
        ) : (
          <Button variant="text" size="sm" className="h-auto px-0" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
