'use client';

import { useState } from 'react';
import { Button, Prose } from '@/components/system';
import { cn } from '@/lib/utils';

// A DOM measurement (does the rendered text actually overflow two lines) would need a ref and a
// resize observer for what is otherwise a static decision; a character-count threshold is a close
// enough proxy for "longer than two lines" at this column width and stays a plain function.
const LONG_PROMPT_THRESHOLD = 180;

export function EssayPrompt({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!prompt) return null;
  const isLong = prompt.length > LONG_PROMPT_THRESHOLD;

  return (
    <div className="flex flex-col items-start gap-2">
      <Prose>
        <p className={cn('whitespace-pre-wrap text-14 text-fg-2', !expanded && isLong && 'line-clamp-2')}>{prompt}</p>
      </Prose>
      {isLong ? (
        <Button variant="quiet" size="sm" className="h-auto px-0" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide the prompt' : 'Show the prompt'}
        </Button>
      ) : null}
    </div>
  );
}
