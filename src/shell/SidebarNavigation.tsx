"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoSession } from "./demo/DemoSessionProvider";
import { resolveNavigation } from "./workspaces/resolve-navigation";
import { workspaceLabel } from "./workspaces/workspace-stubs";
import styles from "./SidebarNavigation.module.css";

function NavIcon({ href }: { href: string }) {
  const key = href.split("?")[0] ?? href;
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (key.includes("/learning")) {
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  if (key.includes("/modules")) {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.2" />
        <rect x="14" y="3" width="7" height="7" rx="1.2" />
        <rect x="3" y="14" width="7" height="7" rx="1.2" />
        <rect x="14" y="14" width="7" height="7" rx="1.2" />
      </svg>
    );
  }
  if (key.includes("/progress")) {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-7" />
      </svg>
    );
  }
  if (key.includes("/cea")) {
    return (
      <svg {...common}>
        <path d="M9 11l2 2 4-4" />
        <path d="M5 5h14v14H5z" />
      </svg>
    );
  }
  if (key.includes("/otj") || key.includes("/evidence")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    );
  }
  if (key.includes("/attendance")) {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }
  if (key.includes("/reviews")) {
    return (
      <svg {...common}>
        <path d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M3.5 19a4.5 4.5 0 0 1 9 0" />
        <path d="M14 19a3.5 3.5 0 0 1 6.5-1.8" />
      </svg>
    );
  }
  if (key.includes("/messages")) {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" />
      </svg>
    );
  }
  if (key.includes("/support")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 10v6" />
        <path d="M12 7.5h.01" />
      </svg>
    );
  }
  // Dashboard / default
  return (
    <svg {...common}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
    </svg>
  );
}

/**
 * TEMPORARY standalone navigation.
 * Replace with portal navigation on integration.
 * Collapsed icon rail by default; expands fully on hover / keyboard focus.
 */
export function SidebarNavigation() {
  const pathname = usePathname();
  const { session } = useDemoSession();
  const navigation = resolveNavigation(session);
  const workspace = session.account.workspace;

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
          {navigation.map((section) => (
            <div key={section.title ?? "default"} className={styles.section}>
              {section.title ? (
                <p className={styles.sectionTitle}>{section.title}</p>
              ) : null}
              <ul className={styles.list}>
                {section.items.map((item) => {
                  const itemPath = item.href.split("?")[0] ?? item.href;
                  const active =
                    pathname === itemPath ||
                    (itemPath !== "/staff/dashboard" &&
                      itemPath !== "/learner/dashboard" &&
                      itemPath !== "/" &&
                      pathname.startsWith(itemPath));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={active ? styles.linkActive : styles.link}
                        aria-current={active ? "page" : undefined}
                        title={item.label}
                        onClick={(event) => {
                          // Drop focus so :focus-within doesn't pin the rail open
                          // after navigating; hover still expands it.
                          event.currentTarget.blur();
                        }}
                      >
                        <span className={styles.icon}>
                          <NavIcon href={item.href} />
                        </span>
                        <span className={styles.label}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <p className={styles.shellNote}>Standalone shell · design preview</p>
          <p className={styles.version}>v0.1.0-shell</p>
        </div>
      </aside>
    </div>
  );
}
