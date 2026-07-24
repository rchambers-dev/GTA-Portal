"use client";

import { useMemo, useState } from "react";
import { DEMO_ACCOUNTS } from "@/adapters/fictional/demo-accounts";
import { isAssignmentActive } from "@/lib/permissions/effective-permissions";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import styles from "./ManagementRolesScreen.module.css";

const TARGET_PROGRAMME = "Accident Repair Technician";

export function ManagementRolesScreen() {
  const { session, assignments, grantTemporaryCurriculumEditor, revokeAssignment } = useDemoSession();
  const [expiryDays, setExpiryDays] = useState("7");

  const daniel = DEMO_ACCOUNTS.find((a) => a.id === "daniel-turner");
  const danielAssignments = useMemo(
    () =>
      assignments.filter(
        (a) => a.userId === "daniel-turner" && isAssignmentActive(a),
      ),
    [assignments],
  );

  if (!daniel) return null;

  function handleGrant() {
    const days = Number(expiryDays) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    grantTemporaryCurriculumEditor({
      targetUserId: daniel!.id,
      programmeScope: [TARGET_PROGRAMME],
      expiresAt: expiresAt.toISOString(),
      grantedBy: session,
    });
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Roles &amp; Responsibilities</h1>
        <p className={styles.lead}>
          Grant temporary Curriculum Editor access with programme scope and expiry. Changes
          persist locally for demo verification.
        </p>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>{daniel.name}</h2>
        <p className={styles.meta}>
          Base role: {daniel.baseRole} · Department: {daniel.department}
        </p>

        {danielAssignments.length > 0 ? (
          <ul className={styles.assignments}>
            {danielAssignments.map((assignment) => (
              <li key={assignment.id} className={styles.assignment}>
                <div>
                  <p className={styles.assignmentTitle}>{assignment.responsibility}</p>
                  <p className={styles.assignmentMeta}>
                    Scope: {assignment.programmeScope?.join(", ")} · Expires{" "}
                    {new Date(assignment.expiresAt).toLocaleString("en-GB")}
                  </p>
                  <p className={styles.assignmentMeta}>
                    Granted by {assignment.grantedByName}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.revokeBtn}
                  onClick={() => revokeAssignment(assignment.id, session)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No active temporary responsibilities.</p>
        )}

        <div className={styles.grantRow}>
          <label className={styles.label}>
            Expiry (days)
            <input
              type="number"
              min={1}
              max={90}
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className={styles.input}
            />
          </label>
          <button type="button" className={styles.grantBtn} onClick={handleGrant}>
            Grant temporary Curriculum Editor ({TARGET_PROGRAMME})
          </button>
        </div>
      </section>

      <section className={styles.hint}>
        <p>
          Demo flow: switch to Daniel — no Curriculum Management. Switch to Sarah — section
          visible. As Jon, grant Daniel temporary access, switch back to Daniel — Curriculum
          Management appears with expiry badge. Revoke or wait for expiry to block curriculum
          routes again.
        </p>
      </section>
    </div>
  );
}
