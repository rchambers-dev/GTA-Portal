"use client";

import { usePortalSession } from "@/shell/session/PortalSessionProvider";
import styles from "./ManagementAuditScreen.module.css";

export function ManagementAuditScreen() {
  const { auditLog } = usePortalSession();

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Audit History</h1>
      <p className={styles.lead}>
        Append-only audit log for temporary responsibility changes in this session.
      </p>

      {auditLog.length === 0 ? (
        <p className={styles.empty}>No audit events yet. Grant or revoke access on Roles &amp; Responsibilities.</p>
      ) : (
        <ul className={styles.list}>
          {[...auditLog].reverse().map((event) => (
            <li key={event.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.action}>{event.action}</span>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString("en-GB")}
                </time>
              </div>
              <p className={styles.summary}>{event.summary}</p>
              <p className={styles.actor}>
                {event.actorName}
                {event.targetUserId ? ` → ${event.targetUserId}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
