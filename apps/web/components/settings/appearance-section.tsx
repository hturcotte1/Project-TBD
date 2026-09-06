'use client';

import { Section, Segmented } from '@/components/system';
import { type ThemeSetting, useTheme } from '@/lib/theme';

const OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

export function AppearanceSection() {
  const [theme, setTheme] = useTheme();

  return (
    <Section title="Appearance">
      <div className="flex flex-col gap-1">
        <Segmented aria-label="Appearance" value={theme} onValueChange={(value) => setTheme(value as ThemeSetting)} options={OPTIONS} />
        <p className="text-12 text-fg-2">Follows your device when set to System.</p>
      </div>
    </Section>
  );
}
