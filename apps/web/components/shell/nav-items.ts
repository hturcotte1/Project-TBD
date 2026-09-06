import { Buildings, CalendarBlank, ChatCircle, House, ListBullets, PencilSimpleLine, UsersThree } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

/** The rail's (and, filtered, the mobile tab bar's and palette's) primary navigation, in the
 * fixed order DESIGN.md specifies. `agentName` comes from settings — the conversation page is
 * labeled with whatever the student has named their agent, "Vector" by default. */
export function buildPrimaryNav(agentName: string): NavItem[] {
  return [
    { href: '/', label: 'Today', icon: House },
    { href: '/schools', label: 'Schools', icon: Buildings },
    { href: '/essays', label: 'Essays', icon: PencilSimpleLine },
    { href: '/recommenders', label: 'Recommenders', icon: UsersThree },
    { href: '/timeline', label: 'Timeline', icon: CalendarBlank },
    { href: '/chat', label: agentName, icon: ChatCircle },
    { href: '/activity', label: 'Activity', icon: ListBullets },
  ];
}

/** Mobile tab bar keeps four of the seven (Recommenders, Timeline and Activity live in the
 * palette and in links from Today/school pages), plus a Search tab handled separately. */
export const MOBILE_TAB_HREFS: readonly string[] = ['/', '/schools', '/essays', '/chat'];

/** True when `href` is (or is a descendant route of) the current pathname — shared by the rail
 * and the mobile tab bar so "selected" agrees everywhere. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
