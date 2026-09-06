'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CostsTab } from '@/components/admin/costs-tab';
import { DriftTab } from '@/components/admin/drift-tab';
import { JobsTab } from '@/components/admin/jobs-tab';
import { QueuesTab } from '@/components/admin/queues-tab';
import { StudentsTable } from '@/components/admin/students-table';
import { PageTitle, Segmented } from '@/components/system';

type AdminSection = 'students' | 'queues' | 'jobs' | 'drift' | 'costs';

const SECTION_OPTIONS: { value: AdminSection; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'queues', label: 'Queues' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'drift', label: 'Drift' },
  { value: 'costs', label: 'Costs' },
];

function isAdminSection(value: string): value is AdminSection {
  return SECTION_OPTIONS.some((option) => option.value === value);
}

export function AdminView() {
  const router = useRouter();
  const [section, setSectionState] = useState<AdminSection>('students');

  // Same convention as Activity and Timeline: the URL is the source of truth, read once on mount
  // so a shared link or a screenshot's own navigation lands on the right view.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('view');
    if (value && isAdminSection(value)) setSectionState(value);
  }, []);

  function setSection(next: string) {
    if (!isAdminSection(next)) return;
    setSectionState(next);
    const params = new URLSearchParams(window.location.search);
    if (next === 'students') params.delete('view');
    else params.set('view', next);
    router.replace(`/admin${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — Admin has no numeral of its own. A hidden span still warms the font file so it's
          not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle>Admin</PageTitle>
      <Segmented aria-label="Admin view" value={section} onValueChange={setSection} options={SECTION_OPTIONS} />
      {section === 'students' ? <StudentsTable /> : null}
      {section === 'queues' ? <QueuesTab /> : null}
      {section === 'jobs' ? <JobsTab /> : null}
      {section === 'drift' ? <DriftTab /> : null}
      {section === 'costs' ? <CostsTab /> : null}
    </div>
  );
}
