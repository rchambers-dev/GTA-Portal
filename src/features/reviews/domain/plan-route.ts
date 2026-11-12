import type { DriveMatrix } from "./geo";

export const SAME_SITE_STAY_MINUTES = 15;

export type RouteLearner = {
  id: string;
  name: string;
  company: string;
  postcode: string;
  lat: number;
  lon: number;
  matrixIndex: number;
  dueRank: number;
  daysUntil: number;
};

export type RouteSettings = {
  startMinutes: number;
  lunchStart: number;
  lunchEnd: number;
  returnBy: number;
  stayMinutes: number;
  callMinutes: number;
};

export type FrozenTime = { arrive: number; leave: number; booked?: boolean };

export type PackedStop = {
  id: string;
  name: string;
  company: string;
  postcode: string;
  lat: number;
  lon: number;
  matrixIndex: number;
  travelMinutes: number;
  arrive: number;
  leave: number;
};

export type PackedDay = {
  stops: PackedStop[];
  returnTravel: number;
  returnArrive: number;
  driveTotal: number;
  leaveMinutes: number;
  callStart: number;
  callEnd: number;
};

function companyKey(value: string): string {
  return value.trim().toLowerCase();
}

function postcodeKey(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function sameWorkplace(a?: { company?: string; postcode?: string } | null, b?: { company?: string; postcode?: string } | null): boolean {
  if (!a || !b) return false;
  const companyA = companyKey(a.company || "");
  const companyB = companyKey(b.company || "");
  if (companyA && companyB && companyA === companyB) return true;
  const postA = postcodeKey(a.postcode || "");
  const postB = postcodeKey(b.postcode || "");
  return Boolean(postA && postB && postA === postB);
}

export function stayMinutesFor(
  learner: RouteLearner,
  lastStop: { company?: string; postcode?: string } | null,
  together: RouteLearner[],
  settings: RouteSettings,
): number {
  const fullStay = settings.stayMinutes || 30;
  const shortStay = Math.min(SAME_SITE_STAY_MINUTES, fullStay);
  if (lastStop && sameWorkplace(lastStop, learner)) return shortStay;
  if (together.some((item) => item.id !== learner.id && sameWorkplace(item, learner))) return shortStay;
  return fullStay;
}

function skipLunch(time: number, lunchStart: number, lunchEnd: number): number {
  if (time >= lunchStart && time < lunchEnd) return lunchEnd;
  return time;
}

export function addTravel(time: number, durationMinutes: number, lunchStart: number, lunchEnd: number): number {
  const start = skipLunch(time, lunchStart, lunchEnd);
  if (start < lunchStart && start + durationMinutes > lunchStart) {
    return lunchEnd + (durationMinutes - (lunchStart - start));
  }
  return start + durationMinutes;
}

export function scheduleStop(time: number, driveMinutes: number, stayMinutes: number, lunchStart: number, lunchEnd: number) {
  let arrive = addTravel(time, driveMinutes, lunchStart, lunchEnd);
  arrive = skipLunch(arrive, lunchStart, lunchEnd);
  if (arrive < lunchStart && arrive + stayMinutes > lunchStart) arrive = lunchEnd;
  return { arrive, leave: arrive + stayMinutes };
}

function driveMinutesBetween(matrix: DriveMatrix, fromIndex: number, toIndex: number): number | null {
  const seconds = matrix.durations?.[fromIndex]?.[toIndex];
  if (seconds == null || Number.isNaN(seconds)) return null;
  return seconds / 60;
}

function scheduleOfficeCalls(startMinutes: number, callMinutes: number, lunchStart: number, lunchEnd: number) {
  const minutes = Number(callMinutes) || 0;
  const leaveMinutes = skipLunch(startMinutes, lunchStart, lunchEnd);
  if (!minutes) return { callStart: leaveMinutes, callEnd: leaveMinutes, leaveMinutes };
  return { callStart: Math.max(0, leaveMinutes - minutes), callEnd: leaveMinutes, leaveMinutes };
}

function makeStop(learner: RouteLearner, travel: number, arrive: number, leave: number): PackedStop {
  return {
    id: learner.id,
    name: learner.name,
    company: learner.company,
    postcode: learner.postcode,
    lat: learner.lat,
    lon: learner.lon,
    matrixIndex: learner.matrixIndex,
    travelMinutes: travel,
    arrive,
    leave,
  };
}

function workplaceMates(learner: RouteLearner, learners: RouteLearner[]): RouteLearner[] {
  return learners.filter((item) => item.id === learner.id || sameWorkplace(learner, item));
}

function workplaceGroups(learners: RouteLearner[]): RouteLearner[][] {
  const groups: RouteLearner[][] = [];
  const used = new Set<string>();
  for (const learner of learners) {
    if (used.has(learner.id)) continue;
    const group = workplaceMates(learner, learners);
    for (const item of group) used.add(item.id);
    groups.push(group);
  }
  return groups;
}

function compareUrgency(a: RouteLearner, b: RouteLearner): number {
  const rank = b.dueRank - a.dueRank;
  if (rank) return rank;
  return a.daysUntil - b.daysUntil;
}

function planWorkplaceBatch(input: {
  group: RouteLearner[];
  time: number;
  location: number;
  lastStop: PackedStop | RouteLearner | null;
  matrix: DriveMatrix;
  officeIndex: number;
  settings: RouteSettings;
  together: RouteLearner[];
  nextFrozen?: { learner: RouteLearner; arrive: number } | null;
  ignoreReturnBy?: boolean;
}) {
  const { group, matrix, officeIndex, settings, together } = input;
  if (!group.length) return null;
  let currentTime = input.time;
  let currentLocation = input.location;
  let previous: { company?: string; postcode?: string } | null = input.lastStop;
  const placed: { learner: RouteLearner; travel: number; arrive: number; leave: number }[] = [];
  for (const learner of group) {
    const measured = driveMinutesBetween(matrix, currentLocation, learner.matrixIndex);
    const samePlace = previous && sameWorkplace(previous, learner);
    if (measured == null && !samePlace) return null;
    const travel = samePlace ? 0 : measured || 0;
    const stay = stayMinutesFor(learner, previous, together, settings);
    const { arrive, leave } = scheduleStop(currentTime, travel, stay, settings.lunchStart, settings.lunchEnd);
    placed.push({ learner, travel, arrive, leave });
    currentTime = leave;
    currentLocation = learner.matrixIndex;
    previous = learner;
  }
  const last = placed[placed.length - 1];
  if (input.nextFrozen) {
    const toFrozen = sameWorkplace(last.learner, input.nextFrozen.learner)
      ? 0
      : driveMinutesBetween(matrix, last.learner.matrixIndex, input.nextFrozen.learner.matrixIndex);
    if (toFrozen == null) return null;
    const reach = addTravel(last.leave, toFrozen, settings.lunchStart, settings.lunchEnd);
    if (reach > input.nextFrozen.arrive) return null;
  }
  const back = driveMinutesBetween(matrix, last.learner.matrixIndex, officeIndex);
  if (back == null && !input.ignoreReturnBy) return null;
  const backAt = addTravel(last.leave, back || 0, settings.lunchStart, settings.lunchEnd);
  if (!input.ignoreReturnBy && backAt > settings.returnBy) return null;
  return { placed, time: currentTime, location: currentLocation, backAt };
}

function chronologicalStops(stops: PackedStop[], matrix: DriveMatrix, officeIndex: number): PackedStop[] {
  const ordered = [...stops].sort((a, b) => a.arrive - b.arrive || a.leave - b.leave || a.name.localeCompare(b.name));
  return ordered.map((stop, index) => {
    const prev = ordered[index - 1];
    let travel = stop.travelMinutes;
    if (!prev) travel = driveMinutesBetween(matrix, officeIndex, stop.matrixIndex) ?? stop.travelMinutes;
    else if (sameWorkplace(prev, stop)) travel = 0;
    else travel = driveMinutesBetween(matrix, prev.matrixIndex, stop.matrixIndex) ?? stop.travelMinutes;
    return { ...stop, travelMinutes: travel };
  });
}

function finishPackedDay(stops: PackedStop[], calls: { callStart: number; callEnd: number; leaveMinutes: number }, matrix: DriveMatrix, officeIndex: number, settings: RouteSettings): PackedDay {
  const ordered = chronologicalStops(stops, matrix, officeIndex);
  let returnTravel = 0;
  let returnArrive = settings.startMinutes;
  if (ordered.length) {
    const last = ordered[ordered.length - 1];
    returnTravel = driveMinutesBetween(matrix, last.matrixIndex, officeIndex) || 0;
    returnArrive = addTravel(last.leave, returnTravel, settings.lunchStart, settings.lunchEnd);
  }
  const driveTotal = ordered.reduce((sum, stop) => sum + stop.travelMinutes, 0) + (ordered.length ? returnTravel : 0);
  return {
    stops: ordered,
    returnTravel,
    returnArrive,
    driveTotal,
    leaveMinutes: calls.leaveMinutes,
    callStart: calls.callStart,
    callEnd: calls.callEnd,
  };
}

function packFitsReturnBy(packed: PackedDay, settings: RouteSettings): boolean {
  return !packed.stops.length || packed.returnArrive <= settings.returnBy + 0.5;
}

function trimPackedToReturnBy(packed: PackedDay, learners: RouteLearner[], matrix: DriveMatrix, officeIndex: number, settings: RouteSettings, frozenById: Record<string, FrozenTime>): PackedDay {
  if (packFitsReturnBy(packed, settings)) return packed;
  const held = new Set(packed.stops.filter((stop) => frozenById[stop.id]?.arrive != null).map((stop) => stop.id));
  const ids = packed.stops.map((stop) => stop.id);
  let next = packed;
  while (!packFitsReturnBy(next, settings)) {
    const dropAt = [...ids].reverse().findIndex((id) => !held.has(id));
    if (dropAt < 0) break;
    ids.splice(ids.length - 1 - dropAt, 1);
    const remaining = ids.map((id) => learners.find((learner) => learner.id === id)).filter((item): item is RouteLearner => Boolean(item));
    next = packLinearSequence(remaining, matrix, officeIndex, settings, frozenById, false, false);
  }
  return next;
}

function nextFrozenAfter(ordered: RouteLearner[], fromIndex: number, frozenById: Record<string, FrozenTime>, exclude: Set<string>) {
  for (let i = fromIndex; i < ordered.length; i += 1) {
    const learner = ordered[i];
    if (exclude.has(learner.id)) continue;
    const frozen = frozenById[learner.id];
    if (frozen) return { learner, arrive: frozen.arrive };
  }
  return null;
}

function orderFrozenChronologically(learners: RouteLearner[], frozenById: Record<string, FrozenTime>): RouteLearner[] {
  const frozen = learners.filter((learner) => frozenById[learner.id]?.arrive != null).sort((a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive);
  if (frozen.length < 2) return [...learners];
  let index = 0;
  return learners.map((learner) => (frozenById[learner.id]?.arrive != null ? frozen[index++] : learner));
}

function packLinearSequence(
  orderedLearners: RouteLearner[],
  matrix: DriveMatrix,
  officeIndex: number,
  settings: RouteSettings,
  frozenById: Record<string, FrozenTime> = {},
  keepAll = false,
  allowTrim = true,
  keepOrder = false,
): PackedDay {
  const sequence = keepOrder ? [...orderedLearners] : orderFrozenChronologically(orderedLearners, frozenById);
  const calls = scheduleOfficeCalls(settings.startMinutes, settings.callMinutes || 0, settings.lunchStart, settings.lunchEnd);
  let time = calls.leaveMinutes;
  let location = officeIndex;
  const stops: PackedStop[] = [];
  const placedIds = new Set<string>();

  for (let index = 0; index < sequence.length; index += 1) {
    const learner = sequence[index];
    if (placedIds.has(learner.id)) continue;
    const frozen = frozenById[learner.id];
    const lastStop = stops[stops.length - 1];
    const measured = driveMinutesBetween(matrix, location, learner.matrixIndex);
    const travel = lastStop && sameWorkplace(lastStop, learner) ? 0 : (measured ?? 0);
    if (frozen && frozen.arrive != null && frozen.leave != null) {
      let arrive = frozen.arrive;
      let leave = frozen.leave;
      let fromPrev = travel;
      if (lastStop && sameWorkplace(lastStop, learner)) {
        fromPrev = 0;
        const stay = stayMinutesFor(learner, lastStop, sequence, settings);
        if (lastStop.leave > arrive - 0.01) {
          arrive = lastStop.leave;
          leave = arrive + stay;
        }
      }
      if (!(lastStop && lastStop.leave <= arrive)) {
        fromPrev = driveMinutesBetween(matrix, officeIndex, learner.matrixIndex) ?? fromPrev;
      }
      stops.push(makeStop(learner, fromPrev, arrive, leave));
      placedIds.add(learner.id);
      time = leave;
      location = learner.matrixIndex;
      continue;
    }

    const batch: RouteLearner[] = [];
    const batchIds = new Set<string>();
    for (let look = index; look < sequence.length; look += 1) {
      const item = sequence[look];
      if (placedIds.has(item.id) || batchIds.has(item.id)) continue;
      if (frozenById[item.id]?.arrive != null) {
        if (keepOrder) break;
        continue;
      }
      if (item.id !== learner.id && !sameWorkplace(learner, item)) {
        if (keepOrder) break;
        continue;
      }
      batch.push(item);
      batchIds.add(item.id);
    }
    const nextFrozen = nextFrozenAfter(sequence, index + 1, frozenById, batchIds);
    let sim = planWorkplaceBatch({
      group: batch,
      time,
      location,
      lastStop: lastStop || null,
      matrix,
      officeIndex,
      settings,
      together: sequence,
      nextFrozen,
    });
    if (!sim && keepAll) {
      sim = planWorkplaceBatch({
        group: batch,
        time,
        location,
        lastStop: lastStop || null,
        matrix,
        officeIndex,
        settings,
        together: sequence,
        nextFrozen: null,
        ignoreReturnBy: true,
      });
    }
    if (!sim) continue;
    for (const stop of sim.placed) {
      stops.push(makeStop(stop.learner, stop.travel, stop.arrive, stop.leave));
      placedIds.add(stop.learner.id);
    }
    time = sim.time;
    location = sim.location;
  }

  let packed = finishPackedDay(stops, calls, matrix, officeIndex, settings);
  if (allowTrim) packed = trimPackedToReturnBy(packed, sequence, matrix, officeIndex, settings, frozenById);
  return packed;
}

export function retimeDay(
  learners: RouteLearner[],
  matrix: DriveMatrix,
  officeIndex: number,
  settings: RouteSettings,
  frozenById: Record<string, FrozenTime>,
): PackedDay {
  return packLinearSequence(learners, matrix, officeIndex, settings, frozenById, true, false, true);
}

export function packDay(candidates: RouteLearner[], matrix: DriveMatrix, officeIndex: number, settings: RouteSettings): PackedDay {
  const remaining = [...candidates];
  const stops: PackedStop[] = [];
  const calls = scheduleOfficeCalls(settings.startMinutes, settings.callMinutes || 0, settings.lunchStart, settings.lunchEnd);
  let time = calls.leaveMinutes;
  let location = officeIndex;
  while (remaining.length) {
    const lastStop = stops[stops.length - 1] || null;
    let best: { group: RouteLearner[]; sim: NonNullable<ReturnType<typeof planWorkplaceBatch>>; tightness: number; samePlace: number; band: number; travel: number } | null = null;
    for (const group of workplaceGroups(remaining)) {
      const head = group[0];
      const sim = planWorkplaceBatch({ group, time, location, lastStop, matrix, officeIndex, settings, together: group });
      if (!sim) continue;
      const band = Math.max(...group.map((item) => item.dueRank));
      const samePlace = lastStop ? Number(sameWorkplace(lastStop, head)) : 0;
      const travel = sim.placed[0].travel;
      const urgencyCmp = best ? compareUrgency(head, best.group[0]) : -1;
      if (
        !best ||
        samePlace > best.samePlace ||
        (samePlace === best.samePlace && band > best.band) ||
        (samePlace === best.samePlace && band === best.band && urgencyCmp < 0) ||
        (samePlace === best.samePlace && band === best.band && urgencyCmp === 0 && travel < best.travel)
      ) {
        best = { group, sim, tightness: 0, samePlace, band, travel };
      }
    }
    if (!best) break;
    for (const stop of best.sim.placed) {
      stops.push(makeStop(stop.learner, stop.travel, stop.arrive, stop.leave));
      remaining.splice(remaining.indexOf(stop.learner), 1);
    }
    time = best.sim.time;
    location = best.sim.location;
  }
  return finishPackedDay(stops, calls, matrix, officeIndex, settings);
}

function workplaceInsertOrder(learners: RouteLearner[], candidate: RouteLearner, frozenById: Record<string, FrozenTime>): number[] {
  const hasFrozen = learners.some((item) => frozenById[item.id]?.arrive != null);
  return learners
    .map((_, insertAt) => insertAt)
    .concat(learners.length)
    .sort((left, right) => {
      const grouped = (insertAt: number) =>
        Number(sameWorkplace(learners[insertAt - 1], candidate) || sameWorkplace(learners[insertAt], candidate));
      const groupRank = grouped(right) - grouped(left);
      if (groupRank) return groupRank;
      return hasFrozen ? right - left : left - right;
    });
}

function frozenStopsUnchanged(before: PackedStop[], after: PackedStop[], frozenById: Record<string, FrozenTime>): boolean {
  return before.every((stop) => {
    const freeze = frozenById[stop.id];
    if (!freeze || freeze.arrive == null) return true;
    const next = after.find((item) => item.id === stop.id);
    return Boolean(next) && next!.arrive === freeze.arrive && next!.leave === freeze.leave;
  });
}

export function appendFitLearners(
  planned: PackedDay,
  packedLearners: RouteLearner[],
  extras: RouteLearner[],
  matrix: DriveMatrix,
  officeIndex: number,
  settings: RouteSettings,
  frozenById: Record<string, FrozenTime>,
): PackedDay {
  let current = planned;
  let currentLearners = [...packedLearners];
  const remaining = extras.filter((learner) => !currentLearners.some((item) => item.id === learner.id));
  const pool = [...currentLearners, ...remaining];
  while (remaining.length) {
    remaining.sort((a, b) => {
      const band = b.dueRank - a.dueRank;
      if (band) return band;
      const grouped = Number(currentLearners.some((item) => sameWorkplace(item, b))) - Number(currentLearners.some((item) => sameWorkplace(item, a)));
      if (grouped) return grouped;
      return compareUrgency(a, b) || a.name.localeCompare(b.name);
    });
    let added = false;
    for (const candidate of [...remaining]) {
      const groupIds = remaining.filter((item) => item.id === candidate.id || sameWorkplace(candidate, item));
      const batches = groupIds.length > 1 ? [groupIds, [candidate]] : [groupIds];
      for (const insertIds of batches) {
        for (const insertAt of workplaceInsertOrder(currentLearners, candidate, frozenById)) {
          const order = [...currentLearners.slice(0, insertAt), ...insertIds, ...currentLearners.slice(insertAt)];
          const attempt = packLinearSequence(order, matrix, officeIndex, settings, frozenById);
          if (!insertIds.every((item) => attempt.stops.some((stop) => stop.id === item.id))) continue;
          if (attempt.stops.length !== current.stops.length + insertIds.length) continue;
          if (!frozenStopsUnchanged(current.stops, attempt.stops, frozenById)) continue;
          current = attempt;
          currentLearners = attempt.stops
            .map((stop) => pool.find((item) => item.id === stop.id))
            .filter((item): item is RouteLearner => Boolean(item));
          for (const item of insertIds) {
            const at = remaining.findIndex((entry) => entry.id === item.id);
            if (at >= 0) remaining.splice(at, 1);
          }
          added = true;
          break;
        }
        if (added) break;
      }
      if (added) break;
    }
    if (!added) break;
  }
  return current;
}

export function emptyPackedDay(settings: RouteSettings): PackedDay {
  const calls = scheduleOfficeCalls(settings.startMinutes, settings.callMinutes || 0, settings.lunchStart, settings.lunchEnd);
  return {
    stops: [],
    returnTravel: 0,
    returnArrive: settings.startMinutes,
    driveTotal: 0,
    leaveMinutes: calls.leaveMinutes,
    callStart: calls.callStart,
    callEnd: calls.callEnd,
  };
}
