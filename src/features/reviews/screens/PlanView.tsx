"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fitStops, routeSettings } from "../domain/plan-drive";
import { formatPlanDate, methodLabel, minutesToTime, timeToMinutes, weekdayName } from "../domain/plan-due";
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
  lockStopAction,
  recordSafeguardingAction,
  reverseSafeguardingAction,
  savePlanSettingsAction,
  setNotesAction,
  unlockDayAction,
  unlockStopAction,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trail, setTrail] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [packed, setPacked] = useState<PackedDay | null>(null);
  const [officePoint, setOfficePoint] = useState<{ lat: number; lon: number; postcode: string } | null>(null);
  const noted = page.people.filter((person) => person.notes);
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
  const title = date === page.today ? "Today’s round" : `Plan for ${formatPlanDate(date)}`;

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
              className={tab === item.id ? styles.tabOn : styles.tab}
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
          <input
            type="search"
            placeholder="e.g. Bailey or Polypipe"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <ul className={styles.list}>
          {visible.length === 0 ? (
            <li className={styles.empty}>Nobody in this list.</li>
          ) : (
            visible.map((person) => (
              <RosterCard
                key={person.gtaId}
                workspace={workspace}
                person={person}
                today={page.today}
                canWrite={page.canWrite}
                onRun={run}
              />
            ))
          )}
        </ul>
      </section>
      <section className={styles.plan} aria-labelledby="plan-title">
        <div className={styles.head}>
          <h2 id="plan-title">{title}</h2>
          <div className={styles.headActions}>
            <button type="button" className={styles.pill} aria-expanded={mapOpen} onClick={() => void showMap()}>
              {mapOpen ? "Hide map" : "Show map"}
            </button>
            <button type="button" className={styles.pill} aria-expanded={notesOpen} onClick={() => setNotesOpen((value) => !value)}>
              Notes{noted.length ? ` ${noted.length}` : ""}
            </button>
            <button type="button" className={styles.pill} onClick={() => setTrail((value) => !value)}>
              Completed reviews
            </button>
            {page.canWrite ? (
              <button type="button" className={styles.pill} onClick={() => setSettingsOpen(true)}>
                Plan settings
              </button>
            ) : (
              <p className={styles.meta}>You can view the plan. Administrator and Management can change it.</p>
            )}
          </div>
        </div>
        {notesOpen ? (
          <ul className={styles.notesMenu} aria-label="Notes still on the plan">
            {noted.length === 0 ? <li>No notes on the plan.</li> : null}
            {noted.map((person) => (
              <li key={person.gtaId}>
                <Link href={`/${workspace}/onboarding/apprentice/${person.gtaId}`}>{person.name}</Link>
                <p>{person.notes}</p>
                <p>{noteUntilLabel(person.notesUntil, page.today).label}</p>
              </li>
            ))}
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
          <p className={styles.hint}>Drag a name here to add them to this day. College day is not a visit day.</p>
          {page.day && page.day.stops.length === 0 ? (
            <p className={styles.empty}>No stops on this day yet.</p>
          ) : (
            <div className={styles.stops}>
              {page.day?.stops.map((stop, index) => (
                <StopCard
                  key={stop.gtaId}
                  workspace={workspace}
                  stop={stop}
                  index={index}
                  date={date}
                  today={page.today}
                  canWrite={page.canWrite && !page.day?.completed}
                  dayIds={page.day?.stops.map((item) => item.gtaId) ?? []}
                  onRun={run}
                />
              ))}
            </div>
          )}
          {packed ? (
            <p className={styles.meta}>
              Leave {page.settings.officePostcode} at {minutesToTime(packed.leaveMinutes)} · {packed.driveTotal ? `${Math.round(packed.driveTotal)} min driving` : "no driving yet"} · back at {minutesToTime(packed.returnArrive)}
            </p>
          ) : null}
          {mapOpen ? <PlanMap office={officePoint} stops={packed?.stops ?? []} /> : null}
          {trail || (page.day?.completedReviews.length ?? 0) > 0 ? (
            <section className={styles.trail} aria-label="Completed reviews">
              <h3>Completed reviews</h3>
              <p className={styles.meta}>
                Reviews finished on this day stay here. Earlier days stay on the calendar.
              </p>
              {page.day?.completedReviews.length ? (
                <ul>
                  {page.day.completedReviews.map((review) => (
                    <li key={review.id}>
                      <Link href={`/${workspace}/onboarding/apprentice/${review.gtaId}`}>{review.name}</Link>
                      <span>
                        {review.actualOn} · {review.method}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>No completed review on this day.</p>
              )}
            </section>
          ) : null}
        </div>
      </section>
      {settingsOpen ? (
        <SettingsDialog
          page={page}
          onClose={() => setSettingsOpen(false)}
          onSave={(input) => void run(() => savePlanSettingsAction(input))}
        />
      ) : null}
    </div>
  );
}

function RosterCard({
  workspace,
  person,
  today,
  canWrite,
  onRun,
}: {
  workspace: "administration" | "management";
  person: PlanPerson;
  today: string;
  canWrite: boolean;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className={styles.card}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.gtaId)}
      data-roster-gta={person.gtaId}
    >
      <Link href={`/${workspace}/onboarding/apprentice/${person.gtaId}`}>{person.name}</Link>
      <p>
        College {person.releaseDay}
        {person.concern ? " · Concern" : ""}
      </p>
      <p>
        {person.company} · {person.postcode}, {person.location}
      </p>
      <p className={person.dueState === "overdue" ? styles.overdue : styles.due}>{person.dueLabel}</p>
      {person.notes ? (
        <div className={styles.note}>
          <p>{person.notes}</p>
          <p>{noteUntilLabel(person.notesUntil, today).label}</p>
        </div>
      ) : null}
      {canWrite && person.reviewId ? (
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {person.notes ? "Edit note" : "Add note"}
        </button>
      ) : null}
      {open ? (
        <NoteForm
          reviewId={person.reviewId || ""}
          notes={person.notes}
          until={person.notesUntil}
          today={today}
          onRun={onRun}
        />
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
  const ready = stops.every((stop) => stop.verified || stop.locked || stop.method !== "");
  return (
    <div className={styles.dayActions}>
      {page.day?.accepted ? (
        <button type="button" onClick={() => void onRun(() => unlockDayAction({ date }))}>
          Unlock route
        </button>
      ) : (
        <button
          type="button"
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
      {page.settings.outEnabled ? (
        <a href={`/${workspace}/reviews/out`}>Open Out</a>
      ) : null}
      <a
        href={mailto(page, date)}
        onClick={(event) => {
          if (!page.day?.accepted) event.preventDefault();
        }}
      >
        Email this route
      </a>
      <button type="button" onClick={() => printRoute(page, date, packed)} disabled={!page.day?.accepted}>
        Print this route
      </button>
      <button
        type="button"
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
}: {
  workspace: "administration" | "management";
  stop: PlanStop;
  index: number;
  date: string;
  today: string;
  canWrite: boolean;
  dayIds: string[];
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
}) {
  const [open, setOpen] = useState<"book" | "note" | "lock" | null>(null);
  const [method, setMethod] = useState(stop.method || "in_person");
  const [time, setTime] = useState(stop.arrive || "10:00");
  const [holdUntil, setHoldUntil] = useState("23:45");
  return (
    <article className={styles.stop} data-stop={stop.gtaId}>
      <p className={styles.when}>
        {stop.arrive || "—"}–{stop.leave || "—"}
      </p>
      <div>
        <p className={styles.stopName}>
          <span>{index + 1}</span>
          <Link href={`/${workspace}/onboarding/apprentice/${stop.gtaId}`}>{stop.name}</Link>
        </p>
        <p>
          {stop.company}, {stop.postcode}
          {stop.contact ? ` · ${stop.contact}` : ""}
          {stop.phone ? ` · ${stop.phone}` : ""}
        </p>
        <p className={stop.dueState === "overdue" ? styles.overdue : styles.due}>{stop.dueLabel}</p>
        <p className={styles.pills}>
          {stop.completed ? <span>Review done</span> : null}
          {stop.verified ? <span>Verified</span> : null}
          {stop.locked ? <span>Locked</span> : null}
          {stop.safeguarding ? <span>Safeguarding</span> : <span>Safeguarding missing</span>}
          <span>{methodLabel(stop.method)}</span>
        </p>
        {canWrite ? (
          <div className={styles.stopActions}>
            <button
              type="button"
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
            <button type="button" onClick={() => setOpen(open === "book" ? null : "book")}>
              Rebook
            </button>
            <button type="button" onClick={() => setOpen(open === "lock" ? null : "lock")}>
              {stop.locked ? "Unlock" : "Lock"}
            </button>
            <button type="button" onClick={() => setOpen(open === "note" ? null : "note")}>
              {stop.notes ? "Edit note" : "Add note"}
            </button>
            <button
              type="button"
              onClick={() =>
                void onRun(() =>
                  stop.safeguarding && stop.signoffId
                    ? reverseSafeguardingAction({ signoffId: stop.signoffId })
                    : recordSafeguardingAction({ gtaId: stop.gtaId, date }),
                )
              }
            >
              {stop.safeguarding ? "Undo safeguarding" : "Safeguarding"}
            </button>
            <button type="button" onClick={() => void onRun(() => excludeStopAction({ date, gtaId: stop.gtaId }))}>
              Take off day
            </button>
          </div>
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
        {open === "lock" ? (
          <form
            className={styles.inline}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void onRun(() =>
                stop.locked
                  ? unlockStopAction({ gtaId: stop.gtaId })
                  : lockStopAction({
                      date,
                      gtaId: stop.gtaId,
                      arrive: stop.arrive || "10:00",
                      leave: stop.leave || "10:30",
                      until: holdUntil,
                    }),
              );
            }}
          >
            <label>
              Hold until
              <input type="time" value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} />
            </label>
            <button type="submit">{stop.locked ? "Unlock" : "Lock"}</button>
          </form>
        ) : null}
        {open === "note" && stop.reviewId ? (
          <NoteForm reviewId={stop.reviewId} notes={stop.notes} until={stop.notesUntil} today={today} onRun={onRun} />
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
            className={end === presets[preset.id] ? styles.tabOn : styles.tab}
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
      <button type="submit">Save note</button>
      {notes ? (
        <button type="button" onClick={() => void onRun(async () => (await setNotesAction({ reviewId, notes: "", until: "" })) ?? { ok: false, formError: "The note could not be saved." })}>
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
              className={iso === date ? styles.dayOn : styles.day}
              data-today={iso === today ? "true" : undefined}
              data-has-route={marks.has(iso) ? "true" : undefined}
              data-completed={completed.has(iso) ? "true" : undefined}
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

function SettingsDialog({
  page,
  onClose,
  onSave,
}: {
  page: PlanPageData;
  onClose: () => void;
  onSave: (input: {
    skipToday: boolean;
    officePostcode: string;
    startTime: string;
    callMinutes: number;
    lunchStart: string;
    lunchMinutes: number;
    returnBy: string;
    stayMinutes: number;
    extraEmails: string;
    hiddenTutorIds: string[];
    outEnabled: boolean;
  }) => void;
}) {
  const [skipToday, setSkipToday] = useState(page.settings.skipToday);
  const [officePostcode, setOffice] = useState(page.settings.officePostcode);
  const [startTime, setStart] = useState(page.settings.startTime);
  const [callMinutes, setCall] = useState(page.settings.callMinutes);
  const [lunchStart, setLunch] = useState(page.settings.lunchStart);
  const [lunchMinutes, setLunchMinutes] = useState(page.settings.lunchMinutes);
  const [returnBy, setReturn] = useState(page.settings.returnBy);
  const [stayMinutes, setStay] = useState(page.settings.stayMinutes);
  const [emails, setEmails] = useState(page.settings.extraEmails.join(", "));
  const [hidden, setHidden] = useState(page.settings.hiddenTutorIds);
  const [outEnabled, setOut] = useState(page.settings.outEnabled);
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-labelledby="plan-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            skipToday,
            officePostcode,
            startTime,
            callMinutes,
            lunchStart,
            lunchMinutes,
            returnBy,
            stayMinutes,
            extraEmails: emails,
            hiddenTutorIds: hidden,
            outEnabled,
          });
          onClose();
        }}
      >
        <h2 id="plan-settings-title">Plan settings</h2>
        <label>
          <input type="checkbox" checked={skipToday} onChange={(event) => setSkipToday(event.target.checked)} />
          Skip today
        </label>
        <label>
          Office postcode
          <input value={officePostcode} onChange={(event) => setOffice(event.target.value)} />
        </label>
        <label>
          Start time
          <input type="time" value={startTime} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          Calls before start
          <input type="number" min={0} max={60} step={5} value={callMinutes} onChange={(event) => setCall(Number(event.target.value))} />
        </label>
        <label>
          Lunch
          <input type="time" value={lunchStart} onChange={(event) => setLunch(event.target.value)} />
        </label>
        <label>
          Lunch minutes
          <input type="number" value={lunchMinutes} onChange={(event) => setLunchMinutes(Number(event.target.value))} />
        </label>
        <label>
          Back by
          <input type="time" value={returnBy} onChange={(event) => setReturn(event.target.value)} />
        </label>
        <label>
          Stay minutes
          <input type="number" min={15} max={120} step={5} value={stayMinutes} onChange={(event) => setStay(Number(event.target.value))} />
        </label>
        <label>
          Extra email addresses
          <input value={emails} onChange={(event) => setEmails(event.target.value)} />
        </label>
        <fieldset>
          <legend>Hide a tutor</legend>
          {page.tutors.map((tutor) => (
            <label key={tutor.id}>
              <input
                type="checkbox"
                checked={hidden.includes(tutor.id)}
                onChange={(event) =>
                  setHidden((current) =>
                    event.target.checked ? [...current, tutor.id] : current.filter((id) => id !== tutor.id),
                  )
                }
              />
              {tutor.name}
            </label>
          ))}
        </fieldset>
        <label>
          <input type="checkbox" checked={outEnabled} onChange={(event) => setOut(event.target.checked)} />
          Use the Out page on visit days
        </label>
        <div className={styles.dialogActions}>
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
