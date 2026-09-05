'use client';

import type { StudentDto } from '@apogee/shared/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i);

export function BasicsSection({ student }: { student: StudentDto }) {
  const { toast } = useToast();
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
    onSuccess: (updated) => {
      setFirstName(updated.first_name);
      setLastName(updated.last_name);
      setPreferredName(updated.preferred_name);
      setHighSchool(updated.high_school);
      setGradYear(String(updated.graduation_year ?? CURRENT_YEAR + 1));
      toast({ title: 'Basics saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basics</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input id="profile-first-name" required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input id="profile-last-name" required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-preferred-name">Preferred name</Label>
            <Input id="profile-preferred-name" maxLength={80} value={preferredName} onChange={(event) => setPreferredName(event.target.value)} placeholder={firstName} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-high-school">High school</Label>
              <Input id="profile-high-school" required maxLength={200} value={highSchool} onChange={(event) => setHighSchool(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-grad-year">Graduation year</Label>
              <Select value={gradYear} onValueChange={setGradYear}>
                <SelectTrigger id="profile-grad-year">
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
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save basics
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
