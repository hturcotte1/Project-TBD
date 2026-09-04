'use client';

import { useEffect, useState } from 'react';

/** Tracks whether the tab is currently visible, so polling can pause when it isn't. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function update() {
      setVisible(document.visibilityState === 'visible');
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}
