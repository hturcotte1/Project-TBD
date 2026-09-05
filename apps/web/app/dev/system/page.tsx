import { notFound } from 'next/navigation';
import { SystemSink } from '@/components/dev/system-sink';

// Without this, `next build` statically prerenders the route and bakes today's NODE_ENV (always
// "production" at build time, even for a build that will later run in dev — see next-start's own
// CLI, which only *defaults* NODE_ENV rather than forcing it) into the output forever. Forcing
// dynamic rendering makes the check below run per-request, against whatever is actually serving it.
export const dynamic = 'force-dynamic';

/** The component-system kitchen sink — every variant and state, real content, both themes. Dev
 * and preview only: this is a workbench for building screens, not a page anyone ships to users. */
export default function DevSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SystemSink />;
}
