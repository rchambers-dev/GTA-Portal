"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem, NavSection } from "@/lib/portal/types";
import { usePortalSession } from "./session/PortalSessionProvider";
import { NavIcon } from "./nav-icons";
import {
  activeHref,
  focusAfterNavigation,
  groupForPath,
  initialFocus,
  isFocusGroup,
  itemPath,
  toggleHeading,
  type FocusState,
} from "./sidebar-focus";
import { resolveNavigation } from "./workspaces/resolve-navigation";
import { workspaceLabel } from "./workspaces/workspace-stubs";
import styles from "./SidebarNavigation.module.css";

/** Gold cog — premium feature marker (same weight/size as nav icons). */
function PremiumCogIcon() {
  return (
    <svg
      className={styles.premiumIcon}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#gta-gold-cog)"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="gta-gold-cog"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f6d47c" />
          <stop offset="0.55" stopColor="#e3b04b" />
          <stop offset="1" stopColor="#c9922f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * Portal navigation for the signed-in workspace.
 * Collapsed icon rail by default; expands fully on hover / keyboard focus.
 */
export function SidebarNavigation() {
  const pathname = usePathname();
  const { session } = usePortalSession();
  const navigation = resolveNavigation(session);
  const workspace = session.account.workspace;
  const owner = groupForPath(navigation, pathname);
  const [focus, setFocus] = useState<FocusState>(() => initialFocus(navigation, pathname));

  useEffect(() => {
    setFocus((current) => focusAfterNavigation(current, owner));
  }, [owner]);

  return (
    <div className={styles.sidebarSlot}>
      <aside className={styles.sidebar} aria-label="Portal navigation">
        <div className={styles.brand}>
          <div className={styles.logoMark} aria-hidden>
            GTA
          </div>
          <div className={styles.brandText}>
            <p className={styles.brandTitle}>GTA Apprenticeship</p>
            <p className={styles.brandSubtitle}>
              {session.account.baseRole === "Learning and Progress Mentor"
                ? "Progress Mentor"
                : workspaceLabel(workspace)}
            </p>
          </div>
        </div>

        <nav className={styles.nav}>
          <SidebarSections
            navigation={navigation}
            pathname={pathname}
            focused={focus.focused}
            onToggle={(title) => setFocus((current) => toggleHeading(current, title))}
          />
        </nav>

        <div className={styles.footer}>
          <p className={styles.version}>GTA Portal</p>
        </div>
      </aside>
    </div>
  );
}

export function SidebarSections({
  navigation,
  pathname,
  focused,
  onToggle,
}: {
  navigation: NavSection[];
  pathname: string;
  focused: string | null;
  onToggle: (title: string) => void;
}) {
  const visible = focused
    ? navigation.filter((section) => section.title === focused)
    : navigation;

  return (
    <>
      {visible.map((section) => {
        const group = isFocusGroup(section);
        const open = group && section.title === focused;
        const showItems = !group || open;
        const current = activeHref(pathname, showItems ? section.items : []);
        return (
          <div
            key={section.title ?? "default"}
            className={group ? `${styles.section} ${styles.sectionGroup}` : styles.section}
          >
            {section.title && group ? (
              <CategoryButton title={section.title} open={Boolean(open)} onToggle={onToggle} />
            ) : section.title ? (
              <p className={styles.sectionTitle}>{section.title}</p>
            ) : null}
            {showItems ? (
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <NavLeaf key={item.href} item={item} active={item.href === current} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function CategoryButton({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: (title: string) => void;
}) {
  return (
    <button
      type="button"
      className={open ? styles.categoryButtonOpen : styles.categoryButton}
      aria-expanded={open}
      aria-label={open ? `${title}, return to main navigation` : `${title}, show pages`}
      title={title}
      onClick={() => onToggle(title)}
    >
      <span className={styles.icon} data-category-icon={title}>
        <NavIcon href={categoryIconHref(title)} />
      </span>
      <span className={styles.categoryLabel}>{title}</span>
      <span className={styles.chevronTrail} data-chevron={open ? "left" : "right"}>
        <NavChevron direction={open ? "left" : "right"} />
      </span>
    </button>
  );
}

function categoryIconHref(title: string): string {
  if (title === "Onboarding") return "/category/onboarding";
  if (title === "Marketing") return "/category/marketing";
  if (title === "Staff") return "/category/staff";
  return "/category/apprenticeship";
}

function NavChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "right" ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  );
}

function NavLeaf({ item, active }: { item: NavItem; active: boolean }) {
  const path = itemPath(item.href);
  const isPremium = path.includes("/cv");
  return (
    <li>
      <Link
        href={item.href}
        className={active ? styles.linkActive : styles.link}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          event.currentTarget.blur();
        }}
      >
        <span className={styles.icon}>
          <NavIcon href={item.href} />
        </span>
        <span className={styles.label}>{item.label}</span>
        {isPremium ? (
          <span className={styles.premiumBadge} aria-hidden>
            <PremiumCogIcon />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
