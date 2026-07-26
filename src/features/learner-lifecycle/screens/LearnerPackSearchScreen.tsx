"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import styles from "./LearnerPackSearchScreen.module.css";

export type LearnerSearchHit = {
  learnerId: string;
  displayName: string;
  employerName: string | null;
  programmeName: string;
  tutorName: string | null;
  learnerReference: string | null;
};

type Props = {
  learners: LearnerSearchHit[];
  fromContext?: string;
};

/**
 * Blank entry to the shared ADM14 learner file pack.
 * Merges demo pack learners with administration intake records.
 */
export function LearnerPackSearchScreen({
  learners,
  fromContext = "learners",
}: Props) {
  const [search, setSearch] = useState("");
  const admin = useAdminStore();
  const query = search.trim().toLowerCase();

  const mergedLearners = useMemo(() => {
    const byId = new Map<string, LearnerSearchHit>();
    for (const hit of learners) byId.set(hit.learnerId, hit);

    for (const learner of admin.learners) {
      // Only surface people who are ready or already enrolled — unfinished
      // intake drafts stay on the Intake queue.
      const enrolment = admin.enrolments.find((e) => e.learnerId === learner.id);
      if (learner.intakeStatus !== "ready" && !enrolment) continue;
      byId.set(learner.id, {
        learnerId: learner.id,
        displayName: learner.displayName,
        employerName: enrolment?.employerName ?? null,
        programmeName: enrolment?.programmeName ?? "Awaiting enrolment",
        tutorName: enrolment?.tutorName ?? null,
        learnerReference: learner.learnerReference,
      });
    }

    return [...byId.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [admin.enrolments, admin.learners, learners]);

  const rows = useMemo(() => {
    if (!query) return [];
    return mergedLearners.filter((l) => {
      return (
        l.displayName.toLowerCase().includes(query) ||
        (l.employerName?.toLowerCase().includes(query) ?? false) ||
        l.programmeName.toLowerCase().includes(query) ||
        l.learnerId.toLowerCase().includes(query) ||
        (l.learnerReference?.toLowerCase().includes(query) ?? false) ||
        (l.tutorName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [mergedLearners, query]);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Shared across workspaces</p>
        <h1 className={styles.title}>Learners</h1>
        <p className={styles.description}>
          Search for a learner to open their apprenticeship evidence pack.
          Enter and update progressive documents here — not on Intake.
        </p>
      </header>

      <div className={styles.searchPanel}>
        <label className={styles.searchLabel} htmlFor="learner-pack-search">
          Find a learner
        </label>
        <input
          id="learner-pack-search"
          className={styles.searchInput}
          type="search"
          placeholder="Search by name, employer, programme, or learner ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>

      {!query ? (
        <div className={styles.blankState} role="status">
          <p className={styles.blankTitle}>No learner selected</p>
          <p className={styles.blankCopy}>
            Start typing above to find a learner. Their complete file pack opens
            next — including form data and document evidence as they progress.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.empty} role="status">
          No learners match “{search.trim()}”.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Employer</th>
                <th scope="col">Programme</th>
                <th scope="col">Tutor</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const href = `/learners/${l.learnerId}?from=${fromContext}`;
                return (
                  <tr key={l.learnerId}>
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
