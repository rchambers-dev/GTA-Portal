import { drivingMatrix, geocodePostcodes, normalisePostcode, type GeoPoint } from "./geo";
import { timeToMinutes } from "./plan-due";
import {
  appendFitLearners,
  emptyPackedDay,
  retimeDay,
  type FrozenTime,
  type PackedDay,
  type PackedStop,
  type RouteLearner,
  type RouteSettings,
} from "./plan-route";

type DriveSettings = {
  startTime: string;
  lunchStart: string;
  lunchMinutes: number;
  returnBy: string;
  stayMinutes: number;
  callMinutes: number;
};

type DrivePerson = {
  gtaId: string;
  name: string;
  company: string;
  postcode: string;
  dueState: string;
};

type DriveStop = DrivePerson & {
  arrive: string;
  leave: string;
  arriveMinutes?: number | null;
  leaveMinutes?: number | null;
  verified: boolean;
  locked: boolean;
};

export function routeSettings(settings: DriveSettings): RouteSettings {
  const lunch = timeToMinutes(settings.lunchStart) ?? 13 * 60;
  return {
    startMinutes: timeToMinutes(settings.startTime) ?? 10 * 60,
    lunchStart: lunch,
    lunchEnd: lunch + settings.lunchMinutes,
    returnBy: timeToMinutes(settings.returnBy) ?? 16 * 60 + 45,
    stayMinutes: settings.stayMinutes,
    callMinutes: settings.callMinutes,
  };
}

export function dueRank(state: string): number {
  if (state === "overdue") return 3;
  if (state === "due-soon") return 2;
  if (state === "ok") return 1;
  return 0;
}

export async function fitStops(input: {
  officePostcode: string;
  existing: DriveStop[];
  extras: DrivePerson[];
  settings: RouteSettings;
  people: DrivePerson[];
}): Promise<{ packed: PackedDay; missing: string[]; office: (GeoPoint & { postcode: string }) | null }> {
  const postcodes = [input.officePostcode, ...input.existing.map((stop) => stop.postcode), ...input.extras.map((person) => person.postcode)];
  const geo = await geocodePostcodes(postcodes);
  const officePoint = geo[normalisePostcode(input.officePostcode)];
  const settings = input.settings;
  if (!officePoint) {
    return { packed: emptyPackedDay(settings), missing: [input.officePostcode], office: null };
  }
  const missing = input.extras.filter((person) => !geo[normalisePostcode(person.postcode)]).map((person) => person.postcode);
  const located: RouteLearner[] = [];
  const byId = new Map<string, RouteLearner>();
  function add(id: string, name: string, company: string, postcode: string, rank: number) {
    const point = geo[normalisePostcode(postcode)];
    if (!point || byId.has(id)) return;
    const learner: RouteLearner = {
      id,
      name,
      company,
      postcode,
      lat: point.lat,
      lon: point.lon,
      matrixIndex: located.length + 1,
      dueRank: rank,
      daysUntil: rank === 3 ? -1 : 10,
    };
    located.push(learner);
    byId.set(id, learner);
  }
  const people = new Map(input.people.map((person) => [person.gtaId, person]));
  for (const stop of input.existing) {
    const person = people.get(stop.gtaId);
    add(stop.gtaId, stop.name, stop.company, stop.postcode, dueRank(person?.dueState || stop.dueState));
  }
  for (const person of input.extras) add(person.gtaId, person.name, person.company, person.postcode, dueRank(person.dueState));
  const points = [officePoint, ...located];
  const matrix = await drivingMatrix(points);
  const existingLearners = input.existing.map((stop) => byId.get(stop.gtaId)).filter((item): item is RouteLearner => Boolean(item));
  const extraLearners = input.extras.map((person) => byId.get(person.gtaId)).filter((item): item is RouteLearner => Boolean(item));
  const frozen: Record<string, FrozenTime> = {};
  const current = emptyPackedDay(settings);
  current.stops = existingLearners.map((learner) => {
    const stop = input.existing.find((item) => item.gtaId === learner.id);
    const arrive = stop?.arriveMinutes ?? timeToMinutes(stop?.arrive || "") ?? settings.startMinutes;
    const leave = stop?.leaveMinutes ?? timeToMinutes(stop?.leave || "") ?? arrive + settings.stayMinutes;
    if (stop?.arrive && stop.leave) frozen[learner.id] = { arrive, leave, booked: stop.verified || stop.locked };
    return {
      id: learner.id,
      name: learner.name,
      company: learner.company,
      postcode: learner.postcode,
      lat: learner.lat,
      lon: learner.lon,
      matrixIndex: learner.matrixIndex,
      travelMinutes: 0,
      arrive,
      leave,
    } satisfies PackedStop;
  });
  const packed = extraLearners.length
    ? appendFitLearners(current, existingLearners, extraLearners, matrix, 0, settings, frozen)
    : retimeDay(existingLearners, matrix, 0, settings, frozen);
  return { packed, missing, office: { ...officePoint, postcode: input.officePostcode } };
}
