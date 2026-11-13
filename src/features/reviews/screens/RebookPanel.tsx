"use client";

import { useEffect, useMemo, useState } from "react";
import { drivingMatrix, geocodePostcodes, normalisePostcode } from "../domain/geo";
import { minutesToTime, timeToMinutes, weekdayName } from "../domain/plan-due";
import type { PlanDay, PlanPerson, PlanSettings, PlanStop, RebookMonthDay } from "../domain/plan-repository";
import { fittingArrivals, rebookDayChoice, rebookWindowEnd } from "../domain/rebook-slots";
import { loadRebookMonthAction, rebookAppointmentAction } from "./plan-actions";
import styles from "./plan.module.css";

type DayMark = {
  date: string;
  accepted: boolean;
  completed: boolean;
  stops: { gtaId: string; name: string; postcode: string; arriveMinutes: number | null; leaveMinutes: number | null }[];
};

function usablePostcode(postcode: string): string {
  const value = postcode.trim();
  if (!value || value.toLowerCase() === "no postcode") return "";
  return value;
}

function marksFromPlan(days: PlanDay[]): DayMark[] {
  return days.map((day) => ({
    date: day.date,
    accepted: day.accepted,
    completed: day.completed,
    stops: day.stops.map((stop) => ({
      gtaId: stop.gtaId,
      name: stop.name,
      postcode: stop.postcode,
      arriveMinutes: stop.arriveMinutes,
      leaveMinutes: stop.leaveMinutes,
    })),
  }));
}

function marksFromMonth(days: RebookMonthDay[], people: PlanPerson[]): DayMark[] {
  const byId = new Map(people.map((person) => [person.gtaId, person]));
  return days.map((day) => ({
    date: day.date,
    accepted: day.accepted,
    completed: day.completed,
    stops: day.stops.map((stop) => {
      const person = byId.get(stop.gtaId);
      return {
        gtaId: stop.gtaId,
        name: person?.name || stop.gtaId,
        postcode: person?.postcode || "",
        arriveMinutes: stop.arriveMinutes,
        leaveMinutes: stop.leaveMinutes,
      };
    }),
  }));
}

const OFFICE = "office";

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return next.toISOString().slice(0, 7);
}

function weekdayCells(month: string): (string | null)[] {
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
  return cells;
}

export function RebookPanel({
  stop,
  missedDate,
  today,
  settings,
  days,
  people,
  loadedMonth,
  initialMethod,
  onRun,
}: {
  stop: PlanStop;
  missedDate: string;
  today: string;
  settings: PlanSettings;
  days: PlanDay[];
  people: PlanPerson[];
  loadedMonth: string;
  initialMethod: string;
  onRun: (work: () => Promise<{ ok: boolean; formError?: string | null }>) => Promise<void>;
}) {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [chosen, setChosen] = useState("");
  const [minute, setMinute] = useState<number | null>(null);
  const [method, setMethod] = useState(initialMethod === "teams" || initialMethod === "phone" ? initialMethod : "in_person");
  const [slots, setSlots] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<Record<string, DayMark[]>>({});
  const [monthError, setMonthError] = useState<string | null>(null);
  const windowEnd = rebookWindowEnd(today);
  const loadedMarks = useMemo(() => marksFromPlan(days), [days]);
  const monthPending = month !== loadedMonth && !fetched[month];
  const marks = useMemo(() => {
    const source = month === loadedMonth ? loadedMarks : (fetched[month] ?? []);
    return new Map(source.map((day) => [day.date, day]));
  }, [fetched, loadedMarks, loadedMonth, month]);

  useEffect(() => {
    if (month === loadedMonth || fetched[month]) return;
    let cancel = false;
    setMonthError(null);
    void loadRebookMonthAction(month).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setMonthError(result.formError);
        return;
      }
      setFetched((current) => ({ ...current, [month]: marksFromMonth(result.days, people) }));
    });
    return () => {
      cancel = true;
    };
  }, [fetched, loadedMonth, month, people]);
  const cells = weekdayCells(month);
  const atStart = month <= today.slice(0, 7);
  const atEnd = month >= windowEnd.slice(0, 7);

  function choiceFor(date: string) {
    const day = marks.get(date);
    return rebookDayChoice({
      date,
      today,
      missedDate,
      releaseDay: stop.releaseDay,
      nowMinutes,
      skipToday: settings.skipToday,
      returnBy: timeToMinutes(settings.returnBy) ?? 16 * 60 + 45,
      accepted: Boolean(day?.accepted),
      completed: Boolean(day?.completed),
    });
  }

  async function pickDay(date: string, methodOverride = method) {
    const choice = choiceFor(date);
    if (!choice.bookable || monthPending) return;
    setChosen(date);
    setMinute(null);
    setSlots([]);
    setSlotError(null);
    if (methodOverride === "phone") return;
    setChecking(true);
    try {
      const existing = (marks.get(date)?.stops ?? []).filter((item) => item.gtaId !== stop.gtaId && item.arriveMinutes != null);
      const unlocated = existing.filter((item) => !usablePostcode(item.postcode));
      if (unlocated.length) {
        setSlotError(`${unlocated[0].name} has no postcode, so the drive cannot be checked.`);
        return;
      }
      const postcodes = [settings.officePostcode, stop.postcode, ...existing.map((item) => usablePostcode(item.postcode))];
      const geo = await geocodePostcodes(postcodes);
      const office = geo[normalisePostcode(settings.officePostcode)];
      const learnerPoint = geo[normalisePostcode(stop.postcode)];
      if (!office || !learnerPoint) {
        setSlotError("Could not find a postcode for that drive.");
        return;
      }
      const located = existing.filter((item) => geo[normalisePostcode(usablePostcode(item.postcode))]);
      const points = [office, ...located.map((item) => geo[normalisePostcode(usablePostcode(item.postcode))]), learnerPoint];
      const matrix = await drivingMatrix(points);
      const ids = [OFFICE, ...located.map((item) => item.gtaId), stop.gtaId];
      const drive = (fromId: string, toId: string) => {
        const from = ids.indexOf(fromId);
        const to = ids.indexOf(toId);
        const seconds = matrix.durations?.[from]?.[to];
        if (from < 0 || to < 0 || seconds == null || Number.isNaN(seconds)) return null;
        return seconds / 60;
      };
      const start = timeToMinutes(settings.startTime) ?? 10 * 60;
      const lunchStart = timeToMinutes(settings.lunchStart) ?? 12 * 60 + 30;
      const lunchEnd = lunchStart + settings.lunchMinutes;
      const returnBy = timeToMinutes(settings.returnBy) ?? 16 * 60 + 45;
      const earliest = date === today ? Math.max(start, nowMinutes) : start;
      const next = fittingArrivals({
        learnerId: stop.gtaId,
        officeId: OFFICE,
        clock: {
          startMinutes: start,
          lunchStart,
          lunchEnd,
          returnBy,
          stayMinutes: settings.stayMinutes,
          earliestLeave: earliest,
        },
        existing: located.map((item) => ({
          id: item.gtaId,
          arrive: item.arriveMinutes ?? start,
          leave: item.leaveMinutes ?? (item.arriveMinutes ?? start) + settings.stayMinutes,
        })),
        driveMinutes: drive,
      });
      setSlots(next);
      if (!next.length) setSlotError(`No arrival on this day fits the drive and a return by ${settings.returnBy}.`);
    } catch {
      setSlotError("Could not check the drive for that day.");
    } finally {
      setChecking(false);
    }
  }

  const when = chosen ? `${weekdayName(chosen)} ${Number(chosen.slice(8))}` : "";

  return (
    <form
      className={styles.rebook}
      aria-labelledby={`rebook-title-${stop.gtaId}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!chosen || !stop.reviewId) return;
        if (method !== "phone" && minute == null) return;
        const stay = settings.stayMinutes || 30;
        const others = (marks.get(chosen)?.stops ?? []).filter((item) => item.gtaId !== stop.gtaId);
        const ordered = method === "phone"
          ? []
          : [...others.map((item) => ({ id: item.gtaId, arrive: item.arriveMinutes ?? 24 * 60 })), { id: stop.gtaId, arrive: minute ?? 0 }]
              .sort((a, b) => a.arrive - b.arrive)
              .map((item) => item.id);
        void onRun(() =>
          rebookAppointmentAction({
            reviewId: stop.reviewId || "",
            gtaId: stop.gtaId,
            missedDate,
            date: chosen,
            method,
            arriveMinutes: method === "phone" ? null : minute,
            leaveMinutes: method === "phone" || minute == null ? null : minute + stay,
            orderedGtaIds: ordered,
            backToQueue: false,
          }),
        );
      }}
    >
      <h3 id={`rebook-title-${stop.gtaId}`} className={styles.srOnly}>Rebook {stop.name}</h3>
      <label className={styles.rebookMethod}>
        Booking method
        <select value={method} onChange={(event) => {
          const next = event.target.value;
          setMethod(next);
          setMinute(null);
          setSlots([]);
          setSlotError(null);
          if (chosen && next !== "phone") void pickDay(chosen, next);
        }}>
          <option value="in_person">In person</option>
          <option value="teams">Teams</option>
          <option value="phone">Phone call</option>
        </select>
      </label>
      <div className={styles.rebookMonth}>
        <button type="button" className={styles.rebookNav} aria-label="Previous month" disabled={atStart} onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className={styles.rebookNav} aria-label="Next month" disabled={atEnd} onClick={() => setMonth(shiftMonth(month, 1))}>
          ›
        </button>
      </div>
      <div className={styles.rebookCal}>
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((label) => (
          <span key={label} className={styles.rebookDow}>{label}</span>
        ))}
        {cells.map((iso, index) => {
          if (!iso) return <span key={`gap-${index}`} className={styles.rebookEmpty} />;
          const choice = choiceFor(iso);
          const selected = iso === chosen && choice.bookable;
          return (
            <button
              key={iso}
              type="button"
              className={[styles.rebookDay, selected ? styles.rebookOn : "", choice.struck ? styles.rebookStruck : "", (!choice.bookable || monthPending) && !choice.struck ? styles.rebookMuted : ""].filter(Boolean).join(" ")}
              aria-pressed={selected}
              aria-disabled={!choice.bookable || monthPending}
              disabled={!choice.bookable || monthPending}
              onClick={() => void pickDay(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      {method === "phone" ? <p className={styles.rebookHint}>{when ? `${when} phone review. No drive time.` : "Pick a weekday for the phone review."}</p> : null}
      <p className={slotError || monthError ? styles.rebookBlocked : styles.srOnly} role="status">
        {monthError || slotError || (checking ? `Checking the drive and whether you are back by ${settings.returnBy}…` : when ? `${when} is selected. Tap a time that fits.` : "Pick a working day.")}
      </p>
      {method !== "phone" && slots.length ? (
        <div className={styles.rebookSlots}>
          {slots.map((value) => (
            <button
              key={value}
              type="button"
              className={value === minute ? styles.rebookSlotOn : styles.rebookSlot}
              aria-pressed={value === minute}
              onClick={() => setMinute(value)}
            >
              {minutesToTime(value)}
            </button>
          ))}
        </div>
      ) : null}
      <button type="submit" className={styles.rebookBook} disabled={!chosen || (method !== "phone" && minute == null) || checking || monthPending}>
        Book Appointment
      </button>
      <button
        type="button"
        className={styles.rebookQueue}
        onClick={() => {
          if (!stop.reviewId) return;
          void onRun(() =>
            rebookAppointmentAction({
              reviewId: stop.reviewId || "",
              gtaId: stop.gtaId,
              missedDate,
              date: null,
              method: "in_person",
              arriveMinutes: null,
              leaveMinutes: null,
              orderedGtaIds: [],
              backToQueue: true,
            }),
          );
        }}
      >
        Back To Queue
      </button>
    </form>
  );
}
