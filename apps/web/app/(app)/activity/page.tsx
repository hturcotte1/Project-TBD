'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ActivityStream } from '@/components/activity/activity-stream';
import { PageTitle } from '@/components/system';

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — Activity has no numeral of its own. A hidden span still warms the font file so
          it's not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle>Activity</PageTitle>
      <ActivityStream />
    </div>
  );
}
