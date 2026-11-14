"use client";

import { useState } from "react";
import { londonStamp } from "../domain/analytics";
import styles from "./analytics.module.css";

const PAGE = 20;

export function ReviewLog({
  rows,
}: {
  rows: { learner: string; detail: string; pill: string; actor: string; role: string; at: string }[];
}) {
  const [shown, setShown] = useState(PAGE);
  const visible = rows.slice(0, shown);
  return (
    <section className={styles.card} id="analytics-log">
      <h2>Review log</h2>
      {visible.length === 0 ? <p className={styles.muted}>No review log yet.</p> : (
        <table className={styles.log}>
          <thead><tr><th>Learner</th><th>Detail</th><th>Event</th><th>Actor</th><th>Role</th><th>Time</th></tr></thead>
          <tbody>
            {visible.map((item, index) => (
              <tr key={`${item.at}-${index}`}>
                <td>{item.learner}</td>
                <td>{item.detail}</td>
                <td><span className={styles.pill}>{item.pill}</span></td>
                <td>{item.actor}</td>
                <td>{item.role}</td>
                <td>{londonStamp(item.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {shown < rows.length ? (
        <button type="button" className={styles.more} onClick={() => setShown((count) => count + PAGE)}>
          Show more
        </button>
      ) : null}
    </section>
  );
}
