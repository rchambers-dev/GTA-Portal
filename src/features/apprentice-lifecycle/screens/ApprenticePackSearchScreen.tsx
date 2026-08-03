"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import styles from "./ApprenticePackSearchScreen.module.css";

export type ApprenticeSearchHit = {
  apprenticeId: string;
  displayName: string;
  employerName: string | null;
  programmeName: string;
  tutorName: string | null;
  apprenticeReference: string | null;
};

type Props = {
  apprentices: ApprenticeSearchHit[];
  fromContext?: string;
};

/**
 * Blank entry to the shared ADM14 apprentice file pack.
 * Live: administration intake / enrolments only.
 * Demo: also merges fictional pack apprentices passed as props.
 */
export function ApprenticePackSearchScreen({
  apprentices,
  fromContext = "apprentices",
}: Props) {
  const [search, setSearch] = useState("");
  const admin = useAdminStore();
  const query = search.trim().toLowerCase();

  const mergedApprentices = useMemo(() => {
    const byId = new Map<string, ApprenticeSearchHit>();
    for (const hit of apprentices) byId.set(hit.apprenticeId, hit);

    for (const apprentice of admin.apprentices) {
      // Anyone on the system (draft or ready) can open the full pack.
      // Unfinished personal intake still shows with a note inside the pack.
      const enrolment = admin.enrolments.find((e) => e.apprenticeId === apprentice.id);
      byId.set(apprentice.id, {
        apprenticeId: apprentice.id,
        displayName: apprentice.displayName,
        employerName: enrolment?.employerName ?? null,
        programmeName: enrolment?.programmeName ?? "Awaiting enrolment",
        tutorName: enrolment?.tutorName ?? null,
        apprenticeReference: apprentice.apprenticeReference,
      });
    }

    return [...byId.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [admin.enrolments, admin.apprentices, apprentices]);

  const rows = useMemo(() => {
    if (!query) return [];
    return mergedApprentices.filter((l) => {
      return (
        l.displayName.toLowerCase().includes(query) ||
        (l.employerName?.toLowerCase().includes(query) ?? false) ||
        l.programmeName.toLowerCase().includes(query) ||
        l.apprenticeId.toLowerCase().includes(query) ||
        (l.apprenticeReference?.toLowerCase().includes(query) ?? false) ||
        (l.tutorName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [mergedApprentices, query]);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Shared across workspaces</p>
        <h1 className={styles.title}>Apprentices</h1>
        <p className={styles.description}>
          Search for an apprentice to open their full apprenticeship evidence pack.
          Add people on Apprentice Intake first — then open the pack from here or
          from Intake.
        </p>
      </header>

      <div className={styles.searchPanel}>
        <label className={styles.searchLabel} htmlFor="apprentice-pack-search">
          Find an apprentice
        </label>
        <input
          id="apprentice-pack-search"
          className={styles.searchInput}
          type="search"
          placeholder="Search by name, employer, programme, or apprentice ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>

      {!query ? (
        <div className={styles.blankState} role="status">
          <p className={styles.blankTitle}>No apprentice selected</p>
          <p className={styles.blankCopy}>
            Start typing above to Find an apprentice. Their complete file pack opens
            next — including form data and document evidence as they progress.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.empty} role="status">
          No apprentices match “{search.trim()}”.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Apprentice</th>
                <th scope="col">Employer</th>
                <th scope="col">Programme</th>
                <th scope="col">Tutor</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const href = `/apprentices/${l.apprenticeId}?from=${fromContext}`;
                return (
                  <tr key={l.apprenticeId}>
                    <td>
                      <Link className={styles.rowLink} href={href}>
                        {l.displayName}
                      </Link>
                    </td>
                    <td>{l.employerName ?? "—"}</td>
                    <td>{l.programmeName}</td>
                    <td>{l.tutorName ?? "—"}</td>
                    <td>
                      <Link href={href}>Open pack</Link>
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
