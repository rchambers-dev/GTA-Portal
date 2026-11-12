"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fitStops, routeSettings } from "../domain/plan-drive";
import { addDays, formatPlanDate, formatShortNumericDate, methodLabel, minutesToTime, planDateParts, timeToMinutes, weekdayName } from "../domain/plan-due";
import { NOTE_UNTIL_PRESETS, noteUntilLabel, noteUntilPresets } from "../domain/plan-notes";
import type { PackedDay } from "../domain/plan-route";
import type { PlanCounter, PlanPageData, PlanPerson, PlanStop } from "../domain/plan-repository";
import {
  acceptDayAction,
  applyRouteAction,
  bookReviewAction,
  clearBookingAction,
  completeDayAction,
  excludeStopAction,
  recordSafeguardingAction,
  reverseSafeguardingAction,
  setNotesAction,
  verifyStopAction,
} from "./plan-actions";
import { PlanMap } from "./PlanMap";
import styles from "./plan.module.css";

const TABS: { id: PlanCounter; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "to_book", label: "To book" },
  { id: "locked", label: "Locked" },
  { id: "booked", label: "Booked" },
];

export function PlanView({
  workspace,
  page,
  date,
  month,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  date: string;
  month: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PlanCounter>("to_book");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notePerson, setNotePerson] = useState<PlanPerson | null>(null);
  const [packed, setPacked] = useState<PackedDay | null>(null);
  const [officePoint, setOfficePoint] = useState<{ lat: number; lon: number; postcode: string } | null>(null);
  const noted = page.people
    .filter((person) => person.notes)
    .slice()
    .sort(
      (a, b) =>
        a.notesUntil.localeCompare(b.notesUntil) || a.name.localeCompare(b.name, "en-GB"),
    );
  const marks = new Set(page.monthMarks.map((item) => item.date));
  const completedDays = new Set(page.monthMarks.filter((item) => item.completed).map((item) => item.date));
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return page.people.filter((person) => {
      if (person.counter !== tab) return false;
      if (!term) return true;
      return [person.name, person.tutor, person.company].join(" ").toLowerCase().includes(term);
    });
  }, [page.people, query, tab]);
  const heading = planDateParts(date);
  const stopKey = (page.day?.stops ?? []).map((stop) => `${stop.gtaId}:${stop.arrive}:${stop.leave}`).join("|");

  useEffect(() => {
    let cancel = false;
    if (!page.day?.stops.length) return;
    void fitStops({
      officePostcode: page.settings.officePostcode,
      existing: page.day.stops,
      extras: [],
      settings: routeSettings(page.settings),
      people: page.people,
    }).then((fitted) => {
      if (cancel) return;
      setPacked(fitted.packed);
      setOfficePoint(fitted.office);
    });
    return () => {
      cancel = true;
    };
  }, [stopKey, page.settings.officePostcode, page.settings.startTime, page.settings.lunchStart, page.settings.lunchMinutes, page.settings.returnBy, page.settings.stayMinutes, page.settings.callMinutes]);

  function go(nextDate: string, nextMonth = month) {
    const params = new URLSearchParams({ date: nextDate, month: nextMonth });
    router.push(`/${workspace}/reviews/plan?${params.toString()}`);
  }

  async function run(work: () => Promise<{ ok: boolean; formError?: string | null }>) {
    setMessage(null);
    const result = await work();
    if (!result.ok) {
      setMessage(result.formError || "The plan could not be saved.");
      return;
    }
    if (result.formError) setMessage(result.formError);
    router.refresh();
  }

  async function placePeople(extras: PlanPerson[]) {
    if (!page.canWrite) return;
    if (page.day?.accepted) {
      setMessage("This route is already accepted. Unlock it before changing the drive times.");
      return;
    }
    const weekday = weekdayName(date);
    const allowed = extras.filter((person) => person.releaseDay !== weekday && person.method !== "phone");
    const blocked = extras.filter((person) => !allowed.includes(person));
    if (blocked.length && !allowed.length) {
      const person = blocked[0];
      setMessage(
        person.method === "phone"
          ? `${person.name} is a phone review, so they stay off the driving round.`
          : `${person.name} is at college on ${weekday}.`,
      );
      return;
    }
    setMessage("Checking drive times…");
    const fitted = await fitStops({
      officePostcode: page.settings.officePostcode,
      existing: page.day?.stops ?? [],
      extras: allowed,
      settings: routeSettings(page.settings),
      people: page.people,
    });
    setPacked(fitted.packed);
    setOfficePoint(fitted.office);
    if (!fitted.office) {
      setMessage(`Could not find the office postcode ${page.settings.officePostcode}.`);
      return;
    }
    const added = fitted.packed.stops.filter((stop) => allowed.some((person) => person.gtaId === stop.id));
    if (allowed.length && added.length < allowed.length && !fitted.missing.length) {
      setMessage(`No space before ${page.settings.returnBy}.`);
    }
    if (!fitted.packed.stops.length) return;
    await run(() =>
      applyRouteAction({
        date,
        stops: fitted.packed.stops.map((stop) => ({ gtaId: stop.id, arrive: stop.arrive, leave: stop.leave })),
      }),
    );
    if (fitted.missing.length) setMessage(`Could not find: ${fitted.missing.join(", ")}`);
  }

  async function dropPerson(gtaId: string) {
    const person = page.people.find((item) => item.gtaId === gtaId);
    if (!person) return;
    if (page.day?.stops.some((stop) => stop.gtaId === gtaId)) {
      setMessage(`${person.name} is already on this day.`);
      return;
    }
    await placePeople([person]);
  }

  async function showMap() {
    setMapOpen((value) => !value);
    if (mapOpen || !page.day?.stops.length) return;
    const fitted = await fitStops({
      officePostcode: page.settings.officePostcode,
      existing: page.day.stops,
      extras: [],
      settings: routeSettings(page.settings),
      people: page.people,
    });
    setPacked(fitted.packed);
    setOfficePoint(fitted.office);
    if (fitted.missing.length) setMessage(`Could not find: ${fitted.missing.join(", ")}`);
  }

  return (
    <div className={styles.layout} data-plan-page="live">
      <section className={styles.roster} aria-label="Need booking">
        <div className={styles.tabs} role="tablist" aria-label="Need booking lists">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? (item.id === "locked" ? styles.tabLocked : styles.tabOn) : styles.tab}
              data-roster-tab={item.id}
              onClick={() => setTab(item.id)}
            >
              <strong id={`paper-${item.id}`}>{page.counts[item.id]}</strong>
              <em>{item.label}</em>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          Search names, tutors or companies
          <span className={styles.searchField}>
            <input
              type="search"
              placeholder="e.g. Bailey or Polypipe"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => setQuery("")}>
                ×
              </button>
            ) : null}
          </span>
        </label>
        <ul className={styles.list}>
          {visible.length === 0 ? (
            <li className={styles.empty}>
              {tab === "locked"
                ? "No one is locked waiting for a reply. Use the lock on a stop when you are waiting to hear back."
                : tab === "booked"
                  ? "No one is booked yet."
                  : tab === "waiting"
                    ? "No one is waiting."
                    : "No one needs booking."}
            </li>
          ) : (
            visible.map((person) => (
              <RosterCard
                key={person.gtaId}
                workspace={workspace}
                person={person}
                canWrite={page.canWrite}
                onNote={() => setNotePerson(person)}
              />
            ))
          )}
        </ul>
      </section>
      <section className={styles.plan} aria-labelledby="plan-title">
        <div className={styles.head}>
          <h2 id="plan-title" className={styles.planTitle}>
            <span className={styles.kicker}>Plan For</span>
            <span className={styles.dateDay}>
              {heading.day}
              <sup>{heading.ordinal}</sup>
            </span>{" "}
            {heading.month}
          </h2>
          <div className={styles.headActions}>
            <button type="button" className={styles.pill} aria-expanded={mapOpen} onClick={() => void showMap()}>
              {mapOpen ? "Hide map" : "Show map"}
            </button>
            <button
              type="button"
              className={`${styles.pill} ${noted.length ? styles.pillOn : ""}`}
              aria-expanded={notesOpen}
              aria-haspopup="true"
              onClick={() => setNotesOpen((value) => !value)}
            >
              <span>Notes</span>
              <strong>{noted.length}</strong>
            </button>
          </div>
        </div>
        {notesOpen ? (
          <ul className={styles.notesMenu} aria-label="Notes still on the plan">
            {noted.length === 0 ? <li className={styles.empty}>No notes at the moment.</li> : null}
            {noted.map((person) => {
              const until = noteUntilLabel(person.notesUntil, page.today);
              return (
                <li key={person.gtaId}>
                  <button type="button" className={styles.noteItem} onClick={() => { setNotesOpen(false); setNotePerson(person); }}>
                    <strong>{person.name}</strong>
                    <span>{person.notes}</span>
                    <em className={until.overdue ? styles.overdue : undefined}>{until.label}</em>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <Calendar
          month={month}
          date={date}
          today={page.today}
          marks={marks}
          completed={completedDays}
          onPick={(next) => go(next, next.slice(0, 7))}
          onMonth={(next) => go(date, next)}
        />
        {message ? (
          <p className={styles.status} role="status">
            {message}
          </p>
        ) : null}
        <div
          className={styles.drop}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const id = event.dataTransfer.getData("text/plain");
            if (id) void dropPerson(id);
          }}
        >
          {page.day?.completed ? (
            <div className={styles.lockedDay}>
              <span className={styles.completedPill}>
                <LockIcon /> Route completed
              </span>
              <p className={styles.lockNote}>This day is locked. The visits can’t be changed.</p>
            </div>
          ) : (
            <div className={styles.routeBar}>
              {page.canWrite ? (
                <button
                  type="button"
                  className={styles.fill}
                  onClick={() =>
                    void placePeople(
                      page.people.filter(
                        (person) =>
                          person.counter === "to_book" && !page.day?.stops.some((stop) => stop.gtaId === person.gtaId),
                      ),
                    )
                  }
                >
                  Fill Day
                </button>
              ) : null}
              {page.canWrite && page.day && page.day.stops.length > 0 ? (
                <DayActions workspace={workspace} page={page} date={date} packed={packed} onRun={run} />
              ) : null}
            </div>
          )}
          {page.day?.accepted && !page.day.completed ? (
            <p className={styles.acceptNote}>This day’s learners will not be moved if you plan the week again.</p>
          ) : null}
          <DayTimeline
            workspace={workspace}
            page={page}
            date={date}
            packed={packed}
            locked={Boolean(page.day?.completed)}
            onRun={run}
            onNote={(gtaId) => {
              const person = page.people.find((item) => item.gtaId === gtaId);
              if (person) setNotePerson(person);
            }}
          />
          {mapOpen ? <PlanMap office={officePoint} stops={packed?.stops ?? []} /> : null}
        </div>
      </section>
      {notePerson ? (
        <div className={styles.backdrop} onMouseDown={() => setNotePerson(null)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-sheet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHead}>
              <h2 id="note-sheet-title">Note · {notePerson.name}</h2>
              <button type="button" className={styles.pill} onClick={() => setNotePerson(null)}>
                Close
              </button>
            </div>
            <NoteForm
              reviewId={notePerson.reviewId || ""}
              notes={notePerson.notes}
              until={notePerson.notesUntil}
              today={page.today}
              onRun={async (work) => {
                await run(work);
                setNotePerson(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RosterCard({
  workspace,
  person,
  canWrite,
  onNote,
}: {
  workspace: "administration" | "management";
  person: PlanPerson;
  canWrite: boolean;
  onNote: () => void;
}) {
  return (
    <li
      className={styles.card}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.gtaId)}
      data-roster-gta={person.gtaId}
    >
      <span className={styles.rowMain}>
        <Link href={`/${workspace}/onboarding/apprentice/${person.gtaId}`}>{person.name}</Link>
        <span className={styles.college}>College {person.releaseDay}</span>
      </span>
      <DuePill person={person} />
      {canWrite && person.reviewId ? (
        <button type="button" className={person.notes ? styles.noteOn : styles.pill} onClick={onNote}>
          {person.notes ? "Edit note" : "Add note"}
        </button>
      ) : null}
    </li>
  );
}

function DayActions({
  workspace,
  page,
  date,
  packed,
  onRun,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  date: string;
  packed: PackedDay | null;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
}) {
  const stops = page.day?.stops ?? [];
  const ready =
    stops.length > 0 &&
    stops.every((stop) => stop.verified || stop.locked || stop.appointmentOn === date);
  return (
    <div className={styles.dayActions}>
      {page.settings.outEnabled ? (
        <a className={styles.ghost} href={`/${workspace}/reviews/out`}>Open Out</a>
      ) : null}
      {page.day?.accepted ? (
        <a className={styles.fill} href={mailto(page, date)}>
          Email this route
        </a>
      ) : null}
      {page.day?.accepted ? (
        <button type="button" className={styles.fill} onClick={() => printRoute(page, date, packed)}>
          Print this route
        </button>
      ) : null}
      {page.day?.accepted ? (
        <button
          type="button"
          className={styles.accept}
          disabled={date > page.today}
          onClick={() =>
            void onRun(() =>
              completeDayAction({
                date,
                gtaIds: stops.map((stop) => stop.gtaId),
              }),
            )
          }
        >
          Mark route completed
        </button>
      ) : (
        <button
          type="button"
          className={styles.accept}
          disabled={!ready}
          onClick={() =>
            void onRun(() =>
              acceptDayAction({
                date,
                stops: stops.map((stop) => ({
                  gtaId: stop.gtaId,
                  kind: stop.kind === "phone" || stop.kind === "teams" ? stop.kind : "visit",
                  arrive: stop.arrive || "10:00",
                  leave: stop.leave || "10:30",
                })),
              }),
            )
          }
        >
          Accept Route
        </button>
      )}
    </div>
  );
}

function printRoute(page: PlanPageData, date: string, packed: PackedDay | null) {
  const popup = window.open("", "print-route");
  if (!popup) return;
  const leave = packed ? minutesToTime(packed.leaveMinutes) : page.settings.startTime;
  const back = packed ? minutesToTime(packed.returnArrive) : "";
  const drive = packed?.driveTotal ? `${Math.round(packed.driveTotal)} min driving` : "";
  const stops = (packed?.stops ?? page.day?.stops.map((stop) => ({
    ...stop,
    arrive: timeToMinutes(stop.arrive) ?? 0,
    leave: timeToMinutes(stop.leave) ?? 0,
  })) ?? []);
  const body = stops
    .map(
      (stop, index) =>
        `<article class="print-stop"><div class="print-when">${minutesToTime(stop.arrive)}–${minutesToTime(stop.leave)}</div><div><h2>${index + 1}. ${escapeHtml(stop.name)}</h2><p>${escapeHtml(`${stop.company} · ${stop.postcode}`)}</p></div></article>`,
    )
    .join("");
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(date)} review round</title><style>body{font:13px/1.4 Calibri,Arial,sans-serif;color:#111;margin:24px}h1{font-size:22px;margin:0 0 4px}.lede{margin:0 0 18px;color:#444}.print-stop{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:10px 0;border-top:1px solid #ccc}.print-when{font-weight:700}h2{font-size:16px;margin:0 0 4px}p{margin:0}.end{border-top:1px solid #111;margin-top:8px;padding-top:10px;font-weight:700}@media print{body{margin:12mm}}</style></head><body><h1>${escapeHtml(formatPlanDate(date))} workplace review round</h1><p class="lede">Leave ${escapeHtml(page.settings.officePostcode)} at ${escapeHtml(leave)} · ${stops.length} visit${stops.length === 1 ? "" : "s"}${drive ? ` · ${escapeHtml(drive)}` : ""}</p>${body}<p class="end">Back at ${escapeHtml(page.settings.officePostcode)}${back ? ` at ${escapeHtml(back)}` : ""}</p></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function mailto(page: PlanPageData, date: string): string {
  const lines = (page.day?.stops ?? []).map(
    (stop, index) => `${index + 1}. ${stop.name}, ${stop.company}, ${stop.postcode}, ${stop.arrive}–${stop.leave}`,
  );
  const to = page.settings.extraEmails.join(",");
  return `mailto:${to}?subject=${encodeURIComponent(`Review route ${date}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function StopCard({
  workspace,
  stop,
  index,
  date,
  today,
  canWrite,
  dayIds,
  onRun,
  onNote,
}: {
  workspace: "administration" | "management";
  stop: PlanStop;
  index: number;
  date: string;
  today: string;
  canWrite: boolean;
  dayIds: string[];
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
  onNote: (gtaId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<"book" | "note" | "lock" | null>(null);
  const [method, setMethod] = useState(stop.method || "in_person");
  const [time, setTime] = useState(stop.arrive || "10:00");
  const phoneDigits = stop.phone.replace(/\D/g, "");
  const priority = stop.dueState === "overdue" ? styles.tagOver : stop.dueState === "due-soon" ? styles.tagSoon : styles.tagOk;
  return (
    <article
      className={`${styles.stop} ${styles.planCard} ${expanded ? "" : styles.closed}`}
      data-stop={stop.gtaId}
      onClick={() => setExpanded((value) => !value)}
    >
      <p className={styles.when}>
        <span className={styles.arrive}>{minutesToTime(stop.arriveMinutes) || "—"}</span>
        <span className={styles.until}>–{minutesToTime(stop.leaveMinutes) || "—"}</span>
      </p>
      <div className={styles.stopBody}>
        <div className={styles.stopHead}>
          <p className={styles.stopName}>
            {canWrite ? (
              <span className={styles.handle} aria-hidden="true">
                <svg viewBox="0 0 12 16">
                  <circle cx="4" cy="3" r="1.35" />
                  <circle cx="8" cy="3" r="1.35" />
                  <circle cx="4" cy="8" r="1.35" />
                  <circle cx="8" cy="8" r="1.35" />
                  <circle cx="4" cy="13" r="1.35" />
                  <circle cx="8" cy="13" r="1.35" />
                </svg>
              </span>
            ) : null}
            <span className={styles.stopNum}>{index + 1}</span>
            <Link href={`/${workspace}/onboarding/apprentice/${stop.gtaId}`} onClick={(event) => event.stopPropagation()}>
              {stop.name}
            </Link>
          </p>
          <p className={styles.pills}>
            <span className={`${styles.tag} ${priority}`}>{stop.dueState === "ok" ? "On track" : stop.dueLabel}</span>
            <button
              type="button"
              className={stop.safeguarding ? styles.safeOn : styles.safeOff}
              onClick={(event) => {
                event.stopPropagation();
                if (!canWrite) return;
                void onRun(() =>
                  stop.safeguarding && stop.signoffId
                    ? reverseSafeguardingAction({ signoffId: stop.signoffId })
                    : recordSafeguardingAction({ gtaId: stop.gtaId, date }),
                );
              }}
            >
              Safeguarding
            </button>
            {stop.completed ? <span className={styles.tagDone}>Review done</span> : null}
            {!stop.completed && stop.verified ? <span className={styles.tagDone}>Verified</span> : null}
            {stop.locked ? <span className={styles.tagLock}>Locked</span> : null}
          </p>
        </div>
        <span className={styles.contactLine}>
          {stop.contact ? <strong>{stop.contact}</strong> : null}
          {stop.phone ? (
            <>
              {stop.contact ? " · " : ""}
              <a href={`tel:${phoneDigits}`} onClick={(event) => event.stopPropagation()}>{stop.phone}</a>
            </>
          ) : null}
        </span>
        {canWrite && !stop.completed ? (
          <div className={styles.stopExtra} onClick={(event) => event.stopPropagation()}>
            <p className={styles.placeLine}>
              {stop.company} · {stop.postcode} · tutor {stop.tutor} · college {stop.releaseDay}
            </p>
            <div className={styles.actionGrid}>
            <button
              type="button"
              className={stop.verified ? styles.actionGhost : styles.actionPrimary}
              onClick={() =>
                void onRun(() =>
                  verifyStopAction({
                    date,
                    gtaId: stop.gtaId,
                    verified: !stop.verified,
                    arrive: stop.arrive || "10:00",
                    leave: stop.leave || "10:30",
                    dayGtaIds: dayIds,
                  }),
                )
              }
            >
              {stop.verified ? "Undo verify" : "Verify"}
            </button>
            <button type="button" className={styles.actionBlue} onClick={() => setOpen(open === "book" ? null : "book")}>
              Rebook
            </button>
            <button type="button" className={styles.actionBlue} onClick={() => setOpen(open === "book" ? null : "book")}>
              Phone review
            </button>
            <button type="button" className={styles.actionGrey} onClick={() => onNote(stop.gtaId)}>
              {stop.notes ? "Edit note" : "Add note"}
            </button>
            <Link className={styles.actionBlue} href={`/${workspace}/onboarding/apprentice/${stop.gtaId}`} onClick={(event) => event.stopPropagation()}>
              Edit details
            </Link>
            <button type="button" className={styles.actionDanger} onClick={() => void onRun(() => excludeStopAction({ date, gtaId: stop.gtaId }))}>
              Take off this round
            </button>
            </div>
            {stop.notes ? (
              <p className={styles.noteBox}>
                {stop.notes}
                {stop.notesUntil ? ` · ${noteUntilLabel(stop.notesUntil, today).label}` : ""}
              </p>
            ) : null}
        {open === "book" && stop.reviewId ? (
          <form
            className={styles.inline}
            onSubmit={(event) => {
              event.preventDefault();
              void onRun(() =>
                bookReviewAction({
                  reviewId: stop.reviewId || "",
                  method,
                  date,
                  time,
                  phoneDay: weekdayName(date),
                }),
              );
            }}
          >
            <label>
              Booking method
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="in_person">In person</option>
                <option value="teams">Teams</option>
                <option value="phone">Phone call</option>
              </select>
            </label>
            {method === "phone" ? null : (
              <label>
                Time
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </label>
            )}
            <button type="submit">Book Appointment</button>
            <button
              type="button"
              onClick={() => void onRun(() => clearBookingAction({ reviewId: stop.reviewId || "" }))}
            >
              Back To Queue
            </button>
          </form>
        ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function NoteForm({
  reviewId,
  notes,
  until,
  today,
  onRun,
}: {
  reviewId: string;
  notes: string;
  until: string;
  today: string;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
}) {
  const presets = noteUntilPresets(today);
  const [text, setText] = useState(notes);
  const [end, setEnd] = useState(until || presets.week);
  return (
    <form
      className={styles.inline}
      onSubmit={(event) => {
        event.preventDefault();
        void onRun(async () => (await setNotesAction({ reviewId, notes: text, until: text.trim() ? end : "" })) ?? { ok: false, formError: "The note could not be saved." });
      }}
    >
      <label>
        Note
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="e.g. Off sick, doctor's note" />
      </label>
      <p className={styles.meta}>Keep this note until</p>
      <div className={styles.presets}>
        {NOTE_UNTIL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={end === presets[preset.id]}
            className={end === presets[preset.id] ? styles.noteOn : styles.pill}
            onClick={() => setEnd(presets[preset.id])}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label>
        End date
        <input type="date" min={today} value={end} onChange={(event) => setEnd(event.target.value)} />
      </label>
      <button type="submit" className={styles.noteOn}>Save note</button>
      {notes ? (
        <button type="button" className={styles.clearNote} onClick={() => void onRun(async () => (await setNotesAction({ reviewId, notes: "", until: "" })) ?? { ok: false, formError: "The note could not be saved." })}>
          Clear
        </button>
      ) : null}
    </form>
  );
}

function Calendar({
  month,
  date,
  today,
  marks,
  completed,
  onPick,
  onMonth,
}: {
  month: string;
  date: string;
  today: string;
  marks: Set<string>;
  completed: Set<string>;
  onPick: (date: string) => void;
  onMonth: (month: string) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const startDow = first.getUTCDay();
  const lead = startDow === 0 || startDow === 6 ? 0 : startDow - 1;
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let day = 1; day <= days; day += 1) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    const name = weekdayName(iso);
    if (name === "Saturday" || name === "Sunday") continue;
    cells.push(iso);
  }
  function shift(delta: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
    onMonth(next.toISOString().slice(0, 7));
  }
  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <h3>
          {first.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </h3>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className={styles.calGrid}>
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((label) => (
          <span key={label} className={styles.calLabel}>
            {label}
          </span>
        ))}
        {cells.map((iso, index) =>
          iso ? (
            <button
              key={iso}
              type="button"
              className={[
                styles.day,
                iso === date ? styles.dayOn : "",
                iso === previousWeekday(date) ? styles.dayPrev : "",
                iso === today && iso !== date ? styles.dayToday : "",
                completed.has(iso) ? styles.dayDone : marks.has(iso) ? styles.dayBooked : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(-2))}
            </button>
          ) : (
            <span key={`gap-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

function previousWeekday(iso: string): string {
  let cursor = addDays(iso, -1);
  while (weekdayName(cursor) === "Saturday" || weekdayName(cursor) === "Sunday") cursor = addDays(cursor, -1);
  return cursor;
}

function DuePill({ person }: { person: PlanPerson }) {
  const tone = person.dueState === "overdue" ? styles.tagOver : person.dueState === "due-soon" ? styles.tagSoon : styles.tagOk;
  const label = person.dueState === "ok" ? "On track" : person.dueState === "due-soon" ? "Due this week" : person.dueLabel;
  return (
    <span className={`${styles.duePill} ${tone}`}>
      <span>{label}</span>
      {person.nextDate ? <small>{formatShortNumericDate(person.nextDate)}</small> : null}
    </span>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lockIcon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6-2a2 2 0 1 1 4 0v2h-4V6zm6 14H7V10h10v10z" />
    </svg>
  );
}

function DayTimeline({
  workspace,
  page,
  date,
  packed,
  locked,
  onRun,
  onNote,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  date: string;
  packed: PackedDay | null;
  locked: boolean;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
  onNote: (gtaId: string) => void;
}) {
  const stops = [...(page.day?.stops ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || (a.arriveMinutes ?? 0) - (b.arriveMinutes ?? 0));
  const lunchStart = timeToMinutes(page.settings.lunchStart) ?? 12 * 60 + 30;
  const lunchEnd = lunchStart + page.settings.lunchMinutes;
  const leave = packed?.leaveMinutes ?? timeToMinutes(page.settings.startTime) ?? 10 * 60;
  const back = packed?.returnArrive;
  if (!stops.length) return null;
  return (
    <div className={locked ? styles.lockedPanel : styles.timeline}>
      <div className={styles.stop}>
        <div className={styles.when}>{minutesToTime(leave)}</div>
        <div>
          <strong>Leave office</strong>
          <div className={styles.meta}>{page.settings.officePostcode}</div>
        </div>
      </div>
      {stops.map((stop, index) => {
        const leaveMin = stop.leaveMinutes ?? timeToMinutes(stop.leave) ?? 0;
        const next = stops[index + 1];
        const nextArrive = next ? (next.arriveMinutes ?? timeToMinutes(next.arrive) ?? 0) : back ?? leaveMin;
        const crosses = leaveMin <= lunchStart && nextArrive >= lunchEnd;
        return (
          <div key={stop.gtaId}>
            <StopCard
              workspace={workspace}
              stop={stop}
              index={index}
              date={date}
              today={page.today}
              canWrite={page.canWrite && !page.day?.completed}
              dayIds={stops.map((item) => item.gtaId)}
              onRun={onRun}
              onNote={onNote}
            />
            {crosses ? (
              <div className={styles.lunch}>
                Lunch {minutesToTime(lunchStart)}–{minutesToTime(lunchEnd)}. No reviews in this window.
              </div>
            ) : null}
          </div>
        );
      })}
      <div className={styles.stop}>
        <div className={styles.when}>{back != null ? minutesToTime(back) : ""}</div>
        <div>
          <strong>Back at office</strong>
          <div className={styles.meta}>
            {page.settings.officePostcode}
            {packed ? ` · ${Math.round(packed.returnTravel)} min drive` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
