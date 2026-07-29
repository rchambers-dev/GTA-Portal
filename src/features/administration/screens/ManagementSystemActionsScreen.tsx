"use client";

import Link from "next/link";
import { LearnerPageShell } from "@/features/learner-portal/components/LearnerPageShell";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import styles from "./admin-pages.module.css";

const ACTIONS: Array<{
  href: string;
  title: string;
  description: string;
}> = [
  {
    href: "/management/learner-data",
    title: "Load learner data",
    description:
      "Enter actual progress % and notes on behalf of pupils without their form flows.",
  },
  {
    href: "/management/force-complete-tasks",
    title: "Force-complete tasks",
    description:
      "Backfill verified Autocare blocks/tasks for learners who already completed work — updates progression BRAG.",
  },
];

/**
 * Hub for management system actions (bootstrap / exception tools).
 */
export function ManagementSystemActionsScreen() {
  const { session } = useDemoSession();
  const canAct = hasPermission(session, PERMISSIONS.RECORDS_PROXY_WRITE);

  return (
    <LearnerPageShell
      eyebrow="Management"
      title="System Actions"
      description="Bootstrap and exception tools for management. Day-to-day delivery stays on enrolments, cohorts, and tutor sign-off."
    >
      {!canAct ? (
        <p className={styles.empty}>
          You need the records.proxy.write permission to use these actions.
        </p>
      ) : (
        <div className={styles.stack}>
          {ACTIONS.map((action) => (
            <article key={action.href} className={styles.panel}>
              <h2 className={styles.panelTitle}>{action.title}</h2>
              <p className={styles.panelLead}>{action.description}</p>
              <div className={styles.formActions}>
                <Link href={action.href} className={styles.primaryBtn}>
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </LearnerPageShell>
  );
}
