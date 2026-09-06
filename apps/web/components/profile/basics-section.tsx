'use client';

import type { StudentDto } from '@apogee/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DefRow } from '@/components/profile/def-list';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { Button, Drawer, DrawerTrigger, Field, Input, Section, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

export function BasicsSection({ student }: { student: StudentDto }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [preferredName, setPreferredName] = useState(student.preferred_name);
  const [highSchool, setHighSchool] = useState(student.high_school);
  const [gradYear, setGradYear] = useState(String(student.graduation_year ?? CURRENT_YEAR + 1));

  const save = useMutation({
    mutationFn: () =>
      clientApi.call('profileUpdateBasics', {
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          preferred_name: preferredName.trim(),
          high_school: highSchool.trim(),
          graduation_year: Number(gradYear),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Basics"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setFirstName(student.first_name);
              setLastName(student.last_name);
              setPreferredName(student.preferred_name);
              setHighSchool(student.high_school);
              setGradYear(String(student.graduation_year ?? CURRENT_YEAR + 1));
            }
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Basics" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <Field label="First name">
              <Input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </Field>
            <Field label="Last name">
              <Input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </Field>
            <Field label="Preferred name">
              <Input maxLength={80} value={preferredName} onChange={(event) => setPreferredName(event.target.value)} placeholder={firstName} />
            </Field>
            <Field label="High school">
              <Input required maxLength={200} value={highSchool} onChange={(event) => setHighSchool(event.target.value)} />
            </Field>
            <Field label="Graduation year">
              <Select value={gradYear} onValueChange={setGradYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAD_YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </DrawerContentShell>
        </Drawer>
      }
    >
      <div>
        <DefRow label="Name" value={`${student.first_name} ${student.last_name}`} />
        <DefRow label="Preferred name" value={student.preferred_name} />
        <DefRow label="High school" value={student.high_school} />
        <DefRow label="Graduation year" value={student.graduation_year} />
      </div>
    </Section>
  );
}
