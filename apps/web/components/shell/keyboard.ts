/** Shared keyboard guards for the shell's global shortcuts (⌘K) and the queue's single-letter
 * ones (j/k/e/s) — both need to stay quiet while the visitor is typing somewhere else. */

/** True when the event target is a place where a bare letter should type, not act as a shortcut:
 * a text field, a contenteditable region, or anything inside an open dialog/menu/listbox. */
export function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  return Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"]'));
}

/** Whether ⌘ (rather than Ctrl) is this platform's primary modifier, so the rail's search row and
 * the palette's own shortcut hint can read "⌘K" on a Mac and "Ctrl K" everywhere else. */
export function isMacPlatform(): boolean {
  try {
    return /mac/i.test(navigator.platform);
  } catch {
    return false;
  }
}
