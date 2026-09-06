import type { Shot } from './types';

export const SHOTS: Shot[] = [
  { name: 'system', path: '/dev/system', fullPage: true },
  {
    name: 'system-palette',
    path: '/dev/system',
    fullPage: true,
    prepare: async (page) => {
      await page.keyboard.press('Control+k');
      // Matches only the palette's own input; the plain Input demo elsewhere on the page has the
      // shorter placeholder "Search schools", which this pattern deliberately excludes.
      await page.getByPlaceholder(/search schools, essays/i).waitFor({ state: 'visible' });
    },
  },
];
