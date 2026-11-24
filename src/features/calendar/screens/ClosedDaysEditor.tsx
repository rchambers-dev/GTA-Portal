"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClosureRow } from "../domain/closed-days";
import { lockClosureAction, previewClosureAction, saveClosureAction, syncBankHolidaysAction } from "./closed-days-actions";
import styles from "./closed-days.module.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SITES = [
  { name: "Doncaster", open: [1, 2, 3, 4, 5] },
  { name: "Sheffield", open: [1, 2] },
];

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]?.slice(0, 3)} ${year}`;
}

function rangeLabel(row: ClosureRow): string {
  return row.startsOn === row.endsOn ? formatDay(row.startsOn) : `${formatDay(row.startsOn)} – ${formatDay(row.endsOn)}`;
}

function sourceLabel(source: string): string {
  if (source === "gta_shutdown_sheet") return "GTA shutdown sheet";
  if (source === "gov_uk") return "GOV.UK";
  return "Manual";
}

export function ClosedDaysEditor({
  rows,
  lastChecked,
  canWrite,
}: {
  rows: ClosureRow[];
  lastChecked: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startsOn, setStarts] = useState("2027-01-04");
  const [endsOn, setEnds] = useState("2027-01-04");
  const [notes, setNotes] = useState("");
  const [lock, setLock] = useState(true);
  const [impact, setImpact] = useState<{ gtaId: string; plannedOn: string; wouldMoveTo: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, { kind: string; name: string }>();
    for (const row of rows) {
      const start = new Date(`${row.startsOn}T00:00:00Z`);
      const end = new Date(`${row.endsOn}T00:00:00Z`);
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        map.set(cursor.toISOString().slice(0, 10), { kind: row.kind, name: row.name });
      }
    }
    return map;
  }, [rows]);

  const months = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let year = 2026, month = 10; year < 2028 || (year === 2028 && month === 0); ) {
      list.push({ year, month });
      month += 1;
      if (month === 12) {
        month = 0;
        year += 1;
      }
    }
    return list;
  }, []);

  function holidayNote(row: ClosureRow): string | null {
    if (row.kind === "bank_holiday") return null;
    const inside = rows.filter((other) => other.kind === "bank_holiday" && other.startsOn >= row.startsOn && other.startsOn <= row.endsOn && other.id !== row.id);
    if (!inside.length) return row.notes;
    return `Includes bank holiday: ${inside.map((item) => `${item.name} ${formatDay(item.startsOn)}`).join(", ")}`;
  }

  function beginAdd() {
    setEditing(null);
    setName("");
    setStarts("2027-01-04");
    setEnds("2027-01-04");
    setNotes("");
    setLock(true);
    setImpact([]);
    setOpen(true);
  }

  function beginEdit(row: ClosureRow) {
    setEditing(row.id);
    setName(row.name);
    setStarts(row.startsOn);
    setEnds(row.endsOn);
    setNotes(row.notes ?? "");
    setLock(row.locked);
    setImpact([]);
    setOpen(true);
  }

  const checked = lastChecked
    ? new Date(lastChecked).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "not yet";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>Management · Settings</p>
          <h1>Closed days</h1>
          <p className={styles.intro}>A closed day is closed at Doncaster and Sheffield. Reviews are not planned on it, and a week with fewer than three open days is left empty.</p>
          <p className={styles.status}>Bank holidays sync automatically from gov.uk (England & Wales) every day at 06:00. Last checked {checked}.</p>
        </div>
        <div className={styles.topActions}>
          <button type="button" disabled={!canWrite || busy} onClick={() => {
            setBusy(true);
            void syncBankHolidaysAction().then((result) => {
              setBusy(false);
              setMessage(result.ok ? "Bank holidays checked." : result.formError);
              if (result.ok) router.refresh();
            });
          }}>Sync now</button>
          <button type="button" className={styles.primary} disabled={!canWrite} onClick={beginAdd}>+ Add closed days</button>
        </div>
      </header>
      {message ? <p className={styles.note} role="status">{message}</p> : null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card}>
            <div className={styles.legend}>
              <span><i className={styles.swatchNavy} /> Closed</span>
              <span><i className={styles.swatchRed} /> Bank holiday</span>
              <span><i className={styles.swatchOpen} /> Kept open</span>
              <span><i className={styles.swatchMuted} /> Weekend</span>
            </div>
            <div className={styles.months}>
              {months.map(({ year, month }) => {
                const first = new Date(Date.UTC(year, month, 1));
                const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
                const lead = (first.getUTCDay() + 6) % 7;
                const cells: ({ day: number; iso: string } | null)[] = [...Array(lead).fill(null)];
                for (let day = 1; day <= count; day += 1) {
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  cells.push({ day, iso });
                }
                return (
                  <div key={`${year}-${month}`}>
                    <h2>{MONTHS[month]} {year}</h2>
                    <div className={styles.month}>
                      {DOW.map((label) => <span key={label} className={styles.dow}>{label}</span>)}
                      {cells.map((cell, index) => {
                        if (!cell) return <span key={`gap-${index}`} />;
                        const info = byDate.get(cell.iso);
                        const weekend = new Date(`${cell.iso}T00:00:00Z`).getUTCDay() % 6 === 0;
                        const kept = cell.iso === "2027-03-26";
                        const tone = kept ? styles.kept : info?.kind === "bank_holiday" ? styles.bank : info ? styles.closed : weekend ? styles.weekend : "";
                        return <span key={cell.iso} className={`${styles.cell} ${tone}`} title={kept ? "Good Friday stays open" : info?.name}>{cell.day}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className={styles.card}>
            <h2>Closed days list</h2>
            <table className={styles.table}>
              <thead>
                <tr><th>Dates</th><th>Name</th><th>Type</th><th>Source</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={6}>No closed days are loaded yet.</td></tr> : rows.map((row) => (
                  <tr key={row.id}>
                    <td>{rangeLabel(row)}</td>
                    <td><strong>{row.name}</strong>{holidayNote(row) ? <div className={styles.sub}>{holidayNote(row)}</div> : null}</td>
                    <td><span className={row.kind === "bank_holiday" ? styles.pillRed : styles.pillNavy}>{row.kind === "bank_holiday" ? "Bank holiday" : "Closure"}</span></td>
                    <td>{sourceLabel(row.source)}</td>
                    <td><span className={styles.lock}>{row.locked ? "Locked" : "Draft"}</span></td>
                    <td>{canWrite ? <button type="button" onClick={() => row.locked ? void lockClosureAction(row.id, false).then(() => router.refresh()) : beginEdit(row)}>{row.locked ? "Unlock" : "Edit"}</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <aside className={styles.side}>
          <section className={styles.card}>
            <h2>Sites and opening days</h2>
            {SITES.map((site) => (
              <div key={site.name} className={styles.site}>
                <strong>{site.name}</strong>
                <div className={styles.chips}>
                  {DOW.slice(0, 5).map((label, index) => (
                    <span key={label} className={site.open.includes(index + 1) ? styles.chipOn : styles.chipOff}>{label}</span>
                  ))}
                </div>
              </div>
            ))}
          </section>
          {open && canWrite ? (
            <form className={styles.card} onSubmit={(event) => {
              event.preventDefault();
              void saveClosureAction({ id: editing, name, startsOn, endsOn, kind: "closure", notes }).then(async (result) => {
                if (!result.ok) {
                  setMessage(result.formError);
                  return;
                }
                if (result.id) await lockClosureAction(result.id, lock);
                setMessage("Saved.");
                setOpen(false);
                router.refresh();
              });
            }}>
              <h2>{editing ? "Edit closed days" : "Add closed days"}</h2>
              <label>Name <input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label>From <input type="date" value={startsOn} onChange={(event) => setStarts(event.target.value)} required /></label>
              <label>To <input type="date" value={endsOn} onChange={(event) => setEnds(event.target.value)} required /></label>
              <label>Note <input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <label className={styles.check}><input type="checkbox" checked={lock} onChange={(event) => setLock(event.target.checked)} /> Lock</label>
              <div className={styles.impact}>
                <strong>Impact preview</strong>
                <button type="button" onClick={() => void previewClosureAction(startsOn, endsOn).then((result) => {
                  if (!result.ok) setMessage(result.formError);
                  else setImpact(result.impact as { gtaId: string; plannedOn: string; wouldMoveTo: string }[]);
                })}>Check reviews</button>
                <p>{impact.length} planned {impact.length === 1 ? "review" : "reviews"} would move.</p>
                <ul>{impact.slice(0, 6).map((row) => <li key={`${row.gtaId}-${row.plannedOn}`}>{row.gtaId}: {formatDay(row.plannedOn)} → {formatDay(row.wouldMoveTo)}</li>)}</ul>
              </div>
              <div className={styles.topActions}>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
                <button className={styles.primary} type="submit">Save</button>
              </div>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
