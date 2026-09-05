'use client';

import { IconContext } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/**
 * Pins the whole app to one Phosphor weight and size so no call site has to remember to pass
 * `weight="regular"`. Rail and tab bar icons override `size` locally (20px) where they render.
 */
export function IconProvider({ children }: { children: ReactNode }) {
  return <IconContext.Provider value={{ size: 16, weight: 'regular', mirrored: false }}>{children}</IconContext.Provider>;
}
