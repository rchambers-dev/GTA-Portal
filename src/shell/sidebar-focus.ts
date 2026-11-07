import type { NavSection } from "@/lib/portal/types";

/** Category headings that collapse to a button. Other titled sections stay expanded. */
export const SIDEBAR_FOCUS_GROUPS = [
  "Onboarding",
  "Marketing & Recruitment",
  "Staff",
  "Apprenticeship Management",
  "Reviews",
] as const;

export type SidebarFocusGroup = (typeof SIDEBAR_FOCUS_GROUPS)[number];

export type FocusState = {
  focused: string | null;
  dismissed: string | null;
};

export function isFocusGroup(section: NavSection): boolean {
  return Boolean(section.title && (SIDEBAR_FOCUS_GROUPS as readonly string[]).includes(section.title));
}

export function itemPath(href: string): string {
  return href.split("?")[0] ?? href;
}

export function pathWithin(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Longest matching link wins, so an overview is not active beside a deeper page. */
export function activeHref(pathname: string, items: { href: string }[]): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const item of items) {
    const path = itemPath(item.href);
    if (!pathWithin(pathname, path)) continue;
    if (path.length > bestLength) {
      best = item.href;
      bestLength = path.length;
    }
  }
  return best;
}

export function groupForPath(sections: NavSection[], pathname: string): string | null {
  let best: { title: string; length: number } | null = null;
  for (const section of sections) {
    if (!isFocusGroup(section) || !section.title) continue;
    for (const item of section.items) {
      const path = itemPath(item.href);
      if (!pathWithin(pathname, path)) continue;
      if (!best || path.length > best.length) {
        best = { title: section.title, length: path.length };
      }
    }
  }
  return best?.title ?? null;
}

/** Same heading closes the group. A different heading opens that group. Does not navigate. */
export function toggleHeading(state: FocusState, title: string): FocusState {
  if (state.focused === title) {
    return { focused: null, dismissed: title };
  }
  return { focused: title, dismissed: null };
}

/**
 * Direct links and history open the owning group.
 * Dismissing the heading stays dismissed until the path leaves that group.
 */
export function focusAfterNavigation(state: FocusState, owner: string | null): FocusState {
  if (owner && state.dismissed === owner) {
    return { focused: null, dismissed: owner };
  }
  if (owner) return { focused: owner, dismissed: null };
  return { focused: null, dismissed: null };
}

export function initialFocus(sections: NavSection[], pathname: string): FocusState {
  return { focused: groupForPath(sections, pathname), dismissed: null };
}
