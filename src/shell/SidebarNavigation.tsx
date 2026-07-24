"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoSession } from "./demo/DemoSessionProvider";
import { resolveNavigation } from "./workspaces/resolve-navigation";
import { workspaceLabel } from "./workspaces/workspace-stubs";
import styles from "./SidebarNavigation.module.css";

/**
 * TEMPORARY standalone navigation.
 * Replace with portal navigation on integration.
 */
export function SidebarNavigation() {
  const pathname = usePathname();
  const { session } = useDemoSession();
  const navigation = resolveNavigation(session);
  const workspace = session.account.workspace;

  return (
    <aside className={styles.sidebar} aria-label="Portal navigation">
      <div className={styles.brand}>
        <div className={styles.logoMark} aria-hidden>
          GTA
        </div>
        <div>
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
                    >
                      {item.label}
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
  );
}
