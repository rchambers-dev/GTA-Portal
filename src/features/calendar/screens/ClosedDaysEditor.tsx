"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClosureRow } from "../domain/closed-days";
import { lockClosureAction, previewClosureAction, saveClosureAction, syncBankHolidaysAction } from "./closed-days-actions";
import styles from "./closed-days.module.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const CHIP = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const KEPT_OPEN = "2027-03-26";
const SITES = [
  { name: "Doncaster", detail: "Open Monday to Friday", open: [1, 2, 3, 4, 5] },
  { name: "Sheffield", detail: "Open Monday and Tuesday only", open: [1, 2] },
];

export type ClosureImpact = { gtaId: string; plannedOn: string; wouldMoveTo: string };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parts(iso: string): { year: number; month: number; day: number; weekday: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const weekday = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return { year, month: month - 1, day, weekday };
}

function shortDay(iso: string): string {
  const date = parts(iso);
  return `${date.day} ${MONTHS_SHORT[date.month]}`;
}

function rangeLabel(row: ClosureRow): string {
  const start = parts(row.startsOn);
  const end = parts(row.endsOn);
  const left = `${WEEKDAYS[start.weekday]} ${start.day} ${MONTHS_SHORT[start.month]}`;
  const right = `${WEEKDAYS[end.weekday]} ${end.day} ${MONTHS_SHORT[end.month]} ${end.year}`;
  if (row.startsOn === row.endsOn) return `${left} ${start.year}`;
  return `${left} – ${right}`;
}

function sourceLabel(source: string): string {
  if (source === "gta_shutdown_sheet") return "GTA shutdown sheet";
  if (source === "gov_uk") return "Auto · gov.uk";
  return "Manual";
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function MonthGrid({
  year,
  month,
  byDate,
  today,
  hatch,
}: {
  year: number;
  month: number;
  byDate: Map<string, { kind: string; name: string }>;
  today: string;
  hatch: number[];
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: ({ day: number; iso: string } | null)[] = [...Array(lead).fill(null)];
  for (let day = 1; day <= count; day += 1) cells.push({ day, iso: isoOf(year, month, day) });
  return (
    <div>
      <div className={styles.monthTitle}>{MONTHS[month]} {year}</div>
      <div className={styles.grid}>
        {DOW.map((label, index) => <span key={`${label}-${index}`} className={styles.dow}>{label}</span>)}
        {cells.map((cell, index) => {
          if (!cell) return <span key={`gap-${index}`} />;
          const kept = cell.iso === KEPT_OPEN;
          const info = kept ? undefined : byDate.get(cell.iso);
          const weekday = parts(cell.iso).weekday;
          const weekend = weekday === 0 || weekday === 6;
          const hatched = !info && !kept && hatch.includes(weekday === 0 ? 7 : weekday);
          const tone = kept ? styles.kept : info?.kind === "bank_holiday" ? styles.bank : info ? styles.closed : hatched ? styles.siteDay : weekend ? styles.weekend : "";
          const title = kept ? "Good Friday stays open" : info?.name;
          return (
            <span key={cell.iso} className={`${styles.cell} ${tone} ${cell.iso === today ? styles.today : ""}`} title={title}>
              {cell.day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ClosedDaysEditor({
  rows,
  lastChecked,
  canWrite,
  initialImpact = [],
}: {
  rows: ClosureRow[];
  lastChecked: string | null;
  canWrite: boolean;
  initialImpact?: ClosureImpact[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startsOn, setStarts] = useState("2026-12-24");
  const [endsOn, setEnds] = useState("2027-01-04");
  const [notes, setNotes] = useState("");
  const [lock, setLock] = useState(true);
  const [impact, setImpact] = useState<ClosureImpact[]>(initialImpact);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const keptOpen: ClosureRow = {
    id: "open-override:2027-03-26",
    name: "Good Friday",
    startsOn: KEPT_OPEN,
    endsOn: KEPT_OPEN,
    kind: "kept_open",
    source: "gov_uk",
    locked: false,
    notes: "Stays open. Easter Tuesday 30 Mar is the substitute closed day.",
    updatedAt: null,
  };

  const calendarRows = rows.filter((row) => !(row.startsOn === KEPT_OPEN && row.endsOn === KEPT_OPEN));
  const listRows = [...calendarRows.filter((row) => {
    if (row.kind !== "bank_holiday") return true;
    return !calendarRows.some((other) => other.kind !== "bank_holiday" && other.id !== row.id && row.startsOn >= other.startsOn && row.endsOn <= other.endsOn);
  }), keptOpen];

  const byDate = useMemo(() => {
    const map = new Map<string, { kind: string; name: string }>();
    const ordered = rows
      .filter((row) => !(row.startsOn === KEPT_OPEN && row.endsOn === KEPT_OPEN))
      .sort((a, b) => Number(a.kind === "bank_holiday") - Number(b.kind === "bank_holiday"));
    for (const row of ordered) {
      const start = new Date(`${row.startsOn}T00:00:00Z`);
      const end = new Date(`${row.endsOn}T00:00:00Z`);
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const iso = cursor.toISOString().slice(0, 10);
        if (iso === KEPT_OPEN) continue;
        map.set(iso, { kind: row.kind, name: row.name });
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
    if (row.kind === "kept_open") return row.notes;
    if (row.kind === "bank_holiday") return row.notes;
    const inside = calendarRows.filter((other) => other.kind === "bank_holiday" && other.startsOn >= row.startsOn && other.startsOn <= row.endsOn && other.id !== row.id);
    if (!inside.length) return row.notes;
    return `Includes bank holiday: ${inside.map((item) => `${item.name} ${shortDay(item.startsOn)}`).join(", ")}`;
  }

  function beginAdd() {
    setEditing(null);
    setName("");
    setStarts("2026-12-24");
    setEnds("2027-01-04");
    setNotes("");
    setLock(true);
    setImpact(initialImpact);
    document.getElementById("add-closed-days")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("closure-name")?.focus();
  }

  function beginEdit(row: ClosureRow) {
    setEditing(row.id);
    setName(row.name);
    setStarts(row.startsOn);
    setEnds(row.endsOn);
    setNotes(row.notes ?? "");
    setLock(row.locked);
    setImpact([]);
    document.getElementById("add-closed-days")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const visibleRows = listRows
    .filter((row) => showPast || row.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));

  const checked = lastChecked
    ? new Date(lastChecked).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "")
    : "not yet";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.crumb}>Management › Settings › Closed days</p>
          <h1>Closed days</h1>
          <p className={styles.lede}>Management enters each closed day once, and it applies to both sites. On a closed day nothing can be booked, picked, routed or planned: no reviews, visits, phone calls, route days or Applicant interviews.</p>
          <div className={styles.sync}>
            <span className={styles.dot} />
            Bank holidays sync automatically from gov.uk (England & Wales) every day at 06:00. Last checked {checked}.
          </div>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.btn} disabled={!canWrite || busy} onClick={() => {
            setBusy(true);
            void syncBankHolidaysAction().then((result) => {
              setBusy(false);
              setMessage(result.ok ? "Bank holidays checked." : result.formError);
              if (result.ok) router.refresh();
            });
          }}>Sync now</button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!canWrite} onClick={beginAdd}>+ Add closed days</button>
        </div>
      </header>
      {message ? <p className={styles.note} role="status">{message}</p> : null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card}>
            <h2>Closed days · Nov 2026 – Jan 2028</h2>
            <div className={styles.months}>
              {months.map(({ year, month }) => (
                <MonthGrid key={`${year}-${month}`} year={year} month={month} byDate={byDate} today={today} hatch={[]} />
              ))}
            </div>
            <div className={styles.legend}>
              <span><i className={`${styles.swatch} ${styles.swatchNavy}`} /> Closed (GTA shutdown sheet)</span>
              <span><i className={`${styles.swatch} ${styles.swatchRed}`} /> Bank holiday (auto from gov.uk)</span>
              <span><i className={`${styles.swatch} ${styles.swatchOpen}`} /> Good Friday 26 Mar 2027: kept open</span>
              <span>Every closed day is closed for everything, at both sites.</span>
            </div>
          </section>
          <section className={styles.card}>
            <div className={styles.listHead}>
              <h2>Closed days list</h2>
              <button type="button" className={styles.btn} onClick={() => setShowPast((current) => !current)}>{showPast ? "Hide past" : "Show past"}</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>Dates</th><th>Name</th><th>Type</th><th>Source</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? <tr><td colSpan={6}>No closed days in this list.</td></tr> : visibleRows.map((row) => {
                  const kept = row.kind === "kept_open";
                  const note = holidayNote(row);
                  return (
                    <tr key={row.id}>
                      <td className={styles.dates}>{rangeLabel(row)}</td>
                      <td>
                        <div className={styles.name}>{row.name}</div>
                        {note ? <div className={styles.sub}>{note}</div> : null}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${kept ? styles.pillOpen : row.kind === "bank_holiday" ? styles.pillRed : styles.pillNavy}`}>
                          {kept ? "Kept open" : row.kind === "bank_holiday" ? "Bank holiday" : "Closed"}
                        </span>
                      </td>
                      <td className={styles.source}>{sourceLabel(row.source)}</td>
                      <td>
                        {kept ? <span className={styles.keptStatus}>Kept open</span> : row.locked ? <span className={styles.locked}><LockIcon /> Locked</span> : <span className={styles.draft}>Draft</span>}
                      </td>
                      <td>
                        {canWrite && !kept ? (
                          <button type="button" className={styles.textBtn} onClick={() => {
                            if (row.locked) void lockClosureAction(row.id, false).then((result) => {
                              if (!result.ok) setMessage(result.formError);
                              else router.refresh();
                            });
                            else beginEdit(row);
                          }}>{row.locked ? "Unlock" : "Edit"}</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
        <aside className={styles.side}>
          <section className={styles.card}>
            <h2>Sites and opening days</h2>
            {SITES.map((site) => (
              <div key={site.name} className={styles.siteRow}>
                <div>
                  <strong>{site.name}</strong>
                  <div className={styles.sub}>{site.detail}</div>
                </div>
                <div className={styles.chips}>
                  {CHIP.map((label, index) => (
                    <span key={label} className={site.open.includes(index + 1) ? styles.chipOn : styles.chip}>{label}</span>
                  ))}
                </div>
              </div>
            ))}
            <div className={styles.mini}>
              <MonthGrid year={2026} month={11} byDate={byDate} today={today} hatch={[3, 4, 5]} />
              <div>
                <p className={styles.siteNote}>How a Sheffield learner&apos;s calendar looks in December. Only Mondays and Tuesdays can be picked (Wednesday to Friday are hatched), and closed days are blocked too. So the last open days before Christmas are Mon 21 and Tue 22 Dec.</p>
                <p className={styles.siteNote}><strong>Everyone starts as Doncaster.</strong> Switch Sheffield learners on their Programme tab.</p>
              </div>
            </div>
          </section>
          {canWrite ? (
            <form id="add-closed-days" className={styles.card} onSubmit={(event) => {
              event.preventDefault();
              void saveClosureAction({ id: editing, name, startsOn, endsOn, kind: "closure", notes }).then(async (result) => {
                if (!result.ok) {
                  setMessage(result.formError);
                  return;
                }
                if (result.id) await lockClosureAction(result.id, lock);
                setMessage("Saved.");
                setEditing(null);
                setName("");
                router.refresh();
              });
            }}>
              <h2>{editing ? "Edit closed days" : "Add closed days"}</h2>
              <label className={styles.field}>Name
                <input id="closure-name" className={styles.control} value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <div className={styles.datePair}>
                <label className={styles.field}>From
                  <input className={styles.control} type="date" value={startsOn} onChange={(event) => setStarts(event.target.value)} required />
                </label>
                <label className={styles.field}>To
                  <input className={styles.control} type="date" value={endsOn} onChange={(event) => setEnds(event.target.value)} required />
                </label>
              </div>
              <label className={styles.field}>Note
                <input className={styles.control} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.check}`}>
                <input type="checkbox" checked={lock} onChange={(event) => setLock(event.target.checked)} /> Lock
              </label>
              <div className={styles.impact}>
                <strong>Impact preview</strong>
                <p>{impact.length} planned {impact.length === 1 ? "review" : "reviews"} would move.</p>
                <ul>
                  {impact.slice(0, 8).map((row) => (
                    <li key={`${row.gtaId}-${row.plannedOn}`}>{row.gtaId}: {shortDay(row.plannedOn)} → {shortDay(row.wouldMoveTo)}</li>
                  ))}
                </ul>
                <button type="button" className={styles.btn} onClick={() => void previewClosureAction(startsOn, endsOn).then((result) => {
                  if (!result.ok) setMessage(result.formError);
                  else setImpact(result.impact as ClosureImpact[]);
                })}>Check reviews</button>
              </div>
              <div className={styles.formActions}>
                {editing ? <button type="button" className={styles.btn} onClick={beginAdd}>Cancel</button> : null}
                <button className={`${styles.btn} ${styles.primary}`} type="submit">Save</button>
              </div>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
