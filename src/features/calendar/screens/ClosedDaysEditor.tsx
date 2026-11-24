"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClosureRow } from "../domain/closed-days";
import { lockClosureAction, previewClosureAction, removeClosureAction, saveClosureAction } from "./closed-days-actions";
import styles from "./closed-days.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ClosedDaysEditor({
  year,
  rows,
  canWrite,
}: {
  year: number;
  rows: ClosureRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startsOn, setStarts] = useState(`${year}-01-04`);
  const [endsOn, setEnds] = useState(`${year}-01-04`);
  const [kind, setKind] = useState("closure");
  const [notes, setNotes] = useState("");
  const [impact, setImpact] = useState<{ gtaId: string; plannedOn: string; wouldMoveTo: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const closed = new Set<string>();
  for (const row of rows) {
    const start = new Date(`${row.startsOn}T00:00:00Z`);
    const end = new Date(`${row.endsOn}T00:00:00Z`);
    for (let cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (cursor.getUTCFullYear() === year) closed.add(cursor.toISOString().slice(0, 10));
    }
  }
  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <h2>{year}</h2>
        <p>Good Friday 26 Mar {year === 2027 ? "stays open" : ""}.</p>
        {MONTHS.map((label, month) => {
          const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          return (
            <div key={label}>
              <strong>{label}</strong>
              <div className={styles.month}>
                {Array.from({ length: days }, (_, index) => {
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
                  const isClosed = closed.has(iso);
                  const goodFriday = iso === "2027-03-26";
                  return (
                    <span key={iso} className={`${styles.cell} ${isClosed ? styles.closed : ""} ${goodFriday ? styles.openFriday : ""}`} title={isClosed ? "Closed" : goodFriday ? "Good Friday stays open" : iso}>
                      {index + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
      <section className={styles.card}>
        <h2>Closures</h2>
        {rows.length === 0 ? <p>No closed days loaded for this year.</p> : rows.map((row) => (
          <div className={styles.row} key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <div>{row.startsOn} – {row.endsOn} · {row.kind}{row.locked ? " · locked" : ""}</div>
            </div>
            {canWrite ? (
              <div className={styles.actions}>
                <button type="button" onClick={() => void lockClosureAction(row.id, !row.locked).then(() => router.refresh())}>{row.locked ? "Unlock" : "Lock"}</button>
                <button type="button" onClick={() => void removeClosureAction(row.id).then(() => router.refresh())}>Remove</button>
              </div>
            ) : null}
          </div>
        ))}
        {canWrite ? (
          <form className={styles.impact} onSubmit={(event) => {
            event.preventDefault();
            void saveClosureAction({ name, startsOn, endsOn, kind, notes }).then((result) => {
              if (!result.ok) setMessage(result.formError);
              else {
                setMessage("Saved.");
                router.refresh();
              }
            });
          }}>
            <h2>Add</h2>
            <label>Name <input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>From <input type="date" value={startsOn} onChange={(event) => setStarts(event.target.value)} required /></label>
            <label>To <input type="date" value={endsOn} onChange={(event) => setEnds(event.target.value)} required /></label>
            <label>Kind
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="closure">Closure</option>
                <option value="bank_holiday">Bank holiday</option>
              </select>
            </label>
            <label>Notes <input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <div className={styles.actions}>
              <button type="button" onClick={() => void previewClosureAction(startsOn, endsOn).then((result) => {
                if (!result.ok) setMessage(result.formError);
                else setImpact(result.impact as { gtaId: string; plannedOn: string; wouldMoveTo: string }[]);
              })}>Preview impact</button>
              <button className={styles.primary} type="submit">Save</button>
            </div>
            {impact.length ? (
              <div>
                <p>{impact.length} planned reviews would move.</p>
                <ul>{impact.slice(0, 8).map((row) => <li key={`${row.gtaId}-${row.plannedOn}`}>{row.gtaId}: {row.plannedOn} → {row.wouldMoveTo}</li>)}</ul>
              </div>
            ) : <p>Preview shows which planned reviews would move before you save.</p>}
            {message ? <p role="status">{message}</p> : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
