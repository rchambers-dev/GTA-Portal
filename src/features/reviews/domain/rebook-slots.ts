import { addDays, weekdayName } from "./plan-due";
import { addTravel } from "./plan-route";

export const REBOOK_WINDOW_WEEKS = 10;

export type RebookClock = {
  startMinutes: number;
  lunchStart: number;
  lunchEnd: number;
  returnBy: number;
  stayMinutes: number;
  earliestLeave: number;
};

export type RebookVisit = {
  id: string;
  arrive: number;
  leave: number;
};

export type RebookDayChoice = {
  bookable: boolean;
  struck: boolean;
};

function sameDay(releaseDay: string, date: string): boolean {
  const release = releaseDay.trim().toLowerCase();
  const weekday = weekdayName(date).toLowerCase();
  return Boolean(release && weekday && release === weekday);
}

export function rebookWindowEnd(today: string): string {
  return addDays(today, REBOOK_WINDOW_WEEKS * 7);
}

export function rebookDayChoice(input: {
  date: string;
  today: string;
  missedDate: string;
  releaseDay: string;
  nowMinutes: number;
  skipToday: boolean;
  returnBy: number;
  accepted: boolean;
  completed: boolean;
}): RebookDayChoice {
  const { date, today } = input;
  if (date === input.missedDate) return { bookable: false, struck: false };
  if (date < today) return { bookable: false, struck: false };
  const struck = sameDay(input.releaseDay, date);
  if (struck) return { bookable: false, struck: true };
  if (input.completed || input.accepted) return { bookable: false, struck: false };
  if (date === today && input.skipToday) return { bookable: false, struck: false };
  if (date === today && input.nowMinutes >= input.returnBy) return { bookable: false, struck: false };
  if (date > rebookWindowEnd(today)) return { bookable: false, struck: false };
  return { bookable: true, struck: false };
}

function overlaps(arrive: number, leave: number, visit: RebookVisit): boolean {
  return arrive < visit.leave && leave > visit.arrive;
}

function overlapsLunch(arrive: number, leave: number, clock: RebookClock): boolean {
  return arrive < clock.lunchEnd && leave > clock.lunchStart;
}

export function arrivalFits(input: {
  arrive: number;
  learnerId: string;
  officeId: string;
  clock: RebookClock;
  existing: RebookVisit[];
  driveMinutes: (fromId: string, toId: string) => number | null;
}): boolean {
  const { arrive, clock, learnerId, officeId } = input;
  const stay = clock.stayMinutes || 30;
  const leave = arrive + stay;
  if (!Number.isFinite(arrive) || arrive < clock.startMinutes || leave > clock.returnBy) return false;
  if (overlapsLunch(arrive, leave, clock)) return false;
  const stops = [...input.existing].sort((a, b) => a.arrive - b.arrive || a.leave - b.leave);
  if (stops.some((stop) => overlaps(arrive, leave, stop))) return false;
  const previous = [...stops].reverse().find((stop) => stop.leave <= arrive);
  const next = stops.find((stop) => stop.arrive >= leave);
  if (previous) {
    const minutes = input.driveMinutes(previous.id, learnerId);
    if (minutes == null) return false;
    if (addTravel(previous.leave, minutes, clock.lunchStart, clock.lunchEnd) > arrive + 0.5) return false;
  } else {
    const minutes = input.driveMinutes(officeId, learnerId);
    if (minutes == null) return false;
    if (addTravel(clock.earliestLeave, minutes, clock.lunchStart, clock.lunchEnd) > arrive + 0.5) return false;
  }
  if (next) {
    const minutes = input.driveMinutes(learnerId, next.id);
    if (minutes == null) return false;
    if (addTravel(leave, minutes, clock.lunchStart, clock.lunchEnd) > next.arrive + 0.5) return false;
  }
  const home = input.driveMinutes(learnerId, officeId);
  if (home == null) return false;
  if (addTravel(leave, home, clock.lunchStart, clock.lunchEnd) > clock.returnBy + 0.5) return false;
  return true;
}

export function fittingArrivals(input: {
  learnerId: string;
  officeId: string;
  clock: RebookClock;
  existing: RebookVisit[];
  driveMinutes: (fromId: string, toId: string) => number | null;
}): number[] {
  const stay = input.clock.stayMinutes || 30;
  const latest = input.clock.returnBy - stay;
  const start = input.clock.startMinutes;
  const fits: number[] = [];
  for (let minute = start; minute <= latest; minute += 15) {
    if (arrivalFits({ ...input, arrive: minute })) fits.push(minute);
  }
  const stops = [...input.existing].sort((a, b) => a.arrive - b.arrive);
  const extras: number[] = [];
  for (const previous of [null, ...stops]) {
    const from = previous ? Math.ceil(previous.leave) : start;
    for (let minute = from; minute <= latest; minute += 1) {
      if (arrivalFits({ ...input, arrive: minute })) {
        extras.push(minute);
        break;
      }
    }
  }
  const merged = [...new Set([...extras, ...fits])].sort((a, b) => a - b);
  const spaced: number[] = [];
  for (const minute of merged) {
    if (extras.includes(minute) || !spaced.length || minute - spaced[spaced.length - 1] >= 30) {
      spaced.push(minute);
    }
  }
  return spaced.slice(0, 12);
}
