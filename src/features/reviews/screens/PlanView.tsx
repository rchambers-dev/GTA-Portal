"use client";

import { memo, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fitStops, routeSettings } from "../domain/plan-drive";
import { formatShortNumericDate, minutesToTime, planDateParts, timeToMinutes, weekdayName } from "../domain/plan-due";
import { NOTE_UNTIL_PRESETS, comparePlanNotes, noteUntilLabel, noteUntilPresets } from "../domain/plan-notes";
import { DEFAULT_ROUTE_EMAIL, buildRouteEmail, buildRoutePrintHtml, routeDateLabel, routeEmailAddresses, sheetStops } from "../domain/plan-route-sheet";
import { moveRouteIds, visitsAreInOrder, type PackedDay } from "../domain/plan-route";
import type { ConcernReason, PlanCounter, PlanDay, PlanPageData, PlanPerson, PlanSettings, PlanStop } from "../domain/plan-repository";
import {
  acceptDayAction,
  applyRouteAction,
  completeDayAction,
  excludeStopAction,
  lockStopAction,
  raisePlanConcernAction,
  recordPaperReturnAction,
  recordSafeguardingAction,
  resolvePlanConcernAction,
  setNotesAction,
  undoPaperReturnAction,
  unlockDayAction,
  unlockStopAction,
  verifyStopAction,
} from "./plan-actions";
import { PlanMap } from "./PlanMap";
import { RebookPanel } from "./RebookPanel";
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
  date: serverDate,
  month,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  date: string;
  month: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(serverDate);
  const [tab, setTab] = useState<PlanCounter>("to_book");
  const [dropTab, setDropTab] = useState<PlanCounter | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [hiddenStops, setHiddenStops] = useState<string[]>([]);
  const busyRef = useRef(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notePerson, setNotePerson] = useState<PlanPerson | null>(null);
  const [packed, setPacked] = useState<PackedDay | null>(null);
  const [home, setHome] = useState<{ travel: number; arrive: number } | null>(null);
  const [packedFor, setPackedFor] = useState(serverDate);
  const [officePoint, setOfficePoint] = useState<{ lat: number; lon: number; postcode: string } | null>(null);
  const routeDragId = useRef("");
  const noted = page.people
    .filter((person) => person.notes)
    .slice()
    .sort((a, b) => comparePlanNotes(a, b, page.today));
  const notesDue = noted.filter((person) => noteUntilLabel(person.notesUntil, page.today).overdue).length;
  const activeDay = planDayFor(page, selectedDate);
  const route = packedFor === selectedDate ? packed : null;
  const bookedDays = useMemo(
    () => new Set(page.monthMarks.filter((item) => item.accepted && !item.completed).map((item) => item.date)),
    [page.monthMarks],
  );
  const completedDays = useMemo(
    () => new Set(page.monthMarks.filter((item) => item.completed).map((item) => item.date)),
    [page.monthMarks],
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return page.people.filter((person) => {
      if (person.counter !== tab) return false;
      if (!term) return true;
      return [person.name, person.tutor, person.company].join(" ").toLowerCase().includes(term);
    });
  }, [page.people, query, tab]);
  const heading = planDateParts(selectedDate);
  const stopKey = activeDay.stops.map((stop) => `${stop.gtaId}:${stop.arrive}:${stop.leave}`).join("|");

  useEffect(() => {
    setSelectedDate(serverDate);
  }, [serverDate, month]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Plan · GTA Apprenticeship Portal";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
    router.prefetch(planHref(workspace, `${previousMonth}-01`, previousMonth));
    router.prefetch(planHref(workspace, `${nextMonth}-01`, nextMonth));
  }, [month, router, workspace]);

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (cancel || !activeDay.stops.length) return;
        void fitStops({
          officePostcode: page.settings.officePostcode,
          existing: activeDay.stops,
          extras: [],
          settings: routeSettings(page.settings),
          people: [],
        }).then((fitted) => {
          if (cancel) return;
          setPacked(fitted.packed);
          setHome(fitted.home);
          setPackedFor(selectedDate);
          setOfficePoint(fitted.office);
        });
      }, 0);
    });
    return () => {
      cancel = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [selectedDate, stopKey, page.settings]);

  function go(nextDate: string, nextMonth = month) {
    if (nextMonth === month) {
      flushSync(() => setSelectedDate(nextDate));
      replacePlanUrl(planHref(workspace, nextDate, nextMonth));
      return;
    }
    router.push(planHref(workspace, nextDate, nextMonth));
  }

  async function run(work: () => Promise<{ ok: boolean; formError?: string | null }>, key = "plan", held = false) {
    if (!held) {
      if (busyRef.current) return { ok: false as const, formError: "Please wait for the last change to finish." };
      busyRef.current = true;
      setBusyKey(key);
    }
    setMessage(null);
    try {
      const result = await work();
      if (!result?.ok) {
        const formError = result?.formError || "The plan could not be saved.";
        setMessage(formError);
        return { ok: false as const, formError };
      }
      if (result.formError) setMessage(result.formError);
      void router.refresh();
      return result;
    } catch {
      const formError = "The plan could not be saved.";
      setMessage(formError);
      return { ok: false as const, formError };
    } finally {
      busyRef.current = false;
      setBusyKey(null);
    }
  }

  async function placePeople(extras: PlanPerson[]) {
    if (!page.canWrite) return;
    if (activeDay.accepted) {
      setMessage("This route is already accepted. Unlock it before changing the drive times.");
      return;
    }
    const hiddenTutors = new Set(
      page.tutors.filter((tutor) => page.settings.hiddenTutorIds.includes(tutor.id)).map((tutor) => tutor.name),
    );
    const visibleExtras = extras.filter((person) => !hiddenTutors.has(person.tutor));
    if (extras.length && !visibleExtras.length) {
      setMessage("That tutor is hidden from the plan, so they are left off the round.");
      return;
    }
    const weekday = weekdayName(selectedDate);
    const allowed = visibleExtras.filter((person) => person.releaseDay !== weekday && person.method !== "phone");
    const blocked = visibleExtras.filter((person) => !allowed.includes(person));
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
      existing: activeDay.stops,
      extras: allowed,
      settings: routeSettings(page.settings),
      people: page.people,
    });
    setPacked(fitted.packed);
    setHome(fitted.home);
    setPackedFor(selectedDate);
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
        date: selectedDate,
        stops: fitted.packed.stops.map((stop) => ({ gtaId: stop.id, arrive: stop.arrive, leave: stop.leave })),
      }),
    );
    if (fitted.missing.length) setMessage(`Could not find: ${fitted.missing.join(", ")}`);
  }

  async function paperReturn(gtaId: string) {
    const person = page.people.find((item) => item.gtaId === gtaId);
    if (!person?.packId) return;
    const waitingPack = person.counter === "waiting" && (person.stage === "waiting" || person.stage === "with_tutor");
    if (!waitingPack) {
      setMessage(`${person.name} is not waiting for a review to be received.`);
      return;
    }
    const result = await run(() => recordPaperReturnAction({ packId: person.packId || "" }), `${person.gtaId}:paper`);
    if (result.ok) setMessage(`${person.name}'s review was received and is now To book.`);
  }

  async function undoPaper(gtaId: string) {
    const person = page.people.find((item) => item.gtaId === gtaId);
    if (!person?.packId || !person.paperReturn || person.stage !== "to_book" || person.appointmentOn) return;
    const result = await run(() => undoPaperReturnAction({ packId: person.packId || "" }), `${person.gtaId}:paper`);
    if (result.ok) setMessage(`${person.name}'s received review was undone.`);
  }

  async function dropPerson(gtaId: string) {
    const person = page.people.find((item) => item.gtaId === gtaId);
    if (!person) return;
    if (activeDay.stops.some((stop) => stop.gtaId === gtaId)) {
      setMessage(`${person.name} is already on this day.`);
      return;
    }
    await placePeople([person]);
  }

  async function takeOff(gtaId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    const hide = `${selectedDate}:${gtaId}`;
    setBusyKey(`${gtaId}:off`);
    setHiddenStops((current) => (current.includes(hide) ? current : [...current, hide]));
    const remaining = activeDay.stops.filter((stop) => stop.gtaId !== gtaId);
    let retimed: { gtaId: string; arrive: number; leave: number }[] = [];
    let handed = false;
    try {
    if (remaining.length) {
      const fitted = await fitStops({
        officePostcode: page.settings.officePostcode,
        existing: remaining,
        extras: [],
        settings: routeSettings(page.settings),
        people: page.people,
      });
      const kept = new Map(remaining.map((stop) => [stop.gtaId, stop]));
      const held = remaining.filter((stop) => stop.verified || stop.locked || stop.appointmentOn);
      retimed = fitted.packed.stops.flatMap((stop) => {
        const original = kept.get(stop.id);
        if (!original || original.verified || original.locked || original.appointmentOn) return [];
        const overlapsFixed = held.some((fixed) => {
          const start = fixed.arriveMinutes ?? 0;
          const end = fixed.leaveMinutes ?? 0;
          return stop.arrive < end && stop.leave > start;
        });
        if (overlapsFixed) return [];
        return [{ gtaId: stop.id, arrive: stop.arrive, leave: stop.leave }];
      });
    }
      handed = true;
      const result = await run(() => excludeStopAction({ date: selectedDate, gtaId, retimed }), `${gtaId}:off`, true);
      if (!result.ok) setHiddenStops((current) => current.filter((id) => id !== hide));
    } catch {
      setHiddenStops((current) => current.filter((id) => id !== hide));
      setMessage("The plan could not be saved.");
      if (!handed) {
        busyRef.current = false;
        setBusyKey(null);
      }
    }
  }

  async function reorderStop(targetId: string) {
    const fromId = routeDragId.current;
    routeDragId.current = "";
    if (!fromId || fromId === targetId || activeDay.completed || !page.canWrite) return;
    const ordered = [...activeDay.stops].sort(
      (a, b) => (a.arriveMinutes ?? 0) - (b.arriveMinutes ?? 0) || a.sortOrder - b.sortOrder,
    );
    const dragged = ordered.find((stop) => stop.gtaId === fromId);
    if (!dragged || dragged.appointmentOn === selectedDate) return;
    const currentIds = ordered.map((stop) => stop.gtaId);
    const nextIds = moveRouteIds(currentIds, fromId, targetId);
    if (nextIds.join(",") === currentIds.join(",")) return;
    const byId = new Map(ordered.map((stop) => [stop.gtaId, stop]));
    const nextStops = nextIds
      .map((id) => byId.get(id))
      .filter((stop): stop is PlanStop => Boolean(stop))
      .map((stop) => (stop.gtaId === fromId && stop.verified ? { ...stop, verified: false } : stop));
    const fitted = await fitStops({
      officePostcode: page.settings.officePostcode,
      existing: nextStops,
      extras: [],
      settings: routeSettings(page.settings),
      people: page.people,
    });
    const timed = new Map(fitted.packed.stops.map((stop) => [stop.id, stop]));
    const stops = nextIds.flatMap((id) => {
      const original = byId.get(id);
      if (!original) return [];
      const held =
        original.locked || original.appointmentOn === selectedDate || (original.verified && id !== fromId);
      const next = timed.get(id);
      return [{
        gtaId: id,
        arrive: held ? original.arriveMinutes ?? timeToMinutes(original.arrive) ?? 0 : next?.arrive ?? original.arriveMinutes ?? 0,
        leave: held ? original.leaveMinutes ?? timeToMinutes(original.leave) ?? 0 : next?.leave ?? original.leaveMinutes ?? 0,
      }];
    });
    const place = nextIds.indexOf(fromId) + 1;
    if (!visitsAreInOrder(stops)) {
      setMessage(`${dragged.name} does not fit there. Fixed times on this round were left as they are.`);
      return;
    }
    await run(async () => {
      const result = await applyRouteAction({ date: selectedDate, stops });
      if (result.ok) {
        setMessage(
          dragged.verified
            ? `${dragged.name} was moved to stop ${place}. Their visit time was updated to match.`
            : `${dragged.name} was moved to stop ${place}. Verified times on this round were left as they are.`,
        );
      }
      return result;
    });
  }

  async function showMap() {
    setMapOpen((value) => !value);
    if (mapOpen || !activeDay.stops.length) return;
    const fitted = await fitStops({
      officePostcode: page.settings.officePostcode,
      existing: activeDay.stops,
      extras: [],
      settings: routeSettings(page.settings),
      people: page.people,
    });
    setPacked(fitted.packed);
    setHome(fitted.home);
    setPackedFor(selectedDate);
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
              className={[
                styles.counterTile,
                tab === item.id ? (item.id === "locked" ? styles.tabLocked : styles.tabOn) : "",
                dropTab === item.id ? styles.dropOn : "",
              ].filter(Boolean).join(" ")}
              data-roster-tab={item.id}
              onClick={() => setTab(item.id)}
              onDragOver={(event) => {
                if (item.id !== "to_book" && item.id !== "waiting") return;
                event.preventDefault();
                setDropTab(item.id);
              }}
              onDragLeave={() => setDropTab((current) => (current === item.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTab(null);
                const id = event.dataTransfer.getData("text/plain");
                if (!id) return;
                if (item.id === "to_book") void paperReturn(id);
                if (item.id === "waiting") void undoPaper(id);
              }}
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
        <RosterList
          workspace={workspace}
          people={visible}
          canWrite={page.canWrite}
          reasons={page.concernReasons}
          onRun={run}
          onStatus={setMessage}
          empty={
            tab === "locked"
              ? "No one is locked waiting for a reply. Use the lock on a stop when you are waiting to hear back."
              : tab === "booked"
                ? "No one is booked yet."
                : tab === "waiting"
                  ? "No one is waiting."
                  : "No one needs booking."
          }
          onNote={setNotePerson}
        />
      </section>
      <section className={styles.plan} aria-labelledby="plan-title">
        <div className={styles.head}>
          <h2 id="plan-title" className={styles.planTitle}>
            <span className={styles.kicker}>Plan For</span>
            <span className={styles.dateLine}>
              <span className={styles.dateDay}>
                {heading.day}
                <sup>{heading.ordinal}</sup>
              </span>
              {heading.month}
            </span>
          </h2>
          <div className={styles.headActions}>
            <button type="button" className={styles.pill} aria-expanded={mapOpen} onClick={() => void showMap()}>
              {mapOpen ? "Hide map" : "Show map"}
            </button>
            <div className={styles.notes}>
              <button
                type="button"
                className={`${styles.pill} ${noted.length ? styles.notesOn : ""} ${notesDue ? styles.notesDue : ""}`}
                aria-expanded={notesOpen}
                aria-haspopup="true"
                aria-label={notesDue ? `${noted.length} note${noted.length === 1 ? "" : "s"}, ${notesDue} need checking` : `${noted.length} note${noted.length === 1 ? "" : "s"}`}
                onClick={() => setNotesOpen((value) => !value)}
              >
                <span>Notes</span>
                <strong>{noted.length}</strong>
              </button>
              {notesOpen ? (
                <div className={styles.notesMenu} aria-label="Notes still on the plan">
                  {noted.length === 0 ? <p className={styles.empty}>No notes at the moment.</p> : null}
                  {noted.map((person) => {
                    const until = noteUntilLabel(person.notesUntil, page.today);
                    return (
                      <button key={person.gtaId} type="button" className={`${styles.noteItem} ${until.overdue ? styles.noteDue : ""}`} onClick={() => { setNotesOpen(false); setNotePerson(person); }}>
                        <strong>{person.name}</strong>
                        <span>{person.notes}</span>
                        <em>{until.label}</em>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <Calendar
          month={month}
          date={selectedDate}
          today={page.today}
          booked={bookedDays}
          completed={completedDays}
          skipped={page.settings.skipToday ? page.today : null}
          onPick={(next) => go(next, next.slice(0, 7))}
          onMonth={(next) => go(selectedDate, next)}
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
          {activeDay.completed ? (
            <div className={styles.lockedDay}>
              <span className={styles.completedPill}>
                <LockIcon /> Route completed
              </span>
            </div>
          ) : (
            <div className={styles.routeBar}>
              {page.canWrite && !activeDay.accepted && selectedDate >= page.today ? (
                <button
                  type="button"
                  className={styles.fill}
                  onClick={() =>
                    void placePeople(
                      page.people.filter(
                        (person) =>
                          person.counter === "to_book" && !activeDay.stops.some((stop) => stop.gtaId === person.gtaId),
                      ),
                    )
                  }
                >
                  Fill Day
                </button>
              ) : null}
              {page.canWrite && activeDay.accepted && !activeDay.completed ? (
                <button
                  type="button"
                  className={styles.fill}
                  onClick={() =>
                    void run(() => unlockDayAction({ date: selectedDate })).then((result) => {
                      if (result.ok) setMessage("This day is unlocked. You can change the round again.");
                    })
                  }
                >
                  Unlock day
                </button>
              ) : null}
              {page.canWrite && activeDay.stops.length > 0 ? (
                <DayActions workspace={workspace} page={page} day={activeDay} date={selectedDate} packed={route} onRun={run} onStatus={setMessage} />
              ) : null}
            </div>
          )}
          {activeDay.accepted && !activeDay.completed ? (
            <p className={styles.acceptNote}>This day’s learners will not be moved if you plan the week again.</p>
          ) : null}
          <DayTimeline
            workspace={workspace}
            page={page}
            day={activeDay}
            date={selectedDate}
            packed={route}
            home={packedFor === selectedDate ? home : null}
            locked={activeDay.completed}
            onRun={run}
            onTakeOff={(gtaId) => void takeOff(gtaId)}
            onReorder={(gtaId) => void reorderStop(gtaId)}
            routeDragId={routeDragId}
            onStatus={setMessage}
            busyKey={busyKey}
            hiddenStops={hiddenStops}
            onBooked={(gtaId) => setHiddenStops((current) => (current.includes(`${selectedDate}:${gtaId}`) ? current : [...current, `${selectedDate}:${gtaId}`]))}
            onNote={(gtaId) => {
              const person = page.people.find((item) => item.gtaId === gtaId);
              if (person) setNotePerson(person);
            }}
          />
          {mapOpen ? <PlanMap office={officePoint} stops={route?.stops ?? []} /> : null}
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
                const result = await run(work, `${notePerson.gtaId}:note`);
                if (result.ok) setNotePerson(null);
                return result;
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const RosterList = memo(function RosterList({
  workspace,
  people,
  canWrite,
  reasons,
  empty,
  onNote,
  onRun,
  onStatus,
}: {
  workspace: "administration" | "management";
  people: PlanPerson[];
  canWrite: boolean;
  reasons: ConcernReason[];
  empty: string;
  onNote: (person: PlanPerson) => void;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onStatus: (message: string | null) => void;
}) {
  return (
    <ul className={styles.list}>
      {people.length === 0 ? (
        <li className={styles.empty}>{empty}</li>
      ) : (
        people.map((person) => (
          <RosterCard
            key={person.gtaId}
            workspace={workspace}
            person={person}
            canWrite={canWrite}
            reasons={reasons}
            onNote={() => onNote(person)}
            onRun={onRun}
            onStatus={onStatus}
          />
        ))
      )}
    </ul>
  );
});

function RosterCard({
  workspace,
  person,
  canWrite,
  reasons,
  onNote,
  onRun,
  onStatus,
}: {
  workspace: "administration" | "management";
  person: PlanPerson;
  canWrite: boolean;
  reasons: ConcernReason[];
  onNote: () => void;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onStatus: (message: string | null) => void;
}) {
  return (
    <li
      className={styles.card}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.gtaId)}
      data-roster-gta={person.gtaId}
    >
      <span className={styles.rowMain}>
        <Link href={`/${workspace}/onboarding/apprentice/${person.gtaId}`} title={person.name}>{person.name}</Link>
        <span className={styles.college} title={`College ${person.releaseDay}`}>College {person.releaseDay}</span>
      </span>
      <span className={styles.cardActions}>
      <DuePill person={person} />
      <ConcernChip person={person} reasons={reasons} canWrite={canWrite} onRun={onRun} onStatus={onStatus} />
      {canWrite && person.packId && person.counter === "waiting" && (person.stage === "waiting" || person.stage === "with_tutor") ? (
        <button type="button" className={styles.pill} onClick={() => void onRun(() => recordPaperReturnAction({ packId: person.packId || "" })).then((result) => {
          if (result.ok) onStatus(`${person.name}'s review was received and is now To book.`);
        })}>
          Review received
        </button>
      ) : null}
      {canWrite && person.paperReturn && person.stage === "to_book" && !person.appointmentOn ? (
        <button type="button" className={styles.pill} onClick={() => void onRun(() => undoPaperReturnAction({ packId: person.packId || "" })).then((result) => {
          if (result.ok) onStatus(`${person.name}'s received review was undone.`);
        })}>
          Undo received
        </button>
      ) : null}
      {canWrite && person.reviewId ? (
        <button type="button" className={person.notes ? styles.noteOn : styles.pill} onClick={onNote}>
          {person.notes ? "Edit note" : "Add note"}
        </button>
      ) : null}
      </span>
    </li>
  );
}

function DayActions({
  workspace,
  page,
  day,
  date,
  packed,
  onRun,
  onStatus,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  day: PlanDay;
  date: string;
  packed: PackedDay | null;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onStatus: (message: string) => void;
}) {
  const stops = day.stops;
  const ready =
    stops.length > 0 &&
    stops.every((stop) => stop.verified || stop.locked || stop.appointmentOn === date);
  return (
    <div className={styles.dayActions}>
      {page.settings.outEnabled ? (
        <a className={styles.ghost} href={`/${workspace}/reviews/out`}>Open Out</a>
      ) : null}
      {day.accepted ? (
        <button type="button" className={styles.quiet} onClick={() => emailRoute(page, day, date, packed, onStatus)}>
          Email this route
        </button>
      ) : null}
      {day.accepted ? (
        <button type="button" className={styles.quiet} onClick={() => printRoute(page, day, date, packed, onStatus)}>
          Print this route
        </button>
      ) : null}
      {day.accepted ? (
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

function printRoute(page: PlanPageData, day: PlanDay, date: string, packed: PackedDay | null, onStatus: (message: string) => void) {
  if (!day.stops.length) return;
  const popup = window.open("", "print-route");
  if (!popup) {
    onStatus("Allow pop-ups so the route can open for printing.");
    return;
  }
  popup.document.open();
  popup.document.write(buildRoutePrintHtml(page, sheetStops(day.stops, packed), date, packed));
  popup.document.close();
  popup.focus();
  try {
    popup.print();
  } catch {
    onStatus("Could not open the print dialog.");
    return;
  }
  onStatus(`Print ${routeDateLabel(date)} from the print window.`);
}

function emailRoute(page: PlanPageData, day: PlanDay, date: string, packed: PackedDay | null, onStatus: (message: string) => void) {
  if (!day.stops.length) return;
  const email = buildRouteEmail(page, sheetStops(day.stops, packed), date, packed);
  const extras = routeEmailAddresses(page.settings.extraEmails).slice(1);
  window.location.href = email.href;
  onStatus(
    extras.length === 0
      ? `Opened an email to ${DEFAULT_ROUTE_EMAIL} with this day’s Google Maps route.`
      : extras.length === 1
        ? `Opened an email to ${DEFAULT_ROUTE_EMAIL} and ${extras[0]} with this day’s Google Maps route.`
        : `Opened an email to ${DEFAULT_ROUTE_EMAIL} and ${extras.length} extra addresses with this day’s Google Maps route.`,
  );
}

function StopCard({
  workspace,
  stop,
  index,
  date,
  today,
  settings,
  days,
  people,
  reasons,
  loadedMonth,
  canWrite,
  canDrag,
  dayIds,
  dayAccepted,
  onRun,
  onTakeOff,
  onReorder,
  routeDragId,
  onStatus,
  onNote,
  onBooked,
  busyKey,
}: {
  workspace: "administration" | "management";
  stop: PlanStop;
  index: number;
  date: string;
  today: string;
  settings: PlanSettings;
  days: PlanDay[];
  people: PlanPerson[];
  reasons: ConcernReason[];
  loadedMonth: string;
  canWrite: boolean;
  canDrag: boolean;
  dayAccepted: boolean;
  dayIds: string[];
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onTakeOff: (gtaId: string) => void;
  onReorder: (gtaId: string) => void;
  routeDragId: { current: string };
  onStatus: (message: string) => void;
  onNote: (gtaId: string) => void;
  onBooked: (gtaId: string) => void;
  busyKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<"book" | "note" | "lock" | null>(null);
  const [bookMethod, setBookMethod] = useState("in_person");
  const [verified, setVerified] = useState(stop.verified);
  const [locked, setLocked] = useState(stop.locked);
  useEffect(() => {
    setVerified(stop.verified);
    setLocked(stop.locked);
  }, [stop.verified, stop.locked]);
  const mine = busyKey?.startsWith(stop.gtaId) ?? false;
  const held = Boolean(busyKey);
  const phoneDigits = stop.phone.replace(/\D/g, "");
  const priority = stop.dueState === "overdue" ? styles.tagOver : stop.dueState === "due-soon" ? styles.tagSoon : styles.tagOk;
  const bookedOnDay = stop.appointmentOn === date;
  return (
    <article
      className={`${styles.stop} ${styles.planCard} ${expanded ? "" : styles.closed}`}
      data-stop={stop.gtaId}
      data-route-booked={bookedOnDay ? "true" : "false"}
      onClick={() => setExpanded((value) => !value)}
      onDragOver={(event) => {
        if (!routeDragId.current || routeDragId.current === stop.gtaId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        event.currentTarget.classList.add(styles.dragOver);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          event.currentTarget.classList.remove(styles.dragOver);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.currentTarget.classList.remove(styles.dragOver, styles.dragging);
        const from = event.dataTransfer.getData("text/plain");
        if (from) routeDragId.current = from;
        onReorder(stop.gtaId);
      }}
    >
      <p className={styles.when}>
        <span className={styles.arrive}>{minutesToTime(stop.arriveMinutes) || "—"}</span>
        <span className={styles.until}>–{minutesToTime(stop.leaveMinutes) || "—"}</span>
      </p>
      <div className={styles.stopBody}>
        <div className={styles.stopHead}>
          <p className={styles.stopName}>
            {canDrag ? (
              <button
                type="button"
                className={styles.handle}
                draggable
                aria-label={`Move ${stop.name} earlier or later in this route`}
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  if (bookedOnDay) {
                    event.preventDefault();
                    return;
                  }
                  event.stopPropagation();
                  routeDragId.current = stop.gtaId;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", stop.gtaId);
                  const card = event.currentTarget.closest("article");
                  if (card) {
                    event.dataTransfer.setDragImage(card, 24, 24);
                    card.classList.add(styles.dragging);
                  }
                }}
                onDragEnd={(event) => {
                  event.currentTarget.closest("article")?.classList.remove(styles.dragging);
                }}
              >
                <svg viewBox="0 0 12 16" aria-hidden="true">
                  <circle cx="4" cy="3" r="1.35" />
                  <circle cx="8" cy="3" r="1.35" />
                  <circle cx="4" cy="8" r="1.35" />
                  <circle cx="8" cy="8" r="1.35" />
                  <circle cx="4" cy="13" r="1.35" />
                  <circle cx="8" cy="13" r="1.35" />
                </svg>
              </button>
            ) : null}
            <span className={styles.stopNum}>{index + 1}</span>
            <Link href={`/${workspace}/onboarding/apprentice/${stop.gtaId}`} onClick={(event) => event.stopPropagation()}>
              {stop.name}
            </Link>
          </p>
          <p className={styles.pills}>
            <span className={`${styles.tag} ${priority}`}>{stop.dueState === "ok" ? "On track" : stop.dueLabel}</span>
            {stop.safeguarding ? (
              <span className={styles.safeOn}>Safeguarding signed</span>
            ) : (
              <button
                type="button"
                className={styles.safeOff}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canWrite) return;
                  void onRun(() => recordSafeguardingAction({ gtaId: stop.gtaId, date }));
                }}
              >
                Safeguarding
              </button>
            )}
            {stop.completed ? <span className={styles.tagDone}>Review done</span> : null}
            {!stop.completed && verified ? <span className={styles.tagDone}>Verified</span> : null}
            {bookedOnDay ? <span className={styles.tagDone}>Booked time</span> : null}
            {locked ? <span className={styles.tagLock}>{stop.lockLabel || "Locked"}</span> : null}
            {people.find((person) => person.gtaId === stop.gtaId) ? (
              <ConcernChip
                person={people.find((person) => person.gtaId === stop.gtaId)!}
                reasons={reasons}
                canWrite={canWrite}
                onRun={onRun}
                onStatus={onStatus}
              />
            ) : null}
          </p>
        </div>
        <span className={styles.contactLine}>
          {stop.contact || stop.phone ? (
            <>
              {stop.contact ? <strong>{stop.contact}</strong> : null}
              {stop.phone ? (
                <>
                  {stop.contact ? " · " : ""}
                  <a href={`tel:${phoneDigits}`} onClick={(event) => event.stopPropagation()}>{stop.phone}</a>
                </>
              ) : null}
            </>
          ) : (
            "No contact saved"
          )}
        </span>
        {canWrite && !stop.completed ? (
          <div className={styles.stopExtra} onClick={(event) => event.stopPropagation()}>
            <div className={styles.stopExtraInner}>
            <p className={styles.placeLine}>
              {stop.company} · {stop.postcode} · tutor {stop.tutor} · college {stop.releaseDay}
              {stop.kind === "phone" ? " · 20 minutes from the office · no driving" : ""}
            </p>
            <div className={styles.actionGrid}>
            {bookedOnDay ? null : (
            <button
              type="button"
              className={[verified ? styles.actionGhost : styles.actionPrimary, mine && busyKey?.endsWith(":verify") ? styles.pending : ""].filter(Boolean).join(" ")}
              disabled={held}
              aria-busy={mine && busyKey?.endsWith(":verify")}
              onClick={() => {
                if (!verified && (stop.arriveMinutes == null || stop.leaveMinutes == null)) {
                  onStatus("This visit has no time yet, so it can't be verified.");
                  return;
                }
                const next = !verified;
                setVerified(next);
                void onRun(() =>
                  verifyStopAction({
                    date,
                    gtaId: stop.gtaId,
                    verified: next,
                    arrive: stop.arrive,
                    leave: stop.leave,
                    dayGtaIds: dayIds,
                  }),
                `${stop.gtaId}:verify`).then((result) => {
                  if (!result.ok) setVerified(!next);
                });
              }}
            >
              {mine && busyKey?.endsWith(":verify") ? "Saving…" : verified ? "Undo verify" : "Verify"}
            </button>
            )}
            <button type="button" className={styles.actionBlue} disabled={held} aria-expanded={open === "book" && bookMethod === "in_person"} onClick={() => { setBookMethod("in_person"); setOpen(open === "book" && bookMethod === "in_person" ? null : "book"); }}>
              Rebook
            </button>
            {!dayAccepted && !verified && !bookedOnDay ? (
              <button
                type="button"
                className={[locked ? styles.actionLockOn : styles.actionLock, mine && busyKey?.endsWith(":lock") ? styles.pending : ""].filter(Boolean).join(" ")}
                aria-pressed={locked}
                disabled={held}
                aria-busy={mine && busyKey?.endsWith(":lock")}
                onClick={() => {
                  const next = !locked;
                  setLocked(next);
                  void onRun(async () => {
                    const result = locked
                      ? await unlockStopAction({ gtaId: stop.gtaId })
                      : await lockStopAction({
                          date,
                          gtaId: stop.gtaId,
                          arrive: stop.arrive || "10:00",
                          leave: stop.leave || "10:30",
                          until: "23:45",
                        });
                    if (result.ok) {
                      onStatus(
                        locked
                          ? `${stop.name} is unlocked. Fill day selected can move that slot if needed.`
                          : `${stop.name} is locked until 10:00 London time tomorrow. After that they go back to To book.`,
                      );
                    }
                    return result;
                  }, `${stop.gtaId}:lock`).then((result) => {
                    if (!result.ok) setLocked(!next);
                  });
                }}
              >
                {mine && busyKey?.endsWith(":lock") ? "Saving…" : locked ? "Unlock" : "Lock"}
              </button>
            ) : null}
            <button type="button" className={styles.actionBlue} disabled={held} onClick={() => { setBookMethod("phone"); setOpen(open === "book" && bookMethod === "phone" ? null : "book"); }}>
              Phone review
            </button>
            <button type="button" className={stop.notes ? `${styles.actionGrey} ${styles.actionGreyOn}` : styles.actionGrey} disabled={held} onClick={() => onNote(stop.gtaId)}>
              {stop.notes ? "Edit note" : "Add note"}
            </button>
            <Link className={styles.actionBlue} href={`/${workspace}/onboarding/apprentice/${stop.gtaId}`} onClick={(event) => event.stopPropagation()}>
              Edit details
            </Link>
            {dayAccepted ? null : (
            <button type="button" className={[styles.actionDanger, mine && busyKey?.endsWith(":off") ? styles.pending : ""].filter(Boolean).join(" ")} disabled={held} aria-busy={mine && busyKey?.endsWith(":off")} onClick={() => onTakeOff(stop.gtaId)}>
              {mine && busyKey?.endsWith(":off") ? "Taking off…" : "Take off this round"}
            </button>
            )}
            </div>
            {stop.notes ? (
              <p className={styles.noteBox}>
                <span>{stop.notes}</span>
                {stop.notesUntil ? <span className={styles.noteUntil}>{noteUntilLabel(stop.notesUntil, today).label}</span> : null}
              </p>
            ) : null}
        {open === "book" && stop.reviewId ? (
          <RebookPanel
            key={bookMethod}
            stop={stop}
            missedDate={date}
            today={today}
            settings={settings}
            days={days}
            people={people}
            loadedMonth={loadedMonth}
            initialMethod={bookMethod}
            onRun={onRun}
            onSaved={(text) => {
              onStatus(text);
              setOpen(null);
              onBooked(stop.gtaId);
            }}
          />
        ) : null}
            </div>
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
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
}) {
  const presets = noteUntilPresets(today);
  const [text, setText] = useState(notes);
  const [end, setEnd] = useState(dateOnly(until) || presets.week);
  const [saving, setSaving] = useState(false);
  const selected = dateOnly(end);
  return (
    <form
      className={styles.inline}
      onSubmit={(event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        void onRun(async () => (await setNotesAction({ reviewId, notes: text, until: text.trim() ? end : "" })) ?? { ok: false, formError: "The note could not be saved." }).finally(() => setSaving(false));
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
            aria-pressed={selected === presets[preset.id]}
            className={selected === presets[preset.id] ? styles.noteOn : styles.pill}
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
      <button type="submit" className={saving ? `${styles.noteOn} ${styles.pending}` : styles.noteOn} disabled={saving} aria-busy={saving}>{saving ? "Saving…" : "Save note"}</button>
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
  booked,
  completed,
  skipped,
  onPick,
  onMonth,
}: {
  month: string;
  date: string;
  today: string;
  booked: Set<string>;
  completed: Set<string>;
  skipped: string | null;
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
                iso === today && iso !== date ? styles.dayToday : "",
                completed.has(iso) ? styles.dayDone : booked.has(iso) ? styles.dayBooked : "",
                iso === skipped ? styles.daySkipped : "",
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

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function ConcernChip({
  person,
  reasons,
  canWrite,
  onRun,
  onStatus,
}: {
  person: PlanPerson;
  reasons: ConcernReason[];
  canWrite: boolean;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onStatus: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const label = person.concern ? "Concern · 5 weeks" : "Concern";
  if (!canWrite && !person.concern) return null;
  if (!canWrite) return <span className={styles.concernOn}>{label}</span>;
  return (
    <span className={styles.concernWrap} onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={person.concern ? styles.concernOn : styles.concernOff}
        aria-pressed={person.concern}
        aria-expanded={open}
        draggable={false}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        {label}
      </button>
      {open ? (
        <form
          className={styles.concernPanel}
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (person.concern && person.concernId) {
              void onRun(
                () => resolvePlanConcernAction({ concernId: person.concernId || "", note }),
                `${person.gtaId}:concern`,
              ).then((result) => {
                if (!result.ok) return;
                onStatus(`${person.name} is back on the 10-week schedule.`);
                setNote("");
                setOpen(false);
              });
              return;
            }
            void onRun(
              () => raisePlanConcernAction({ gtaId: person.gtaId, reasonId, note }),
              `${person.gtaId}:concern`,
            ).then((result) => {
              if (!result.ok) return;
              onStatus(`${person.name} is on a 5-week concern schedule.`);
              setNote("");
              setReasonId("");
              setOpen(false);
            });
          }}
        >
          {person.concern ? (
            <>
              <p>Clear this concern. The next review goes back to 10 weeks, unless a visit is already booked.</p>
              <label>
                Resolution note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
              </label>
              <div className={styles.concernActions}>
                <button type="submit">Clear concern</button>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <label>
                Reason
                <select value={reasonId} required onChange={(event) => setReasonId(event.target.value)}>
                  <option value="">Choose a reason</option>
                  {reasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>{reason.label}</option>
                  ))}
                </select>
              </label>
              {reasons.length === 0 ? <p>No concern reasons are available.</p> : null}
              <label>
                Note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
              </label>
              <div className={styles.concernActions}>
                <button type="submit" disabled={!reasonId}>Flag concern</button>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </>
          )}
        </form>
      ) : null}
    </span>
  );
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
  day,
  date,
  packed,
  home,
  locked,
  onRun,
  onTakeOff,
  onReorder,
  routeDragId,
  onStatus,
  onNote,
  onBooked,
  busyKey,
  hiddenStops,
}: {
  workspace: "administration" | "management";
  page: PlanPageData;
  day: PlanDay;
  date: string;
  packed: PackedDay | null;
  home: { travel: number; arrive: number } | null;
  locked: boolean;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>, key?: string) => Promise<{ ok: boolean; formError?: string | null }>;
  onTakeOff: (gtaId: string) => void;
  onReorder: (gtaId: string) => void;
  routeDragId: { current: string };
  onStatus: (message: string) => void;
  onNote: (gtaId: string) => void;
  onBooked: (gtaId: string) => void;
  busyKey: string | null;
  hiddenStops: string[];
}) {
  const stops = [...day.stops].filter((stop) => !hiddenStops.includes(`${date}:${stop.gtaId}`)).sort(
    (a, b) => (a.arriveMinutes ?? Number.MAX_SAFE_INTEGER) - (b.arriveMinutes ?? Number.MAX_SAFE_INTEGER) || a.sortOrder - b.sortOrder,
  );
  const lunchStart = timeToMinutes(page.settings.lunchStart) ?? 12 * 60 + 30;
  const lunchEnd = lunchStart + page.settings.lunchMinutes;
  const leave = packed?.leaveMinutes ?? timeToMinutes(page.settings.startTime) ?? 10 * 60;
  const back = home?.arrive ?? packed?.returnArrive;
  const backTravel = home?.travel ?? packed?.returnTravel;
  if (!stops.length) {
    const passed = date < page.today;
    const skipped = date === page.today && page.settings.skipToday;
    const label = weekdayName(date);
    return (
      <p className={styles.empty}>
        {day.completed
          ? "This route is completed."
          : passed
            ? `${label} has already passed. Reviews are planned from today onwards.`
            : skipped
              ? `Skipping ${label} so you can book tomorrow. Uncheck “Skip today” if you need a round today.`
              : `No visits on ${label}. Either everyone is in college, or they already fit on remaining days.`}
      </p>
    );
  }
  const callStart = timeToMinutes(page.settings.startTime) ?? leave;
  const callEnd = callStart + page.settings.callMinutes;
  return (
    <div className={locked ? styles.lockedPanel : styles.timeline}>
      {locked ? <p className={styles.lockNote}>This day is locked. The visits can’t be changed.</p> : null}
      {day.droppedUnverified ? (
        <p className={styles.lockNote}>
          The {page.settings.callMinutes}-minute call window ended. Anyone not verified has been moved off this round.
        </p>
      ) : null}
      {page.settings.callMinutes > 0 && stops.some((stop) => stop.kind !== "phone") ? (
        <div className={styles.stop}>
          <div className={styles.when}>{minutesToTime(callStart)}–{minutesToTime(callEnd)}</div>
          <div>
            <strong>Confirmation calls</strong>
            <div className={styles.meta}>{page.settings.officePostcode} · {page.settings.callMinutes} minutes for anyone not yet verified. Then set off at {minutesToTime(leave)}.</div>
          </div>
        </div>
      ) : null}
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
              settings={page.settings}
              days={page.days}
              people={page.people}
              reasons={page.concernReasons}
              loadedMonth={date.slice(0, 7)}
              canWrite={page.canWrite && !day.completed}
              canDrag={page.canWrite && !day.completed && stops.length > 1 && stop.appointmentOn !== date}
              dayAccepted={day.accepted}
              dayIds={stops.map((item) => item.gtaId)}
              onRun={onRun}
              onTakeOff={onTakeOff}
              onReorder={onReorder}
              routeDragId={routeDragId}
              onStatus={onStatus}
              onNote={onNote}
              onBooked={onBooked}
              busyKey={busyKey}
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
            {backTravel != null ? ` · ${Math.round(backTravel)} min drive` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function planHref(workspace: "administration" | "management", date: string, month: string) {
  return `/${workspace}/reviews/plan?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}`;
}

function replacePlanUrl(url: string) {
  const current = window.history.state;
  const state = current && typeof current === "object" ? current : { __NA: true };
  History.prototype.replaceState.call(window.history, state, "", url);
}

function planDayFor(page: PlanPageData, date: string): PlanDay {
  return (
    page.days.find((item) => item.date === date) ??
    (page.day?.date === date ? page.day : null) ?? {
      date,
      accepted: false,
      completed: false,
      stops: [],
      completedReviews: [],
      droppedUnverified: 0,
    }
  );
}
