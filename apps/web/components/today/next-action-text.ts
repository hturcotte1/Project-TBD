/** Matches a trailing " — it is due in N days." or ", it is due in N days." clause — the part of
 * the prioritizer's reason sentence that duplicates the row's own days figure. Only a clause that
 * is the literal end of the string is dropped; a dependency clause tacked on after it ("...and it
 * depends on someone else acting first.") is left alone. */
const TRAILING_DUE_CLAUSE = /(?: — |, )it is due in \d+ days?\.$/;

/** Tidies a next action's `action` or `reason` text for display: spaced em dashes (the
 * prioritizer's sentence joiner) become commas, and a trailing "it is due in N days." clause is
 * dropped since the row already shows that figure. The backend text itself is never changed —
 * this only touches what's rendered. */
export function tidyNextActionText(text: string): string {
  const withoutDueClause = text.replace(TRAILING_DUE_CLAUSE, '');
  return withoutDueClause.replaceAll(' — ', ', ');
}
