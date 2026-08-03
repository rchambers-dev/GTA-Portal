"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { canManagePortalAccount, sessionPortalRole } from "@/features/administration/domain/account-access";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { usePortalSession } from "@/shell/demo/PortalSessionProvider";
import {
  buildStaffDocRows,
  isStaffDocGap,
  subscribeStaffPackStore,
  getStaffPackSnapshot,
} from "../domain/staff-pack-store";
import { useSyncExternalStore } from "react";
import styles from "./StaffPackSearchScreen.module.css";

type Props = {
  fromContext?: string;
};

function formatWorkspace(workspace: string): string {
  if (!workspace) return "—";
  return workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

/**
 * Search entry for staff employment files — parallel to Apprentices.
 * Surfaces staff portal accounts Management can manage.
 */
export function StaffPackSearchScreen({ fromContext = "management" }: Props) {
  const [search, setSearch] = useState("");
  const admin = useAdminStore();
  const { session } = usePortalSession();
  const actorRole = sessionPortalRole(session.account);
  const query = search.trim().toLowerCase();

  const packVersion = useSyncExternalStore(
    subscribeStaffPackStore,
    () => JSON.stringify(getStaffPackSnapshot().byStaff),
    () => "",
  );

  const staff = useMemo(
    () =>
      admin.users
        .filter(
          (u) =>
            u.role !== "Apprentice" &&
            u.role !== "Employer" &&
            canManagePortalAccount(actorRole, u.role),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [actorRole, admin.users],
  );

  const rows = useMemo(() => {
    if (!query) return staff;
    return staff.filter((s) => {
      return (
        s.displayName.toLowerCase().includes(query) ||
        s.role.toLowerCase().includes(query) ||
        s.workspace.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        (s.jobTitles ?? []).some((t) => t.toLowerCase().includes(query))
      );
    });
  }, [query, staff]);

  function completeness(staffId: string) {
    void packVersion;
    const docs = buildStaffDocRows(staffId);
    const mandatory = docs.filter((d) => d.requirementKind === "mandatory");
    const gaps = mandatory.filter(isStaffDocGap).length;
    const checked = mandatory.filter(
      (d) => d.status === "checked_and_accepted",
    ).length;
    return { gaps, checked, total: mandatory.length };
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Shared across workspaces</p>
        <h1 className={styles.title}>Staff</h1>
        <p className={styles.description}>
          Open a staff employment file — legal and HR documents needed before
          they can be employed. Checklist is assumed until the real form is
          confirmed.
        </p>
      </header>

      <div className={styles.searchPanel}>
        <label className={styles.searchLabel} htmlFor="staff-pack-search">
          Filter staff (optional)
        </label>
        <input
          id="staff-pack-search"
          className={styles.searchInput}
          type="search"
          placeholder="Filter by name, role, email, or job title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty} role="status">
          {query
            ? `No staff match “${search.trim()}”.`
            : "No staff accounts yet."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Staff</th>
                <th scope="col">Role</th>
                <th scope="col">Workspace</th>
                <th scope="col">File status</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const href = `/staff-records/${s.id}?from=${fromContext}`;
                const { gaps, checked, total } = completeness(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link className={styles.rowLink} href={href}>
                        {s.displayName}
                      </Link>
                    </td>
                    <td>{s.role}</td>
                    <td>{formatWorkspace(s.workspace)}</td>
                    <td>
                      {gaps > 0 ? (
                        <span className={styles.statusGap}>
                          {gaps} mandatory missing
                        </span>
                      ) : (
                        <span className={styles.statusOk}>
                          {checked}/{total} checked
                        </span>
                      )}
                    </td>
                    <td>
                      <Link href={href}>Open file</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
