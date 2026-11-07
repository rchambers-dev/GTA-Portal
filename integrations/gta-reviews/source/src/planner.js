import { canonTutorName } from "./tutors.js";
import {
  addDays,
  addWeeksToDateKey,
  dateFromKey,
  normaliseDateKey,
  startOfLocalDay,
  toDateKey,
} from "./lib/dates.js";

export { addDays, dateFromKey, normaliseDateKey, startOfLocalDay, toDateKey };

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export const PRIORITIES = [
  { id: "overdue", label: "Overdue", rank: 3 },
  { id: "due-this-week", label: "Due this week", rank: 2 },
  { id: "on-track", label: "On track", rank: 1 },
];

export function normalisePriority(value) {
  const compact = String(value || "on-track").trim().toLowerCase().replace(/\s+/g, "-");
  if (PRIORITIES.some((item) => item.id === compact)) return compact;
  if (compact.startsWith("over")) return "overdue";
  if (compact.startsWith("hi") || compact.includes("due")) return "due-this-week";
  if (compact.startsWith("lo") || compact === "normal") return "on-track";
  return "on-track";
}

export function priorityRank(value) {
  const found = PRIORITIES.find((item) => item.id === normalisePriority(value));
  return found ? found.rank : 1;
}

export function priorityLabel(value) {
  const found = PRIORITIES.find((item) => item.id === normalisePriority(value));
  return found ? found.label : "On track";
}

export function overdueDayCount(daysUntil) {
  if (!Number.isFinite(daysUntil) || daysUntil >= 0) return 0;
  return Math.abs(Math.round(daysUntil));
}

export function reviewPriorityLabel(learner, now = new Date()) {
  const id = planningPriority(learner, now);
  if (id !== "overdue") return priorityLabel(id);
  return `Overdue · ${formatWeeksAndDays(reviewDueStatus(learner, now).daysUntil)}`;
}

export function readAppointment(value) {
  if (!value || typeof value !== "object") return null;
  const dateKey = String(value.dateKey || "").trim();
  const arriveMinutes = Number(value.arriveMinutes);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  if (!Number.isFinite(arriveMinutes) || arriveMinutes < 0 || arriveMinutes >= 24 * 60) {
    return null;
  }
  const date = dateFromKey(dateKey);
  if (!isWeekdayDate(date)) return null;
  return { dateKey, arriveMinutes: Math.round(arriveMinutes) };
}

export function normaliseAppointment(value) {
  const appointment = readAppointment(value);
  if (!appointment) return null;
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (appointment.dateKey < todayKey) return null;
  return appointment;
}

export function normaliseCompany(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normaliseEmail(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

export function normalisePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    if (digits.startsWith("020")) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
    }
    if (/^01[1-9]1/.test(digits) || /^011[3-8]/.test(digits)) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return raw.replace(/\s+/g, " ").trim();
}

export function tutorLookupKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normaliseTutor(value) {
  return canonTutorName(value);
}

const APPRENTICESHIP_CANON = [
  { label: "Autocare Standard Level 2", test: /auto\s*care/i },
  { label: "Auto Technician", test: /auto\s*technician/i },
  { label: "Light Vehicle Maintenance", test: /light\s*vehicle/i },
  { label: "LVM Standard", test: /\blvmm\b|\blvm\b/i },
  { label: "HVM Standard", test: /\bhvm\b|\bhv\b.*standard|heavy\s*vehicle/i },
  { label: "Engineering technician", test: /engineering\s*technician/i },
  { label: "Paint Standard", test: /\bpaint\b/i },
  { label: "Panel Standard", test: /\bpanel\b/i },
];

export function normaliseApprenticeship(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const match = APPRENTICESHIP_CANON.find((item) => item.test.test(text));
  if (match) return match.label;
  return text.replace(/\bstandards\b/i, "Standard");
}

export function isTutorBlocked(learner, blockedTutors = []) {
  const key = tutorLookupKey(normaliseTutor(learner?.tutor));
  if (!key) return false;
  return (blockedTutors || []).some((item) => tutorLookupKey(normaliseTutor(item)) === key);
}

export function learnerProfileFrom(source = {}) {
  return {
    tutor: normaliseTutor(source.tutor),
    apprenticeship: normaliseApprenticeship(source.apprenticeship),
    apprenticeshipStartDate: normaliseDateKey(source.apprenticeshipStartDate),
    apprenticeshipEndDate: normaliseDateKey(source.apprenticeshipEndDate),
    gtaReviewer: normaliseCompany(source.gtaReviewer),
    employerContact: normaliseCompany(source.employerContact),
    employerEmail: normaliseEmail(source.employerEmail),
    contactNumber: normalisePhone(source.contactNumber),
    plannedReviewDate: normaliseDateKey(source.plannedReviewDate),
  };
}

export function applyLearnerProfile(learner, patch = {}) {
  if (!learner) return learner;
  Object.assign(learner, learnerProfileFrom({ ...learner, ...patch }));
  return learner;
}

export const DEFAULT_GTA_REVIEWER = "Reiss Chambers";
export const DEFAULT_ROUTE_EMAIL = "";

export function clearLearnerPlannedDates(item) {
  if (!item) return item;
  item.plannedReviewDate = "";
  item.reviewHistory = normaliseReviewHistory(item.reviewHistory).map((entry) => ({
    ...entry,
    plannedDateKey: "",
  }));
  return item;
}

export function companyLookupKey(value) {
  return normaliseCompany(value).toLowerCase();
}

export function postcodeLookupKey(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export const SAME_SITE_STAY_MINUTES = 15;

export function sameWorkplace(a, b) {
  if (!a || !b) return false;
  const companyA = companyLookupKey(a.company);
  const companyB = companyLookupKey(b.company);
  if (companyA && companyB && companyA === companyB) return true;
  const postA = postcodeLookupKey(a.postcode);
  const postB = postcodeLookupKey(b.postcode);
  return Boolean(postA && postB && postA === postB);
}

export function workplaceMates(learner, learners = []) {
  if (!learner) return [];
  return learners.filter(
    (item) => item.id === learner.id || sameWorkplace(learner, item),
  );
}

export function stayMinutesFor(
  learner,
  lastStop,
  together = [],
  settings = DEFAULT_SETTINGS,
) {
  const fullStay = settings.stayMinutes || 30;
  const shortStay = Math.min(SAME_SITE_STAY_MINUTES, fullStay);
  if (lastStop && sameWorkplace(lastStop, learner)) return shortStay;
  if (
    together.some(
      (item) => item && item.id !== learner.id && sameWorkplace(item, learner),
    )
  ) {
    return shortStay;
  }
  return fullStay;
}

function workplaceGroups(learners = []) {
  const groups = [];
  const used = new Set();
  for (const learner of learners) {
    if (used.has(learner.id)) continue;
    const group = workplaceMates(learner, learners);
    for (const item of group) used.add(item.id);
    groups.push(group);
  }
  return groups;
}

function planWorkplaceBatch({
  group,
  time,
  location,
  lastStop,
  matrix,
  officeIndex,
  settings,
  together,
  nextFrozen = null,
  ignoreReturnBy = false,
}) {
  if (!group.length) return null;
  let currentTime = time;
  let currentLocation = location;
  let previous = lastStop;
  const placed = [];
  for (const learner of group) {
    const measured = driveMinutesBetween(
      matrix,
      currentLocation,
      learner.matrixIndex,
    );
    const samePlace = previous && sameWorkplace(previous, learner);
    if (measured == null && !samePlace) return null;
    const travel = samePlace ? 0 : measured;
    const stay = stayMinutesFor(learner, previous, together, settings);
    const { arrive, leave } = scheduleStop(
      currentTime,
      travel,
      stay,
      settings.lunchStart,
      settings.lunchEnd,
    );
    if (!employerAllowsArrive(learner, arrive, leave, settings)) return null;
    placed.push({ learner, travel, arrive, leave });
    currentTime = leave;
    currentLocation = learner.matrixIndex;
    previous = learner;
  }
  const last = placed[placed.length - 1];
  if (nextFrozen) {
    const toFrozen =
      last && sameWorkplace(last.learner, nextFrozen.learner)
        ? 0
        : driveMinutesBetween(
            matrix,
            last.learner.matrixIndex,
            nextFrozen.learner.matrixIndex,
          );
    if (toFrozen == null) return null;
    const reachFrozen = addTravel(
      last.leave,
      toFrozen,
      settings.lunchStart,
      settings.lunchEnd,
    );
    if (reachFrozen > nextFrozen.arrive) return null;
  }
  const back = driveMinutesBetween(
    matrix,
    last.learner.matrixIndex,
    officeIndex,
  );
  if (back == null && !ignoreReturnBy) return null;
  const backAt = addTravel(
    last.leave,
    back || 0,
    settings.lunchStart,
    settings.lunchEnd,
  );
  if (!ignoreReturnBy && backAt > settings.returnBy) return null;
  return {
    placed,
    time: currentTime,
    location: currentLocation,
    backAt,
  };
}

export function workplaceCounts(learners = []) {
  const company = new Map();
  const postcode = new Map();
  for (const item of learners) {
    const companyLabel = normaliseCompany(item?.company);
    const companyKey = companyLookupKey(companyLabel);
    if (companyKey) {
      const current = company.get(companyKey) || { label: companyLabel, count: 0 };
      current.count += 1;
      company.set(companyKey, current);
    }
    const postLabel = String(item?.postcode || "").trim();
    const postKey = postcodeLookupKey(postLabel);
    if (postKey) {
      const current = postcode.get(postKey) || { label: postLabel, count: 0 };
      current.count += 1;
      postcode.set(postKey, current);
    }
  }
  return { company, postcode };
}

export function hasAppointmentOn(learner, dateKey) {
  return normaliseAppointment(learner?.appointment)?.dateKey === dateKey;
}

export const TIME_WINDOWS = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Before lunch" },
  { id: "afternoon", label: "After lunch" },
];

export function normaliseEmployer(value) {
  if (!value || typeof value !== "object") return null;
  const blockedDays = WEEKDAYS.filter((day) =>
    (value.blockedDays || []).includes(day),
  );
  const window = TIME_WINDOWS.some((item) => item.id === value.window)
    ? value.window
    : "any";
  if (!blockedDays.length && window === "any") return null;
  return { blockedDays, window };
}

export function employerAllowsDay(learner, dayName) {
  const employer = normaliseEmployer(learner?.employer);
  if (!employer) return true;
  return !employer.blockedDays.includes(dayName);
}

export function employerAllowsArrive(learner, arrive, leave, settings) {
  const employer = normaliseEmployer(learner?.employer);
  if (!employer || employer.window === "any") return true;
  if (employer.window === "morning") return leave <= settings.lunchStart;
  if (employer.window === "afternoon") return arrive >= settings.lunchEnd;
  return true;
}

export function allowedVisitDays(learner) {
  return WEEKDAYS.filter(
    (day) => day !== learner?.collegeDay && employerAllowsDay(learner, day),
  );
}

export function constraintRank(learner) {
  const employer = normaliseEmployer(learner?.employer);
  if (!employer) return 0;
  const open = WEEKDAYS.filter((day) => day !== learner?.collegeDay).length;
  const allowed = allowedVisitDays(learner).length;
  return (open - allowed) * 2 + (employer.window !== "any" ? 1 : 0);
}

export function employerLabel(learner) {
  const employer = normaliseEmployer(learner?.employer);
  if (!employer) return "";
  const allowed = allowedVisitDays(learner);
  const blocked = employer.blockedDays.filter((day) => day !== learner.collegeDay);
  const days =
    blocked.length === 1 && allowed.length === 4
      ? `Not ${blocked[0]}s`
      : allowed.length && allowed.length < 5
        ? allowed.map((day) => day.slice(0, 3)).join(", ")
        : "";
  const time =
    employer.window === "morning"
      ? "before lunch"
      : employer.window === "afternoon"
        ? "after lunch"
        : "";
  return [days, time].filter(Boolean).join(" · ");
}

export const DEFAULT_SETTINGS = {
  officePostcode: "DN3 3DY",
  startMinutes: 10 * 60,
  lunchStart: 13 * 60,
  lunchEnd: 13 * 60 + 30,
  returnBy: 16 * 60 + 45,
  stayMinutes: 30,
  callMinutes: 60,
  phoneReviewMinutes: 20,
  skipToday: true,
  workingDates: [],
  blockedTutors: [],
};

export function parseTimeToMinutes(value) {
  const [hours, minutes] = String(value)
    .split(":")
    .map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function formatTime(totalMinutes) {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDuration(totalMinutes) {
  const rounded = Math.max(0, Math.round(totalMinutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function skipLunch(time, lunchStart, lunchEnd) {
  if (time >= lunchStart && time < lunchEnd) return lunchEnd;
  return time;
}

export function addTravel(time, durationMinutes, lunchStart, lunchEnd) {
  const start = skipLunch(time, lunchStart, lunchEnd);
  if (start < lunchStart && start + durationMinutes > lunchStart) {
    const remaining = durationMinutes - (lunchStart - start);
    return lunchEnd + remaining;
  }
  return start + durationMinutes;
}

export function scheduleStop(
  time,
  driveMinutes,
  stayMinutes,
  lunchStart,
  lunchEnd,
) {
  let arrive = addTravel(time, driveMinutes, lunchStart, lunchEnd);
  arrive = skipLunch(arrive, lunchStart, lunchEnd);

  if (arrive < lunchStart && arrive + stayMinutes > lunchStart) {
    arrive = lunchEnd;
  }

  return {
    arrive,
    leave: arrive + stayMinutes,
  };
}

function driveMinutesBetween(matrix, fromIndex, toIndex) {
  const seconds = matrix.durations?.[fromIndex]?.[toIndex];
  if (seconds == null || Number.isNaN(seconds)) return null;
  return seconds / 60;
}

export function driveBetween(matrix, fromIndex, toIndex) {
  const minutes = driveMinutesBetween(matrix, fromIndex, toIndex);
  const metres = Number(matrix.distances?.[fromIndex]?.[toIndex]);
  if (minutes == null && !Number.isFinite(metres)) return null;
  return {
    minutes,
    metres: Number.isFinite(metres) ? metres : null,
  };
}

export function scheduleOfficeCalls(
  startMinutes,
  callMinutes,
  lunchStart,
  lunchEnd,
) {
  const minutes = Number(callMinutes) || 0;
  const leaveMinutes = skipLunch(startMinutes, lunchStart, lunchEnd);
  if (!minutes) {
    return {
      callStart: leaveMinutes,
      callEnd: leaveMinutes,
      leaveMinutes,
    };
  }
  const callEnd = leaveMinutes;
  const callStart = Math.max(0, callEnd - minutes);
  return { callStart, callEnd, leaveMinutes };
}

function makeStop(learner, travel, arrive, leave, kind = "visit") {
  const due = reviewDueStatus(learner);
  return {
    id: learner.id,
    name: learner.name,
    postcode: learner.postcode,
    collegeDay: learner.collegeDay,
    company: normaliseCompany(learner.company),
    priority: planningPriority(learner),
    daysUntil: due.daysUntil,
    matrixIndex: learner.matrixIndex,
    travelMinutes: travel,
    arrive,
    leave,
    lat: learner.lat,
    lon: learner.lon,
    kind,
  };
}

export const PHONE_REVIEW_MINUTES = 20;

export function phoneReviewDay(learner) {
  if (WEEKDAYS.includes(learner?.phoneReviewDay)) return learner.phoneReviewDay;
  if (learner?.phoneReview && WEEKDAYS.includes(learner.collegeDay)) {
    return learner.collegeDay;
  }
  return "";
}

export function isPhoneReview(learner) {
  return Boolean(phoneReviewDay(learner));
}

export function schedulePhoneReviews(
  learners,
  startMinutes,
  settings,
  duration = settings.phoneReviewMinutes || PHONE_REVIEW_MINUTES,
) {
  const stops = [];
  let time = startMinutes;
  for (const learner of learners) {
    let start = skipLunch(time, settings.lunchStart, settings.lunchEnd);
    if (start < settings.lunchStart && start + duration > settings.lunchStart) {
      start = settings.lunchEnd;
    }
    const leave = start + duration;
    if (leave > settings.returnBy) break;
    stops.push(makeStop(learner, 0, start, leave, "phone"));
    time = leave;
  }
  return { stops, endMinutes: time };
}

function attachPhones(packed, phones) {
  const phoneStops = phones?.stops || [];
  const lastPhone = phoneStops[phoneStops.length - 1];
  return {
    ...packed,
    phoneStops,
    reviewCount: (packed.stops?.length || 0) + phoneStops.length,
    returnTravel: packed.stops?.length ? packed.returnTravel : 0,
    returnArrive: packed.stops?.length
      ? packed.returnArrive
      : lastPhone?.leave ?? packed.returnArrive,
  };
}

function phoneLearnersForDay(learners, slot, assigned) {
  const dateKey = toDateKey(slot.date);
  return learners
    .filter(
      (learner) =>
        isPhoneReview(learner) &&
        phoneReviewDay(learner) === slot.day &&
        !hasAppointmentOn(learner, dateKey) &&
        !assigned.has(learner.id),
    )
    .sort((a, b) => compareReviewUrgency(a, b) || a.name.localeCompare(b.name));
}

function claimPhoneReviews(learners, slot, assigned, settings) {
  const phones = schedulePhoneReviews(
    phoneLearnersForDay(learners, slot, assigned),
    slot.startMinutes,
    settings,
  );
  for (const stop of phones.stops) assigned.add(stop.id);
  return phones;
}

function automaticVisitHeldOff(learner, dateKey, settings = {}) {
  if ((settings.holdOffIds || []).includes(learner?.id)) return true;
  const next = reviewDueStatus(learner).next;
  const week = weekContaining(next);
  return Boolean(week?.startKey && dateKey < week.startKey);
}

function canVisitOnDay(
  learner,
  slot,
  assigned,
  excludedIds = [],
  lockedById = new Map(),
  settings = {},
) {
  const dateKey = toDateKey(slot.date);
  const lockedDate = lockedById.get(learner.id);
  if (lockedDate && lockedDate !== dateKey) return false;
  const bookedKey = normaliseAppointment(learner.appointment)?.dateKey;
  if (bookedKey && bookedKey !== dateKey) return false;
  if (hasAppointmentOn(learner, dateKey)) {
    return true;
  }
  if (lockedDate === dateKey) {
    return !excludedIds.includes(learner.id);
  }
  if (automaticVisitHeldOff(learner, dateKey, settings)) return false;
  return (
    !isPhoneReview(learner) &&
    learner.collegeDay !== slot.day &&
    employerAllowsDay(learner, slot.day) &&
    !assigned.has(learner.id) &&
    !excludedIds.includes(learner.id)
  );
}

export function isAwaitingActive(entry, dateKey, now = new Date()) {
  if (!entry || !Number.isFinite(Number(entry.untilMinutes))) return false;
  const day = startOfLocalDay(dateFromKey(dateKey));
  const today = startOfLocalDay(now);
  if (day.getTime() > today.getTime()) return true;
  if (day.getTime() < today.getTime()) return false;
  return minutesFromMidnight(now) < Number(entry.untilMinutes);
}

function awaitingFrozenForDay(awaitingReply, dateKey, now) {
  const frozen = {};
  for (const [id, entry] of Object.entries(awaitingReply?.[dateKey] || {})) {
    if (!isAwaitingActive(entry, dateKey, now)) continue;
    if (entry.arrive == null || entry.leave == null) continue;
    frozen[id] = {
      arrive: entry.arrive,
      leave: entry.leave,
      awaiting: true,
    };
  }
  return frozen;
}

function expiredAwaitingIds(awaitingReply, dateKey, now) {
  return Object.entries(awaitingReply?.[dateKey] || {})
    .filter(([, entry]) => entry && !isAwaitingActive(entry, dateKey, now))
    .map(([id]) => id);
}

function setLockDate(locked, id, dateKey) {
  if (!id || !dateKey) return;
  const current = locked.get(id);
  if (!current || dateKey < current) locked.set(id, dateKey);
}

function allowsGapFill(learner, settings) {
  const ids = settings?.fillLearnerIds;
  if (!Array.isArray(ids)) return true;
  return ids.includes(learner.id);
}

function lockLearnersToDays(
  learners,
  acceptedRoutes,
  frozenTimes,
  verifiedByDate,
  awaitingReply = {},
  now = new Date(),
  pinnedRoutes = {},
  { includePins = true, includeFrozen = includePins } = {},
) {
  const todayKey = toDateKey(startOfLocalDay(now));
  const keepDate = (dateKey) => Boolean(dateKey && dateKey >= todayKey);
  const locked = new Map();
  for (const [dateKey, route] of Object.entries(acceptedRoutes || {})) {
    if (!keepDate(dateKey)) continue;
    for (const stop of route.stops || []) setLockDate(locked, stop.id, dateKey);
    for (const stop of route.phoneStops || []) setLockDate(locked, stop.id, dateKey);
  }
  if (includePins) {
    for (const [dateKey, ids] of Object.entries(pinnedRoutes || {})) {
      if (!keepDate(dateKey)) continue;
      for (const id of ids || []) setLockDate(locked, id, dateKey);
    }
  }
  if (includeFrozen) {
    for (const [dateKey, times] of Object.entries(frozenTimes || {})) {
      if (!keepDate(dateKey)) continue;
      for (const [id, freeze] of Object.entries(times || {})) {
        if (!freeze?.booked) continue;
        setLockDate(locked, id, dateKey);
      }
    }
  }
  for (const [dateKey, ids] of Object.entries(verifiedByDate || {})) {
    if (!keepDate(dateKey)) continue;
    for (const id of ids || []) setLockDate(locked, id, dateKey);
  }
  for (const learner of learners) {
    const appointment = normaliseAppointment(learner.appointment);
    if (appointment) setLockDate(locked, learner.id, appointment.dateKey);
  }
  for (const [dateKey, entries] of Object.entries(awaitingReply || {})) {
    for (const [id, entry] of Object.entries(entries || {})) {
      if (isAwaitingActive(entry, dateKey, now)) setLockDate(locked, id, dateKey);
    }
  }
  return locked;
}

function appointmentFrozenById(learners, settings) {
  const frozen = {};
  const fullStay = settings.stayMinutes || 30;
  const shortStay = Math.min(SAME_SITE_STAY_MINUTES, fullStay);
  const appointed = (learners || []).filter((learner) =>
    normaliseAppointment(learner.appointment),
  );
  for (const learner of appointed) {
    const appointment = normaliseAppointment(learner.appointment);
    const earlierMate = appointed.some((mate) => {
      if (mate.id === learner.id || !sameWorkplace(learner, mate)) return false;
      const other = normaliseAppointment(mate.appointment);
      return (
        other?.dateKey === appointment.dateKey &&
        other.arriveMinutes < appointment.arriveMinutes
      );
    });
    const stay = earlierMate ? shortStay : fullStay;
    frozen[learner.id] = {
      arrive: appointment.arriveMinutes,
      leave: appointment.arriveMinutes + stay,
      booked: true,
    };
  }
  return frozen;
}

function lockedStopsForDay(
  dateKey,
  learners,
  settings,
  now,
  acceptedRoutes,
  awaitingReply,
  frozenTimes,
  exceptId = "",
) {
  const frozenById = {
    ...frozenTimesForDay(
      frozenTimes,
      dateKey,
      acceptedRoutes?.[dateKey],
      awaitingReply,
      now,
    ),
    ...appointmentFrozenById(
      learners.filter(
        (item) => item.id !== exceptId && hasAppointmentOn(item, dateKey),
      ),
      settings,
    ),
  };
  if (exceptId) delete frozenById[exceptId];
  return Object.keys(frozenById)
    .map((id) => {
      const learner = learners.find((item) => item.id === id);
      const freeze = frozenById[id];
      if (!learner || freeze?.arrive == null || freeze.leave == null) return null;
      return { learner, arrive: freeze.arrive, leave: freeze.leave };
    })
    .filter(Boolean)
    .sort((a, b) => a.arrive - b.arrive);
}

function timesOverlap(arriveA, leaveA, arriveB, leaveB) {
  return arriveA < leaveB && leaveA > arriveB;
}

export function findLockedTimeClash(
  learner,
  arriveMinutes,
  dateKey,
  learners,
  matrix,
  settings,
  now = new Date(),
  acceptedRoutes = {},
  awaitingReply = {},
  frozenTimes = {},
) {
  if (!learner || !dateKey || !Number.isFinite(arriveMinutes)) return null;
  const stay = settings.stayMinutes || 30;
  const leaveMinutes = arriveMinutes + stay;
  const locked = lockedStopsForDay(
    dateKey,
    learners,
    settings,
    now,
    acceptedRoutes,
    awaitingReply,
    frozenTimes,
    learner.id,
  );
  if (!locked.length) return null;

  const overlapping = locked
    .filter((stop) =>
      timesOverlap(arriveMinutes, leaveMinutes, stop.arrive, stop.leave),
    )
    .sort(
      (a, b) =>
        Math.abs(a.arrive - arriveMinutes) - Math.abs(b.arrive - arriveMinutes),
    );
  if (overlapping.length) {
    return { ...overlapping[0], reason: "overlap" };
  }

  const previous = [...locked].reverse().find((stop) => stop.leave <= arriveMinutes);
  const next = locked.find((stop) => stop.arrive >= leaveMinutes);
  if (previous && learner.matrixIndex != null && previous.learner.matrixIndex != null) {
    const travel = driveMinutesBetween(
      matrix,
      previous.learner.matrixIndex,
      learner.matrixIndex,
    );
    if (travel != null) {
      const reach = addTravel(
        previous.leave,
        travel,
        settings.lunchStart,
        settings.lunchEnd,
      );
      if (reach > arriveMinutes) {
        return { ...previous, reason: "too-close" };
      }
    }
  }
  if (next && learner.matrixIndex != null && next.learner.matrixIndex != null) {
    const travel = driveMinutesBetween(
      matrix,
      learner.matrixIndex,
      next.learner.matrixIndex,
    );
    if (travel != null) {
      const reach = addTravel(
        leaveMinutes,
        travel,
        settings.lunchStart,
        settings.lunchEnd,
      );
      if (reach > next.arrive) {
        return { ...next, reason: "too-close" };
      }
    }
  }
  return null;
}

function markBookedStops(packed, frozenById, learners = [], dateKey = "") {
  for (const stop of packed.stops || []) {
    const learner = (learners || []).find((item) => item.id === stop.id);
    if (frozenById[stop.id]?.booked || (learner && dateKey && hasAppointmentOn(learner, dateKey))) {
      stop.booked = true;
    }
  }
  return packed;
}

function learnersFromStops(stops, pool) {
  return stops
    .map((stop) => pool.find((learner) => learner.id === stop.id))
    .filter(Boolean);
}

function prependFitLearners(
  planned,
  packedLearners,
  extras,
  matrix,
  officeIndex,
  daySettings,
  frozenById,
) {
  let current = planned;
  let currentLearners = [...packedLearners];
  const remaining = extras.filter(
    (learner) => !currentLearners.some((item) => item.id === learner.id),
  );

  while (remaining.length) {
    remaining.sort((a, b) => compareGapFill(a, b, currentLearners));

    let added = false;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const insertIds = remaining.filter(
        (item) =>
          item.id === candidate.id || sameWorkplace(candidate, item),
      );
      if (normaliseAppointment(candidate.appointment)) continue;
      const attempt = packLinearSequence(
        [...insertIds, ...currentLearners],
        matrix,
        officeIndex,
        daySettings,
        frozenById,
      );
      if (!insertIds.every((item) => attempt.stops.some((stop) => stop.id === item.id))) {
        continue;
      }
      if (attempt.stops.length !== current.stops.length + insertIds.length) continue;
      if (!frozenStopsUnchanged(current.stops, attempt.stops, frozenById)) continue;
      current = attempt;
      currentLearners = learnersFromStops(attempt.stops, [
        ...insertIds,
        ...currentLearners,
      ]);
      for (const item of insertIds) {
        const at = remaining.findIndex((entry) => entry.id === item.id);
        if (at >= 0) remaining.splice(at, 1);
      }
      added = true;
      break;
    }
    if (!added) break;
  }

  return { packed: current, learners: currentLearners };
}

function packAroundAppointments(
  appointed,
  extras,
  matrix,
  officeIndex,
  daySettings,
  frozenById,
) {
  const core = [...appointed].sort(
    (a, b) =>
      (a.appointment?.arriveMinutes || 0) - (b.appointment?.arriveMinutes || 0),
  );
  let packed = packOrderedDay(
    core,
    matrix,
    officeIndex,
    daySettings,
    frozenById,
  );
  let currentLearners = learnersFromStops(packed.stops, [...core, ...extras]);
  const before = prependFitLearners(
    packed,
    currentLearners,
    extras,
    matrix,
    officeIndex,
    daySettings,
    frozenById,
  );
  packed = appendFitLearners(
    before.packed,
    before.learners,
    extras,
    matrix,
    officeIndex,
    daySettings,
    frozenById,
  );
  return markBookedStops(packed, frozenById);
}

function chronologicalStops(stops, matrix, officeIndex) {
  const ordered = [...stops].sort(
    (a, b) =>
      a.arrive - b.arrive ||
      a.leave - b.leave ||
      String(a.name || "").localeCompare(String(b.name || "")),
  );
  return ordered.map((stop, index) => {
    const prev = ordered[index - 1];
    let travel = stop.travelMinutes;
    if (!prev) {
      travel =
        driveMinutesBetween(matrix, officeIndex, stop.matrixIndex) ??
        stop.travelMinutes;
    } else if (sameWorkplace(prev, stop)) {
      travel = 0;
    } else {
      travel =
        driveMinutesBetween(matrix, prev.matrixIndex, stop.matrixIndex) ??
        stop.travelMinutes;
    }
    return { ...stop, travelMinutes: travel };
  });
}

function finishPackedDay(stops, calls, matrix, officeIndex, settings) {
  const ordered = chronologicalStops(stops, matrix, officeIndex);
  let returnTravel = 0;
  let returnArrive = settings.startMinutes;

  if (ordered.length) {
    const last = ordered[ordered.length - 1];
    returnTravel =
      driveMinutesBetween(matrix, last.matrixIndex, officeIndex) || 0;
    returnArrive = addTravel(
      last.leave,
      returnTravel,
      settings.lunchStart,
      settings.lunchEnd,
    );
  }

  const driveTotal =
    ordered.reduce((sum, stop) => sum + stop.travelMinutes, 0) +
    (ordered.length ? returnTravel : 0);

  return {
    stops: ordered,
    returnTravel,
    returnArrive,
    driveTotal,
    reviewCount: ordered.length,
    callStart: calls.callStart,
    callEnd: calls.callEnd,
    leaveMinutes: calls.leaveMinutes,
  };
}

function stopIsHeldOnDay(stop, frozenById = {}) {
  return Boolean(stop?.booked || frozenById[stop.id]?.arrive != null);
}

function packFitsReturnBy(packed, settings) {
  return !packed?.stops?.length || packed.returnArrive <= (settings.returnBy || 0) + 0.5;
}

function trimPackedToReturnBy(
  packed,
  learners,
  matrix,
  officeIndex,
  settings,
  frozenById = {},
) {
  if (packFitsReturnBy(packed, settings)) return packed;
  const held = new Set(
    (packed.stops || [])
      .filter((stop) => stopIsHeldOnDay(stop, frozenById))
      .map((stop) => stop.id),
  );
  let ids = (packed.stops || []).map((stop) => stop.id);
  let next = packed;
  while (!packFitsReturnBy(next, settings)) {
    const dropAt = [...ids].reverse().findIndex((id) => !held.has(id));
    if (dropAt < 0) break;
    ids.splice(ids.length - 1 - dropAt, 1);
    const remaining = ids
      .map((id) => learners.find((learner) => learner.id === id))
      .filter(Boolean);
    next = packLinearSequence(
      remaining,
      matrix,
      officeIndex,
      settings,
      frozenById,
      false,
      false,
    );
    next = markBookedStops(next, frozenById);
  }
  return next;
}

function packDay(candidates, matrix, officeIndex, settings) {
  const remaining = [...candidates];
  const stops = [];
  const calls = scheduleOfficeCalls(
    settings.startMinutes,
    settings.callMinutes || 0,
    settings.lunchStart,
    settings.lunchEnd,
  );
  let time = calls.leaveMinutes;
  let location = officeIndex;

  while (remaining.length) {
    const lastStop = stops[stops.length - 1];
    let best = null;

    for (const group of workplaceGroups(remaining)) {
      const head = group[0];
      const sim = planWorkplaceBatch({
        group,
        time,
        location,
        lastStop,
        matrix,
        officeIndex,
        settings,
        together: group,
      });
      if (!sim) continue;

      const tightness = Math.max(...group.map((item) => constraintRank(item)));
      const bestTight = best ? best.tightness : -1;
      const band = Math.max(...group.map((item) => dueRank(item)));
      const bestBand = best ? best.band : -1;
      const samePlace = lastStop ? Number(sameWorkplace(lastStop, head)) : 0;
      const bestSame = best ? best.samePlace : 0;
      const urgencyCmp = best
        ? compareReviewUrgency(head, best.group[0])
        : -1;
      const travel = sim.placed[0].travel;
      if (
        !best ||
        tightness > bestTight ||
        (tightness === bestTight && samePlace > bestSame) ||
        (tightness === bestTight && samePlace === bestSame && band > bestBand) ||
        (tightness === bestTight &&
          samePlace === bestSame &&
          band === bestBand &&
          urgencyCmp < 0) ||
        (tightness === bestTight &&
          samePlace === bestSame &&
          band === bestBand &&
          urgencyCmp === 0 &&
          travel < best.travel)
      ) {
        best = { group, sim, tightness, samePlace, band, travel };
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

function nextFrozenAfter(orderedLearners, fromIndex, frozenById, excludeIds = new Set()) {
  for (let i = fromIndex; i < orderedLearners.length; i++) {
    const learner = orderedLearners[i];
    if (excludeIds.has(learner.id)) continue;
    const frozen = frozenById[learner.id];
    if (frozen) return { learner, ...frozen };
  }
  return null;
}

function orderFrozenChronologically(learners, frozenById = {}) {
  const frozen = learners
    .filter((learner) => frozenById[learner.id]?.arrive != null)
    .sort(
      (a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive,
    );
  if (frozen.length < 2) return [...learners];
  let index = 0;
  return learners.map((learner) =>
    frozenById[learner.id]?.arrive != null ? frozen[index++] : learner,
  );
}

function packLinearSequence(
  orderedLearners,
  matrix,
  officeIndex,
  settings,
  frozenById = {},
  keepAll = false,
  allowTrim = true,
  keepOrder = false,
) {
  const sequence = keepOrder
    ? [...orderedLearners]
    : orderFrozenChronologically(orderedLearners, frozenById);
  const calls = scheduleOfficeCalls(
    settings.startMinutes,
    settings.callMinutes || 0,
    settings.lunchStart,
    settings.lunchEnd,
  );
  let time = calls.leaveMinutes;
  let location = officeIndex;
  const stops = [];
  const placedIds = new Set();

  for (let index = 0; index < sequence.length; index++) {
    const learner = sequence[index];
    if (placedIds.has(learner.id)) continue;
    const frozen = frozenById[learner.id];
    const lastStop = stops[stops.length - 1];
    const measured = driveMinutesBetween(matrix, location, learner.matrixIndex);
    const travel =
      lastStop && sameWorkplace(lastStop, learner) ? 0 : (measured ?? 0);
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
        fromPrev =
          driveMinutesBetween(matrix, officeIndex, learner.matrixIndex) ??
          fromPrev;
      }
      stops.push(makeStop(learner, fromPrev, arrive, leave));
      placedIds.add(learner.id);
      time = leave;
      location = learner.matrixIndex;
      continue;
    }

    const batch = [];
    const batchIds = new Set();
    for (let look = index; look < sequence.length; look++) {
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
    const nextFrozen = nextFrozenAfter(
      sequence,
      index + 1,
      frozenById,
      batchIds,
    );
    let sim = planWorkplaceBatch({
      group: batch,
      time,
      location,
      lastStop,
      matrix,
      officeIndex,
      settings,
      together: sequence,
      nextFrozen,
    });
    if (!sim && keepAll && batch.every((item) => frozenById[item.id]?.arrive != null)) {
      sim = planWorkplaceBatch({
        group: batch,
        time,
        location,
        lastStop,
        matrix,
        officeIndex,
        settings,
        together: sequence,
        nextFrozen: null,
        ignoreReturnBy: true,
      });
    }
    if (!sim) {
      if (keepAll) {
        sim = planWorkplaceBatch({
          group: batch,
          time,
          location,
          lastStop,
          matrix,
          officeIndex,
          settings,
          together: sequence,
          nextFrozen: null,
          ignoreReturnBy: true,
        });
      }
      if (!sim) continue;
    }

    for (const stop of sim.placed) {
      stops.push(makeStop(stop.learner, stop.travel, stop.arrive, stop.leave));
      placedIds.add(stop.learner.id);
    }
    time = sim.time;
    location = sim.location;
  }

  let packed = finishPackedDay(stops, calls, matrix, officeIndex, settings);
  if (
    packed.stops.length &&
    packed.stops.every((stop) => frozenById[stop.id]?.arrive != null)
  ) {
    packed.callStart = packed.leaveMinutes;
    packed.callEnd = packed.leaveMinutes;
    const first = packed.stops[0];
    const fromOffice =
      driveMinutesBetween(matrix, officeIndex, first.matrixIndex) ??
      first.travelMinutes;
    packed.leaveMinutes = first.arrive - fromOffice;
  }
  packed = markBookedStops(packed, frozenById);
  if (allowTrim) {
    packed = trimPackedToReturnBy(
      packed,
      sequence,
      matrix,
      officeIndex,
      settings,
      frozenById,
    );
  }
  return packed;
}

function sequenceWorkplaceBlocks(learners, frozenById, settings) {
  const result = [];
  const used = new Set();
  const lunchStart = settings.lunchStart ?? 13 * 60;
  for (const learner of learners) {
    if (used.has(learner.id)) continue;
    const group = learners.filter(
      (item) =>
        !used.has(item.id) &&
        (item.id === learner.id || sameWorkplace(learner, item)),
    );
    const frozen = group
      .filter((item) => frozenById[item.id]?.arrive != null)
      .sort(
        (a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive,
      );
    const loose = group.filter((item) => frozenById[item.id]?.arrive == null);
    const firstArrive = frozen[0]
      ? frozenById[frozen[0].id].arrive
      : null;
    const afterLunchBlock =
      firstArrive != null && firstArrive >= lunchStart;
    const ordered = frozen.length
      ? afterLunchBlock
        ? [...frozen, ...loose]
        : [...loose, ...frozen]
      : group;
    for (const item of ordered) {
      if (used.has(item.id)) continue;
      result.push(item);
      used.add(item.id);
    }
  }
  return result;
}

export function packOrderedDay(
  orderedLearners,
  matrix,
  officeIndex,
  settings,
  frozenById = {},
  keepAll = false,
  keepOrder = false,
) {
  const sequenced = keepOrder
    ? orderedLearners
    : sequenceWorkplaceBlocks(orderedLearners, frozenById, settings);
  return packLinearSequence(
    sequenced,
    matrix,
    officeIndex,
    settings,
    frozenById,
    keepAll,
    !keepAll,
    keepOrder,
  );
}

function frozenStopsUnchanged(before, after, frozenById) {
  return before.every((stop) => {
    const freeze = frozenById[stop.id];
    if (!freeze || freeze.arrive == null) return true;
    const next = after.find((item) => item.id === stop.id);
    return (
      Boolean(next) &&
      next.arrive === freeze.arrive &&
      next.leave === freeze.leave
    );
  });
}

export function appendFitLearners(
  planned,
  packedLearners,
  extras,
  matrix,
  officeIndex,
  daySettings,
  frozenById,
) {
  let current = planned;
  let currentLearners = [...packedLearners];
  const remaining = extras.filter(
    (learner) => !currentLearners.some((item) => item.id === learner.id),
  );
  const pool = [...currentLearners, ...remaining];

  while (remaining.length) {
    remaining.sort((a, b) => compareGapFill(a, b, currentLearners));

    let added = false;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      if (normaliseAppointment(candidate.appointment)) continue;
      const groupIds = remaining.filter(
        (item) =>
          item.id === candidate.id || sameWorkplace(candidate, item),
      );
      const batches =
        groupIds.length > 1 ? [groupIds, [candidate]] : [groupIds];
      for (const insertIds of batches) {
        for (const insertAt of workplaceInsertOrder(
          currentLearners,
          candidate,
          frozenById,
        )) {
          const order = [
            ...currentLearners.slice(0, insertAt),
            ...insertIds,
            ...currentLearners.slice(insertAt),
          ];
          const attempt = packLinearSequence(
            order,
            matrix,
            officeIndex,
            daySettings,
            frozenById,
          );
          if (!insertIds.every((item) => attempt.stops.some((stop) => stop.id === item.id))) {
            continue;
          }
          if (attempt.stops.length !== current.stops.length + insertIds.length) {
            continue;
          }
          if (!frozenStopsUnchanged(current.stops, attempt.stops, frozenById)) {
            continue;
          }
          current = attempt;
          currentLearners = learnersFromStops(attempt.stops, pool);
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

function appendFillExtras(
  planned,
  packedLearners,
  extras,
  matrix,
  officeIndex,
  daySettings,
  frozenById,
  settings,
) {
  const first = new Set(settings?.fillFirstIds || []);
  const primary = first.size
    ? extras.filter((learner) => first.has(learner.id))
    : extras;
  const rest = first.size
    ? extras.filter((learner) => !first.has(learner.id))
    : [];
  let next = planned;
  let learners = packedLearners;
  const pool = [...packedLearners, ...extras];
  if (primary.length) {
    next = appendFitLearners(
      next,
      learners,
      primary,
      matrix,
      officeIndex,
      daySettings,
      frozenById,
    );
    learners = learnersFromStops(next.stops, pool);
  }
  if (rest.length) {
    next = appendFitLearners(
      next,
      learners,
      rest,
      matrix,
      officeIndex,
      daySettings,
      frozenById,
    );
  }
  return next;
}

function frozenTimesForDay(
  frozenTimes,
  dateKey,
  accepted,
  awaitingReply = {},
  now = new Date(),
) {
  const frozenById = { ...(frozenTimes?.[dateKey] || {}) };
  for (const stop of accepted?.stops || []) {
    if (frozenById[stop.id]?.arrive != null) continue;
    if (stop.arrive == null || stop.leave == null) continue;
    frozenById[stop.id] = { arrive: stop.arrive, leave: stop.leave };
  }
  for (const [id, freeze] of Object.entries(
    awaitingFrozenForDay(awaitingReply, dateKey, now),
  )) {
    if (frozenById[id]?.arrive != null) continue;
    frozenById[id] = freeze;
  }
  return frozenById;
}

function bookedFrozenTimes(
  frozenById,
  learners,
  dateKey,
  verified,
  pinnedIds = [],
  awaitingIds = [],
  { allowPinMove = false } = {},
) {
  const pinned = new Set(pinnedIds || []);
  const awaiting = new Set(awaitingIds || []);
  const next = {};
  for (const [id, freeze] of Object.entries(frozenById || {})) {
    if (!freeze || freeze.arrive == null) continue;
    const learner = learners.find((item) => item.id === id);
    if (
      freeze.booked ||
      verified?.has?.(id) ||
      (!allowPinMove && pinned.has(id)) ||
      awaiting.has(id) ||
      (learner && hasAppointmentOn(learner, dateKey))
    ) {
      next[id] = freeze;
    }
  }
  return next;
}

// eslint-disable-next-line no-unused-vars
function mondayOnOrAfter(date) {
  const start = startOfLocalDay(date);
  const weekday = start.getDay();
  const offset = weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday;
  return addDays(start, offset);
}

function minutesFromMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// d/M/yy with no leading zeros, for example 23/5/26. No weekday and no prefix.
export function formatShortNumericDate(value) {
  let day;
  let month;
  let year;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    day = value.getDate();
    month = value.getMonth() + 1;
    year = value.getFullYear();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
    if (!match) return "";
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return "";
    }
  }
  return `${day}/${month}/${String(year).slice(-2)}`;
}

export const REVIEW_INTERVAL_WEEKS = 10;
export const CONCERN_INTERVAL_WEEKS = 5;
export const TUTOR_NOTICE_WEEKS = 2;
export const REVIEW_CYCLE_WEEKDAYS = REVIEW_INTERVAL_WEEKS * 5;

export function isConcernLearner(learner) {
  return Boolean(learner?.concern);
}

export function reviewIntervalWeeks(learner) {
  return isConcernLearner(learner) ? CONCERN_INTERVAL_WEEKS : REVIEW_INTERVAL_WEEKS;
}

export function nextWorkingDateKey(fromDate = new Date(), { skipToday = false } = {}) {
  const today = startOfLocalDay(fromDate);
  let date = today;
  if (skipToday && isWeekdayDate(today)) date = addDays(today, 1);
  while (!isWeekdayDate(date)) date = addDays(date, 1);
  return toDateKey(date);
}

export function countWeekdaysBetween(startKey, endKey) {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (!start || !end || start > end) return 0;
  let count = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (isWeekdayDate(date)) count += 1;
  }
  return count;
}

export function dailyReviewQuota(
  learners,
  { now = new Date(), skipToday = false, sinceKey = "" } = {},
) {
  const live = (learners || []).filter((item) => item && !item.isTest);
  const total = live.length;
  const today = startOfLocalDay(now);
  const todayKey = toDateKey(today);
  const cycleDays = REVIEW_INTERVAL_WEEKS * 7;
  const origin = startOfLocalDay(dateFromKey(sinceKey) || today);
  const elapsedDays = Math.max(
    0,
    Math.floor((today.getTime() - origin.getTime()) / 86400000),
  );
  const cycleIndex = Math.floor(elapsedDays / cycleDays);
  let cycleStart = addDays(origin, cycleIndex * cycleDays);
  let cycleEnd = addDays(cycleStart, cycleDays - 1);
  let startKey = nextWorkingDateKey(now, { skipToday });
  if (startKey > toDateKey(cycleEnd)) {
    cycleStart = addDays(cycleStart, cycleDays);
    cycleEnd = addDays(cycleStart, cycleDays - 1);
    startKey = toDateKey(cycleStart);
    if (!isWeekdayDate(cycleStart)) startKey = nextWorkingDateKey(cycleStart);
  }
  const cycleStartKey = toDateKey(cycleStart);
  const endKey = toDateKey(cycleEnd);
  const weekdays = countWeekdaysBetween(startKey, endKey);
  const doneIds = new Set();
  for (const learner of live) {
    const last = lastReviewDateKey(learner);
    if (last && last >= cycleStartKey && last <= todayKey) doneIds.add(learner.id);
    for (const entry of learner.reviewHistory || []) {
      const key = normaliseDateKey(entry.actualDateKey || entry.dateKey);
      if (key && key >= cycleStartKey && key <= todayKey) doneIds.add(learner.id);
    }
  }
  const remaining = Math.max(0, total - doneIds.size);
  const perDay = remaining
    ? Math.max(1, weekdays ? Math.ceil(remaining / weekdays) : remaining)
    : 0;
  return {
    learners: total,
    remaining,
    weekdays,
    perDay,
    startKey,
    endKey,
    todayKey,
    cycleStartKey,
  };
}

export function formatWeeksAndDays(totalDays) {
  const days = Math.max(0, Math.round(Math.abs(Number(totalDays) || 0)));
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const weekLabel = weeks === 1 ? "1 week" : `${weeks} weeks`;
  const dayLabel = rest === 1 ? "1 day" : `${rest} days`;
  if (!weeks && !rest) return "0 days";
  if (!weeks) return dayLabel;
  if (!rest) return weekLabel;
  return `${weekLabel} ${dayLabel}`;
}

export const REVIEW_ATTENDED = [
  { id: "in-person", label: "In person" },
  { id: "phone", label: "By phone" },
  { id: "teams", label: "Teams" },
];

export function normaliseAttended(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (["in-person", "inperson", "visit", "yes"].includes(key)) return "in-person";
  if (["phone", "by-phone", "call"].includes(key)) return "phone";
  if (["teams", "team"].includes(key)) return "teams";
  return "";
}

export function attendedLabel(value) {
  const id = normaliseAttended(value);
  return REVIEW_ATTENDED.find((item) => item.id === id)?.label || "";
}

export function reviewAttendedFor(learner, value = "") {
  const stored = normaliseAttended(value);
  if (stored) return stored;
  if (isPhoneReview(learner)) return "phone";
  return "in-person";
}

export function attendedFromStopKind(kind, learner) {
  const key = String(kind || "")
    .trim()
    .toLowerCase();
  if (key === "phone" || key === "teams") return key;
  if (key === "visit" || key === "in-person") return "in-person";
  return reviewAttendedFor(learner);
}

export function ensureHistoryAttended(learner) {
  if (!learner) return false;
  const history = normaliseReviewHistory(learner.reviewHistory);
  let changed = false;
  for (const entry of history) {
    const next = reviewAttendedFor(learner, entry.attended);
    if (next !== entry.attended) {
      entry.attended = next;
      changed = true;
    }
  }
  if (changed) learner.reviewHistory = history;
  return changed;
}

export function archiveCycleStartKey(learner) {
  const history = normaliseReviewHistory(learner?.reviewHistory);
  return (
    history[0]?.actualDateKey ||
    normaliseDateKey(learner?.lastReviewDate) ||
    normaliseDateKey(learner?.plannedReviewDate) ||
    ""
  );
}

export function archiveLearnerDateKey(learner) {
  const history = normaliseReviewHistory(learner?.reviewHistory);
  return (
    history[history.length - 1]?.actualDateKey ||
    normaliseDateKey(learner?.lastReviewDate) ||
    normaliseDateKey(learner?.plannedReviewDate) ||
    ""
  );
}

function dateInReviewWindow(dateKey, proposedKey, weeks = REVIEW_INTERVAL_WEEKS) {
  const key = normaliseDateKey(dateKey);
  const proposed = normaliseDateKey(proposedKey);
  if (!key || !proposed) return false;
  const start = dateFromKey(proposed);
  const windowEnd = start ? toDateKey(addDays(start, weeks * 7)) : proposed;
  return key >= proposed && key < windowEnd;
}

export function bookedReviewDateKey(learner, proposedKey = "", actualKey = "") {
  const booked = normaliseDateKey(learner?.appointment?.dateKey);
  if (
    booked &&
    (!proposedKey ||
      booked === proposedKey ||
      booked === actualKey ||
      dateInReviewWindow(booked, proposedKey, reviewIntervalWeeks(learner)))
  ) {
    return booked;
  }
  return "";
}

export function inferredArchiveAttended(learner, proposedKey, actualKey = "") {
  if (bookedReviewDateKey(learner, proposedKey, actualKey)) return "in-person";
  if (isPhoneReview(learner)) return "phone";
  return "";
}

export function archiveAttendedStage(learner, row, nextProposedKey, today) {
  const stored = normaliseAttended(row?.attended);
  if (row?.actualKey) return stored || inferredArchiveAttended(learner, row.proposedKey, row.actualKey) || "in-person";
  const inferred = inferredArchiveAttended(learner, row?.proposedKey, row?.actualKey);
  if (inferred) return inferred;
  if (stored) return stored;
  if (row?.proposedKey && row.proposedKey < today) return "overdue";
  if (row?.proposedKey && row.proposedKey === nextProposedKey) return "upcoming";
  return "not-ready";
}

export function archiveReviewRows(learner, now = new Date()) {
  const today = toDateKey(startOfLocalDay(now));
  const weeks = reviewIntervalWeeks(learner);
  const officialEnd = normaliseDateKey(learner?.apprenticeshipEndDate);
  const history = [...normaliseReviewHistory(learner?.reviewHistory)];
  const attendance =
    learner?.reviewAttendance && typeof learner.reviewAttendance === "object"
      ? learner.reviewAttendance
      : {};
  const built = history.map((entry) => {
    const proposedKey = entry.plannedDateKey || entry.actualDateKey;
    const actualKey = entry.actualDateKey || "";
    const bookedDateKey = bookedReviewDateKey(learner, proposedKey, actualKey);
    return {
      proposedKey,
      actualKey,
      bookedDateKey,
      attended: normaliseAttended(entry.attended || attendance[proposedKey]),
      overdue: false,
    };
  });
  let cursor = nextScheduledReviewDateKey(learner, weeks);
  let guard = 0;
  let upcoming = 0;
  while (cursor && guard < 16 && upcoming < 8) {
    const alreadyDone = built.some((row) => row.actualKey === cursor);
    const alreadyOpen = built.some((row) => !row.actualKey && row.proposedKey === cursor);
    if (!alreadyDone && !alreadyOpen) {
      const bookedDateKey = bookedReviewDateKey(learner, cursor, "");
      built.push({
        proposedKey: cursor,
        actualKey: "",
        bookedDateKey,
        attended: normaliseAttended(attendance[cursor]),
        overdue: Boolean(!bookedDateKey && cursor < today),
      });
      upcoming += 1;
    }
    const further = addWeeksToDateKey(cursor, weeks);
    if (!further || further === cursor) break;
    if (officialEnd && further > officialEnd) break;
    cursor = further;
    guard += 1;
  }
  if (!built.length) return [];
  return built.map((row, _index, rows) => {
    const nextProposedKey =
      rows.find((item) => !item.actualKey && item.proposedKey >= today)?.proposedKey ||
      rows.find((item) => !item.actualKey)?.proposedKey ||
      "";
    const stage = archiveAttendedStage(learner, row, nextProposedKey, today);
    return { ...row, attended: stage, stage };
  });
}

export function normaliseReviewHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const entries = [];
  for (const item of value) {
    const actualDateKey = normaliseDateKey(
      item?.actualDateKey || item?.dateKey || item,
    );
    if (!actualDateKey || seen.has(actualDateKey)) continue;
    seen.add(actualDateKey);
    const plannedDateKey = normaliseDateKey(item?.plannedDateKey);
    const timing = reviewTiming(actualDateKey, plannedDateKey).id;
    entries.push({
      dateKey: actualDateKey,
      actualDateKey,
      plannedDateKey,
      source: item?.source === "completed" ? "completed" : "entered",
      timing: timing === "unknown" ? "" : timing,
      attended: normaliseAttended(item?.attended),
      attachment: normaliseAttachment(item?.attachment),
    });
  }
  entries.sort((a, b) => a.actualDateKey.localeCompare(b.actualDateKey));
  return entries;
}

export function normaliseAttachment(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  const filename = String(value.filename || "").trim();
  if (!id) return null;
  return {
    id,
    filename: filename || id,
    type: String(value.type || ""),
  };
}

export function lastReviewDateKey(learner) {
  const history = normaliseReviewHistory(learner?.reviewHistory);
  const dates = [
    history[history.length - 1]?.actualDateKey,
    normaliseDateKey(learner?.lastReviewDate),
    normaliseDateKey(learner?.completedOn),
  ].filter(Boolean);
  if (!dates.length) return "";
  return dates.sort()[dates.length - 1];
}

export function scheduleEndFromDates(plannedKey, officialEndKey, weeks = REVIEW_INTERVAL_WEEKS) {
  const official = normaliseDateKey(officialEndKey);
  if (official) return official;
  const planned = normaliseDateKey(plannedKey);
  if (planned) {
    const date = dateFromKey(planned);
    return date ? toDateKey(addDays(date, weeks * 7 * 6)) : planned;
  }
  return "";
}

export function reviewScheduleEndKey(learner) {
  return scheduleEndFromDates(
    plannedCycleStartKey(learner),
    learner?.apprenticeshipEndDate,
    reviewIntervalWeeks(learner),
  );
}

export function reviewCycleDateKeys(
  startKey,
  endKey,
  { includeStart = true, weeks = REVIEW_INTERVAL_WEEKS } = {},
) {
  const start = normaliseDateKey(startKey);
  const startDate = dateFromKey(start);
  if (!startDate) return [];
  const end = normaliseDateKey(endKey);
  if (!end) return includeStart ? [start] : [];
  if (end < start) return includeStart ? [start] : [];
  const keys = [];
  let current = startDate;
  let guard = 0;
  while (guard < 80) {
    const key = toDateKey(current);
    if (key > end) break;
    if (includeStart || key !== start) keys.push(key);
    current = addDays(current, weeks * 7);
    guard += 1;
  }
  return keys;
}

export function isFinalReviewDate(dateKey, endKey) {
  const key = normaliseDateKey(dateKey);
  const end = normaliseDateKey(endKey);
  return Boolean(key && end && key === end);
}

export function futureReviewDateKeys(learner, weeks = reviewIntervalWeeks(learner)) {
  const start = nextScheduledReviewDateKey(learner, weeks);
  return reviewCycleDateKeys(start, reviewScheduleEndKey(learner), {
    includeStart: false,
    weeks,
  });
}

export function lastPlannedDateKey(learner) {
  const history = normaliseReviewHistory(learner?.reviewHistory);
  return history[history.length - 1]?.plannedDateKey || "";
}

export function plannedCycleStartKey(learner) {
  return (
    normaliseDateKey(learner?.plannedReviewDate) || lastPlannedDateKey(learner)
  );
}

export function reviewTiming(actualDateKey, plannedDateKey) {
  const actual = normaliseDateKey(actualDateKey);
  const planned = normaliseDateKey(plannedDateKey);
  if (!actual || !planned) {
    return { id: "unknown", label: "Timing not set" };
  }
  const week = weekContaining(planned);
  if (!week) return { id: "unknown", label: "Timing not set" };
  if (actual < week.startKey) return { id: "early", label: "Early" };
  if (actual <= week.endKey) return { id: "on-time", label: "On time" };
  return { id: "overdue", label: "Overdue" };
}

export function weekContaining(dateKey) {
  const date = dateFromKey(normaliseDateKey(dateKey));
  if (!date) return null;
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(date, mondayOffset);
  const end = addDays(start, 6);
  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

function daysUntilDateKey(dateKey, now = new Date()) {
  const date = dateFromKey(normaliseDateKey(dateKey));
  if (!date) return null;
  return Math.round(
    (startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86400000,
  );
}

export function nextReviewDateKey(learnerOrLastKey, weeks) {
  if (learnerOrLastKey && typeof learnerOrLastKey === "object") {
    return nextScheduledReviewDateKey(learnerOrLastKey, weeks);
  }
  return addWeeksToDateKey(learnerOrLastKey, weeks ?? REVIEW_INTERVAL_WEEKS);
}

export function nextScheduledReviewDateKey(learner, weeks = reviewIntervalWeeks(learner)) {
  const lastActual = lastReviewDateKey(learner);
  if (lastActual) return addWeeksToDateKey(lastActual, weeks);
  return plannedCycleStartKey(learner);
}

export function nextNeededDateKey(learner, now = new Date(), weeks = reviewIntervalWeeks(learner)) {
  return nextScheduledReviewDateKey(learner, weeks);
}

export function applyConcernSchedule(learner, on) {
  if (!learner) return { learner, plannedChanged: false, bookedKept: false };
  learner.concern = Boolean(on);
  const booked = Boolean(normaliseAppointment(learner.appointment)?.dateKey);
  const next = nextScheduledReviewDateKey(learner);
  let plannedChanged = false;
  if (next && !booked && normaliseDateKey(learner.plannedReviewDate) !== next) {
    learner.plannedReviewDate = next;
    plannedChanged = true;
  }
  return { learner, plannedChanged, bookedKept: booked };
}

export function thisReviewDateKey(learner) {
  return (
    nextScheduledReviewDateKey(learner) ||
    normaliseDateKey(learner?.plannedReviewDate)
  );
}

export function followingReviewDateKey(learner) {
  const weeks = reviewIntervalWeeks(learner);
  const current = thisReviewDateKey(learner) || nextScheduledReviewDateKey(learner, weeks);
  if (!current) return "";
  return addWeeksToDateKey(current, weeks);
}

export function formatUkDateKey(dateKey) {
  const key = normaliseDateKey(dateKey);
  if (!key) return "";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

export function tutorNoticeDateKey(nextKey, weeks = TUTOR_NOTICE_WEEKS) {
  const date = dateFromKey(normaliseDateKey(nextKey));
  if (!date) return "";
  return toDateKey(addDays(date, -weeks * 7));
}

export function recordReview(learner, dateKeyOrEntry, source = "completed") {
  const actual = normaliseDateKey(
    dateKeyOrEntry?.actualDateKey ||
      dateKeyOrEntry?.dateKey ||
      dateKeyOrEntry,
  );
  if (!learner || !actual) return learner;
  const history = normaliseReviewHistory(learner.reviewHistory);
  const existing = history.find((item) => item.actualDateKey === actual);
  const planned =
    normaliseDateKey(dateKeyOrEntry?.plannedDateKey) ||
    existing?.plannedDateKey ||
    "";
  const timing = reviewTiming(actual, planned);
  const timingId = timing.id === "unknown" ? "" : timing.id;
  if (existing) {
    if (source === "completed") existing.source = "completed";
    existing.plannedDateKey = planned;
    existing.actualDateKey = actual;
    existing.dateKey = actual;
    existing.timing = timingId || existing.timing || "";
    existing.attended = reviewAttendedFor(
      learner,
      dateKeyOrEntry?.attended || existing.attended,
    );
    existing.attachment =
      normaliseAttachment(dateKeyOrEntry?.attachment) || existing.attachment || null;
  } else {
    history.push({
      dateKey: actual,
      actualDateKey: actual,
      plannedDateKey: planned,
      source,
      timing: timingId,
      attended: reviewAttendedFor(learner, dateKeyOrEntry?.attended),
      attachment: normaliseAttachment(dateKeyOrEntry?.attachment),
    });
  }
  learner.reviewHistory = history.sort((a, b) =>
    a.actualDateKey.localeCompare(b.actualDateKey),
  );
  learner.lastReviewDate = lastReviewDateKey({
    ...learner,
    reviewHistory: learner.reviewHistory,
    lastReviewDate: actual,
  });
  if (source === "completed") {
    learner.priority = "normal";
  } else if (
    reviewDueStatus(learner).state !== "overdue" &&
    normalisePriority(learner.priority) === "overdue"
  ) {
    learner.priority = "normal";
  }
  return learner;
}

export function removeReview(learner, dateKey) {
  const key = normaliseDateKey(dateKey);
  if (!learner || !key) return learner;
  learner.reviewHistory = normaliseReviewHistory(learner.reviewHistory).filter(
    (item) => item.actualDateKey !== key && item.dateKey !== key && item.plannedDateKey !== key,
  );
  if (normaliseDateKey(learner.lastReviewDate) === key) learner.lastReviewDate = "";
  if (normaliseDateKey(learner.completedOn) === key) learner.completedOn = "";
  learner.lastReviewDate = lastReviewDateKey(learner);
  return learner;
}

export function reviewDueStatus(learner, now = new Date()) {
  const last = lastReviewDateKey(learner);
  const next = nextScheduledReviewDateKey(learner);
  const needed = nextNeededDateKey(learner, now);
  const week = weekContaining(next);
  const neededWeek = weekContaining(needed);
  const noticeWeekStart = neededWeek?.startKey || week?.startKey;
  const notice = tutorNoticeDateKey(noticeWeekStart);
  if (!next || !week) {
    return {
      last,
      next: "",
      needed: "",
      weekStart: "",
      weekEnd: "",
      notice: "",
      daysUntil: null,
      daysUntilStart: null,
      daysUntilNeeded: null,
      daysUntilNotice: null,
      state: "unknown",
      window: "unknown",
      windowLabel: "Not set",
      noticeState: "unknown",
    };
  }
  const daysUntilEnd = daysUntilDateKey(week.endKey, now);
  const daysUntilStart = daysUntilDateKey(week.startKey, now);
  const daysUntilNeeded = neededWeek
    ? daysUntilDateKey(neededWeek.startKey, now)
    : null;
  const daysUntilNotice = daysUntilDateKey(notice, now);
  const behind = daysUntilEnd < 0;
  const dueThisWeek = !behind && daysUntilStart <= 0;
  return {
    last,
    next,
    needed,
    weekStart: week.startKey,
    weekEnd: week.endKey,
    notice,
    daysUntil: daysUntilEnd,
    daysUntilStart,
    daysUntilNeeded,
    daysUntilNotice,
    state: behind ? "overdue" : dueThisWeek ? "due-soon" : "ok",
    window: behind ? "behind" : "on-track",
    windowLabel: behind
      ? "Behind"
      : dueThisWeek
        ? "Due this week"
        : `Within ${reviewIntervalWeeks(learner)} weeks`,
    noticeState:
      daysUntilNotice < 0 ? "due" : daysUntilNotice === 0 ? "today" : daysUntilNotice <= 14 ? "soon" : "ok",
  };
}

export function planningPriority(learner, now = new Date()) {
  const due = reviewDueStatus(learner, now);
  if (!due.next || due.daysUntil == null) return "on-track";
  if (due.daysUntil < 0) return "overdue";
  if (due.state === "due-soon") return "due-this-week";
  return "on-track";
}

export function dueRank(learner, now = new Date()) {
  return priorityRank(planningPriority(learner, now));
}

function clusterSameWorkplace(learners, frozenById = {}) {
  const result = [];
  const used = new Set();
  for (const learner of learners) {
    if (used.has(learner.id)) continue;
    const group = learners.filter(
      (item) => !used.has(item.id) && (item.id === learner.id || sameWorkplace(learner, item)),
    );
    if (group.length === 1) {
      result.push(learner);
      used.add(learner.id);
      continue;
    }
    const frozen = group
      .filter((item) => frozenById[item.id]?.arrive != null)
      .sort((a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive);
    const loose = group.filter((item) => frozenById[item.id]?.arrive == null);
    const ordered = frozen.length ? [...loose, ...frozen] : group;
    for (const item of ordered) {
      if (used.has(item.id)) continue;
      result.push(item);
      used.add(item.id);
    }
  }
  return result;
}

function compareGapFill(a, b, packed = []) {
  const band = dueRank(b) - dueRank(a);
  if (band) return band;
  const grouped =
    Number(packed.some((item) => sameWorkplace(item, b))) -
    Number(packed.some((item) => sameWorkplace(item, a)));
  if (grouped) return grouped;
  return compareReviewUrgency(a, b) || a.name.localeCompare(b.name);
}

function workplaceInsertOrder(learners, candidate, frozenById = {}) {
  const hasFrozen = learners.some((item) => frozenById[item.id]?.arrive != null);
  return learners
    .map((_, insertAt) => insertAt)
    .concat(learners.length)
    .sort((left, right) => {
      const grouped = (insertAt) =>
        Number(
          sameWorkplace(learners[insertAt - 1], candidate) ||
            sameWorkplace(learners[insertAt], candidate),
        );
      const groupRank = grouped(right) - grouped(left);
      if (groupRank) return groupRank;
      return hasFrozen ? right - left : left - right;
    });
}

export function dueDaysUntil(learner, now = new Date()) {
  const days = reviewDueStatus(learner, now).daysUntil;
  return days == null ? Number.POSITIVE_INFINITY : days;
}

export function compareReviewUrgency(a, b, now = new Date()) {
  const rank =
    priorityRank(planningPriority(b, now)) - priorityRank(planningPriority(a, now));
  if (rank) return rank;
  return dueDaysUntil(a, now) - dueDaysUntil(b, now);
}

export function weekdayName(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const index = date.getDay();
  if (index < 1 || index > 5) return "";
  return WEEKDAYS[index - 1];
}

export function isWeekdayDate(date) {
  return Boolean(weekdayName(date));
}

export function snapshotDay(day) {
  const date = day.date || dateFromKey(day.dateKey);
  const stops = day.stops || [];
  const phoneStops = day.phoneStops || [];
  return {
    day: day.day,
    dateKey: day.dateKey || (date ? toDateKey(date) : ""),
    startMinutes: day.startMinutes,
    callStart: day.callStart,
    callEnd: day.callEnd,
    leaveMinutes: day.leaveMinutes,
    stops: stops.map((stop) => ({ ...stop })),
    phoneStops: phoneStops.map((stop) => ({ ...stop })),
    returnTravel: day.returnTravel,
    returnArrive: day.returnArrive,
    driveTotal: day.driveTotal,
    reviewCount: stops.length + phoneStops.length,
  };
}

function startMinutesForToday(now, settings) {
  const nowMinutes = minutesFromMidnight(now);
  if (nowMinutes <= settings.startMinutes) return settings.startMinutes;
  if (nowMinutes >= settings.returnBy) return null;
  if (nowMinutes >= settings.lunchStart && nowMinutes < settings.lunchEnd) {
    return settings.lunchEnd;
  }
  return nowMinutes;
}

export function planningSignature(
  now = new Date(),
  settings = DEFAULT_SETTINGS,
  extras = "",
) {
  const days = getPlanningDays(now, settings)
    .map(
      (slot) =>
        `${slot.day}:${toDateKey(slot.date)}:${slot.available ? slot.startMinutes : slot.skipReason}:${slot.isToday ? 1 : 0}`,
    )
    .join("|");
  return extras ? `${days}|${extras}` : days;
}

function slotForDate(date, now, settings) {
  const skipToday = settings.skipToday !== false;
  const day = weekdayName(date) || (date.getDay() === 0 ? "Sunday" : "Saturday");
  const today = startOfLocalDay(now);
  const slotDay = startOfLocalDay(date);
  const isToday = slotDay.getTime() === today.getTime();
  const isTomorrow = slotDay.getTime() === addDays(today, 1).getTime();
  const alreadyPassed = slotDay.getTime() < today.getTime();

  if (!weekdayName(date)) {
    return {
      day,
      date: slotDay,
      isToday,
      isTomorrow,
      available: false,
      skipReason: "weekend",
      startMinutes: settings.startMinutes,
    };
  }

  if (alreadyPassed) {
    return {
      day,
      date: slotDay,
      isToday: false,
      isTomorrow: false,
      available: false,
      skipReason: "passed",
      startMinutes: settings.startMinutes,
    };
  }

  if (isToday && skipToday) {
    return {
      day,
      date: slotDay,
      isToday: true,
      isTomorrow: false,
      available: false,
      skipReason: "skipped",
      startMinutes: settings.startMinutes,
    };
  }

  if (isToday) {
    const startMinutes = startMinutesForToday(now, settings);
    if (startMinutes == null) {
      return {
        day,
        date: slotDay,
        isToday: true,
        isTomorrow: false,
        available: false,
        skipReason: "too-late",
        startMinutes: settings.startMinutes,
      };
    }
    return {
      day,
      date: slotDay,
      isToday: true,
      isTomorrow: false,
      available: true,
      skipReason: "",
      startMinutes,
    };
  }

  return {
    day,
    date: slotDay,
    isToday: false,
    isTomorrow,
    available: true,
    skipReason: "",
    startMinutes: settings.startMinutes,
  };
}

function defaultPlanDate(now, settings) {
  const skipToday = settings.skipToday !== false;
  let date = startOfLocalDay(now);
  if (!isWeekdayDate(date) || skipToday) {
    date = addDays(date, 1);
    while (!isWeekdayDate(date)) date = addDays(date, 1);
  }
  return date;
}

export function defaultWorkingDateKeys(now = new Date(), settings = DEFAULT_SETTINGS) {
  return [toDateKey(defaultPlanDate(now, settings))];
}

export function resolvedWorkingDates(now = new Date(), settings = DEFAULT_SETTINGS) {
  const selected = [...new Set(settings.workingDates || [])]
    .filter(Boolean)
    .sort()
    .map(dateFromKey)
    .filter(isWeekdayDate);
  if (selected.length) return selected;
  return [defaultPlanDate(now, settings)];
}

export function getPlanningDays(now = new Date(), settings = DEFAULT_SETTINGS) {
  return resolvedWorkingDates(now, settings).map((date) =>
    slotForDate(date, now, settings),
  );
}

function planningHorizon(now, settings, extraDateKeys = []) {
  const baseDateKeys = settings.workingDates?.length
    ? settings.workingDates
    : defaultWorkingDateKeys(now, settings);
  const extra = extraDateKeys.filter(Boolean);
  const mergedSettings = {
    ...settings,
    workingDates: [...new Set([...baseDateKeys, ...extra])].sort(),
  };
  const extraSet = new Set(extra);
  return getPlanningDays(now, mergedSettings).map((slot) => {
    const dateKey = toDateKey(slot.date);
    if (!extraSet.has(dateKey) || slot.skipReason !== "skipped") return slot;
    const startMinutes = slot.isToday
      ? startMinutesForToday(now, settings)
      : settings.startMinutes;
    if (startMinutes == null) return slot;
    return {
      ...slot,
      available: true,
      skipReason: "",
      startMinutes,
    };
  });
}

export function callingAllowed(now = new Date(), settings = DEFAULT_SETTINGS) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < settings.returnBy;
}

export function verifiedIds(verifiedByDate, dateKey) {
  return new Set(verifiedByDate?.[dateKey] || []);
}

export function isConfirmedStop(stop, verified) {
  return Boolean(stop?.booked) || verified.has(stop.id);
}

function isConfirmedLearner(learner, dateKey, verified) {
  return verified.has(learner.id) || hasAppointmentOn(learner, dateKey);
}

function allStopsVerified(stops, verified) {
  return (
    Boolean(stops.length) &&
    stops.every((stop) => isConfirmedStop(stop, verified))
  );
}

function packWithCalls(pool, matrix, officeIndex, settings, startMinutes, callMinutes) {
  return packDay(pool, matrix, officeIndex, {
    ...settings,
    startMinutes,
    callMinutes,
  });
}

export function findBestEmployerSlot(
  learner,
  learners,
  matrix,
  officeIndex,
  settings,
  now = new Date(),
  acceptedRoutes = {},
  verifiedByDate = {},
  awaitingReply = {},
  frozenTimes = {},
  excludedFromDate = {},
  preferDateKey = "",
  preferArriveMinutes = null,
  pinnedRoutes = {},
) {
  if (!learner || isPhoneReview(learner)) return null;
  const lockedById = lockLearnersToDays(
    learners,
    acceptedRoutes,
    frozenTimes,
    verifiedByDate,
    awaitingReply,
    now,
    pinnedRoutes,
  );
  const lockedDate = lockedById.get(learner.id);
  if (
    lockedDate &&
    !hasAppointmentOn(learner, lockedDate) &&
    !preferDateKey &&
    preferArriveMinutes == null
  ) {
    return null;
  }

  let best = null;
  const horizon = planningHorizon(now, settings, [
    preferDateKey,
    normaliseAppointment(learner.appointment)?.dateKey,
  ]);

  for (const slot of horizon) {
    if (!slot.available) continue;
    const dateKey = toDateKey(slot.date);
    if (preferDateKey && dateKey !== preferDateKey) continue;
    if (learner.collegeDay === slot.day) continue;
    if (!employerAllowsDay(learner, slot.day)) continue;
    const excluded = excludedFromDate?.[dateKey] || [];
    if (excluded.includes(learner.id)) continue;

    const frozenById = {
      ...frozenTimesForDay(
        frozenTimes,
        dateKey,
        acceptedRoutes?.[dateKey],
        awaitingReply,
        now,
      ),
      ...appointmentFrozenById(
        learners.filter(
          (item) => item.id !== learner.id && hasAppointmentOn(item, dateKey),
        ),
        settings,
      ),
    };
    delete frozenById[learner.id];

    const frozenLearners = Object.keys(frozenById)
      .map((id) => learners.find((item) => item.id === id))
      .filter((item) => item && frozenById[item.id]?.arrive != null)
      .sort((a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive);

    const searchLearner = Number.isFinite(preferArriveMinutes)
      ? {
          ...learner,
          employer: normaliseEmployer(learner.employer)
            ? { ...normaliseEmployer(learner.employer), window: "any" }
            : null,
        }
      : learner;
    const employer = normaliseEmployer(learner.employer);
    const startOptions = [slot.startMinutes];
    if (
      employer?.window === "afternoon" &&
      settings.lunchEnd > slot.startMinutes
    ) {
      startOptions.push(settings.lunchEnd);
    }
    const lockedForExtras = new Map(lockedById);
    lockedForExtras.delete(learner.id);

    for (const startMinutes of startOptions) {
      const daySettings = {
        ...settings,
        startMinutes,
        callMinutes: 0,
      };

      for (let insertAt = 0; insertAt <= frozenLearners.length; insertAt++) {
      const order = [
        ...frozenLearners.slice(0, insertAt),
        searchLearner,
        ...frozenLearners.slice(insertAt),
      ];
      const attempt = packOrderedDay(
        order,
        matrix,
        officeIndex,
        daySettings,
        frozenById,
      );
      const placed = attempt.stops.find((stop) => stop.id === learner.id);
      if (!placed) continue;
      if (
        !Number.isFinite(preferArriveMinutes) &&
        !employerAllowsArrive(learner, placed.arrive, placed.leave, settings)
      ) {
        continue;
      }
      if (!frozenStopsUnchanged([], attempt.stops, frozenById)) continue;
      const frozenStill = frozenLearners.every((item) =>
        attempt.stops.some(
          (stop) =>
            stop.id === item.id &&
            stop.arrive === frozenById[item.id].arrive &&
            stop.leave === frozenById[item.id].leave,
        ),
      );
      if (!frozenStill) continue;

      const taken = new Set(attempt.stops.map((stop) => stop.id));
      const extras = learners.filter(
        (item) =>
          item.id !== learner.id &&
          canVisitOnDay(item, slot, taken, excluded, lockedForExtras, settings),
      );
      const packed = appendFitLearners(
        attempt,
        learnersFromStops(attempt.stops, [...order, ...extras]),
        extras,
        matrix,
        officeIndex,
        daySettings,
        frozenById,
      );
      const stop = packed.stops.find((item) => item.id === learner.id);
      if (!stop) continue;

      const closeness = Number.isFinite(preferArriveMinutes)
        ? -Math.abs(stop.arrive - preferArriveMinutes)
        : -stop.arrive;
      const score = Number.isFinite(preferArriveMinutes)
        ? [
            closeness,
            packed.stops.length,
            -packed.driveTotal,
            -Number(dateKey.replaceAll("-", "")),
          ]
        : [
            packed.stops.length,
            -packed.driveTotal,
            closeness,
            -Number(dateKey.replaceAll("-", "")),
          ];
      let better = !best;
      if (best) {
        for (let index = 0; index < score.length; index++) {
          if (score[index] === best.score[index]) continue;
          better = score[index] > best.score[index];
          break;
        }
      }
      if (better) {
        best = {
          score,
          dateKey,
          day: slot.day,
          date: slot.date,
          arriveMinutes: stop.arrive,
          leaveMinutes: stop.leave,
        };
      }
      }
    }
  }

  return best
    ? {
        dateKey: best.dateKey,
        day: best.day,
        date: best.date,
        arriveMinutes: best.arriveMinutes,
        leaveMinutes: best.leaveMinutes,
      }
    : null;
}

export function planWeek(
  learners,
  matrix,
  officeIndex,
  settings,
  now = new Date(),
  acceptedRoutes = {},
  verifiedByDate = {},
  callAnchors = {},
  pinnedRoutes = {},
  frozenTimes = {},
  excludedFromDate = {},
) {
  const assigned = new Set();
  const appointmentDates = [
    ...new Set(
      learners
        .map((learner) => normaliseAppointment(learner.appointment)?.dateKey)
        .filter(Boolean),
    ),
  ];
  const confirmedDates = Object.entries(verifiedByDate || {})
    .filter(([, ids]) => (ids || []).length)
    .map(([dateKey]) => dateKey);
  const pinnedDates = Object.entries(pinnedRoutes || {})
    .filter(([, ids]) => (ids || []).length)
    .map(([dateKey]) => dateKey);
  const fillDateKey = settings.fillDateKey || "";
  const horizon = planningHorizon(
    now,
    fillDateKey ? { ...settings, workingDates: [fillDateKey] } : settings,
    fillDateKey
      ? []
      : [...appointmentDates, ...confirmedDates, ...pinnedDates],
  );
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const customDates = Boolean(settings.workingDates?.length);
  const horizonKeys = new Set(horizon.map((slot) => toDateKey(slot.date)));
  const nowMinutes = minutesFromMidnight(now);

  const currentAccepted = {};
  for (const [dateKey, route] of Object.entries(acceptedRoutes || {})) {
    if (
      horizonKeys.has(dateKey) &&
      (route?.stops?.length || route?.phoneStops?.length)
    ) {
      currentAccepted[dateKey] = route;
    }
  }

  for (const route of Object.values(currentAccepted)) {
    for (const stop of route.stops) {
      const learner = learners.find((item) => item.id === stop.id);
      if (learner && !isPhoneReview(learner)) assigned.add(stop.id);
    }
  }

  const awaitingReply = settings.awaitingReply || {};
  const lockedById = lockLearnersToDays(
    learners,
    currentAccepted,
    frozenTimes,
    verifiedByDate,
    awaitingReply,
    now,
    pinnedRoutes,
  );

  const hardLocks = lockedById;

  // eslint-disable-next-line no-unused-vars
  for (const [dateKey, ids] of Object.entries(pinnedRoutes || {})) {
    for (const id of ids || []) {
      const learner = learners.find((item) => item.id === id);
      if (!learner || isPhoneReview(learner)) continue;
      if (settings.fillGaps && !hardLocks.has(id)) continue;
      assigned.add(id);
    }
  }

  const days = horizon.map((slot) => {
    const dateKey = toDateKey(slot.date);
    const accepted = currentAccepted[dateKey];
    const verified = verifiedIds(verifiedByDate, dateKey);
    const pinnedIds = pinnedRoutes?.[dateKey];

    if (accepted || pinnedIds?.length) {
      const idOrder = accepted?.stops?.length
        ? accepted.stops.map((stop) => stop.id)
        : pinnedIds || [];
      const ordered = idOrder
        .map((id) => {
          const existing = learners.find((learner) => learner.id === id);
          if (existing) return existing;
          const stop =
            (accepted?.stops || []).find((item) => item.id === id) ||
            (accepted?.phoneStops || []).find((item) => item.id === id);
          if (!stop) return null;
          return {
            id: stop.id,
            name: stop.name,
            company: stop.company,
            postcode: stop.postcode,
            collegeDay: stop.collegeDay,
            lat: stop.lat,
            lon: stop.lon,
            matrixIndex: stop.matrixIndex,
            priority: stop.priority,
            phoneReview: stop.kind === "phone",
            appointment: Number.isFinite(stop.arrive)
              ? { dateKey, arriveMinutes: stop.arrive }
              : null,
          };
        })
        .filter((learner) => {
          if (!learner) return false;
          const lockedDate = lockedById.get(learner.id);
          if (lockedDate && lockedDate !== dateKey) return false;
          return hasAppointmentOn(learner, dateKey) || !isPhoneReview(learner);
        });
      const appointedFrozen = appointmentFrozenById(
        learners.filter((learner) => hasAppointmentOn(learner, dateKey)),
        settings,
      );
      const storedFrozen = frozenTimesForDay(
        frozenTimes,
        dateKey,
        accepted,
        awaitingReply,
        now,
      );
      const frozenById = { ...appointedFrozen };
      for (const [id, freeze] of Object.entries(storedFrozen || {})) {
        const booked = appointedFrozen[id];
        frozenById[id] = {
          ...freeze,
          ...booked,
          booked: Boolean(booked?.booked || freeze?.booked),
        };
      }

      if (!slot.available && !accepted) {
        return {
          ...slot,
          dateKey,
          accepted: false,
          allVerified: false,
          stops: [],
          phoneStops: [],
          returnTravel: 0,
          returnArrive: slot.startMinutes,
          driveTotal: 0,
          reviewCount: 0,
        };
      }

      const phones = claimPhoneReviews(learners, slot, assigned, settings);
      const dayStart = phones.endMinutes;

      let callMinutes = settings.callMinutes || 0;
      let droppedUnverified = false;
      let working = ordered;
      for (const learner of learners) {
        if (working.some((item) => item.id === learner.id)) continue;
        if (
          hasAppointmentOn(learner, dateKey) ||
          frozenById[learner.id]?.arrive != null ||
          verified.has(learner.id)
        ) {
          working.push(learner);
        }
      }
      const excluded = excludedFromDate?.[dateKey] || [];
      const withMates = [];
      const seenMates = new Set();
      for (const learner of working) {
        if (seenMates.has(learner.id)) continue;
        withMates.push(learner);
        seenMates.add(learner.id);
        if (accepted || pinnedIds?.length) continue;
        for (const mate of learners) {
          if (seenMates.has(mate.id)) continue;
          if (!sameWorkplace(learner, mate)) continue;
          if (
            !canVisitOnDay(mate, slot, assigned, excluded, lockedById, settings)
          ) {
            continue;
          }
          withMates.push(mate);
          seenMates.add(mate.id);
        }
      }
      working = withMates;
      const allWorkingVerified =
        Boolean(working.length) &&
        working.every((learner) =>
          isConfirmedLearner(learner, dateKey, verified),
        );
      const allWorkingFrozen =
        allWorkingVerified &&
        working.every((learner) => frozenById[learner.id]?.arrive != null);

      if (allWorkingVerified || allWorkingFrozen || !working.length) {
        callMinutes = 0;
      }

      if (slot.isToday && working.length) {
        const anchor = callAnchors[dateKey] ?? dayStart;
        const callEnd = scheduleOfficeCalls(
          anchor,
          settings.callMinutes || 0,
          settings.lunchStart,
          settings.lunchEnd,
        ).callEnd;
        if (nowMinutes >= callEnd) {
          const kept = working.filter((learner) =>
            isConfirmedLearner(learner, dateKey, verified),
          );
          droppedUnverified = kept.length !== working.length;
          working = kept;
          callMinutes = 0;
        }
      }

      const awaitingIds = Object.entries(awaitingReply?.[dateKey] || {})
        .filter(([, entry]) => isAwaitingActive(entry, dateKey, now))
        .map(([id]) => id);
      const packFrozen =
        (settings.fillGaps || settings.relaxPinTimes) &&
        (!fillDateKey || fillDateKey === dateKey)
          ? bookedFrozenTimes(
              frozenById,
              learners,
              dateKey,
              verified,
              pinnedIds,
              awaitingIds,
              { allowPinMove: Boolean(settings.fillGaps) },
            )
          : frozenById;
      const daySettings = {
        ...settings,
        startMinutes: dayStart,
        callMinutes,
      };
      let planned = packOrderedDay(
        working,
        matrix,
        officeIndex,
        daySettings,
        packFrozen,
        true,
        true,
      );
      const firstPinnedId = working[0]?.id;
      if (
        firstPinnedId &&
        callMinutes &&
        !planned.stops.some((stop) => stop.id === firstPinnedId)
      ) {
        const earlier = packOrderedDay(
          working,
          matrix,
          officeIndex,
          { ...daySettings, callMinutes: 0 },
          packFrozen,
          true,
          true,
        );
        if (earlier.stops.some((stop) => stop.id === firstPinnedId)) {
          planned = earlier;
          callMinutes = 0;
        }
      }

      markBookedStops(planned, packFrozen, learners, dateKey);
      if (
        slot.isToday &&
        callMinutes &&
        !planned.stops.some((stop) => stop.booked) &&
        !planned.stops.every((stop) => isConfirmedStop(stop, verified))
      ) {
        const calls = scheduleOfficeCalls(
          dayStart,
          settings.callMinutes || 0,
          settings.lunchStart,
          settings.lunchEnd,
        );
        planned.callStart = calls.callStart;
        planned.callEnd = calls.callEnd;
        planned.leaveMinutes = calls.leaveMinutes;
      }

      let packed = planned;
      if (
        settings.fillGaps &&
        !accepted &&
        slot.available &&
        (!fillDateKey || fillDateKey === dateKey)
      ) {
        const excluded = excludedFromDate?.[dateKey] || [];
        const packedLearners = packed.stops
          .map((stop) => learners.find((learner) => learner.id === stop.id))
          .filter(Boolean);
        const extras = learners.filter(
          (learner) =>
            allowsGapFill(learner, settings) &&
            canVisitOnDay(
              learner,
              slot,
              assigned,
              excluded,
              hardLocks,
              settings,
            ) &&
            !packedLearners.some((item) => item.id === learner.id),
        );
        packed = appendFillExtras(
          packed,
          packedLearners,
          extras,
          matrix,
          officeIndex,
          {
            ...settings,
            startMinutes: dayStart,
            callMinutes: packedLearners.length ? 0 : callMinutes,
          },
          packFrozen,
          settings,
        );
      }

      for (const learner of working) {
        if (!packed.stops.some((stop) => stop.id === learner.id)) {
          assigned.delete(learner.id);
        }
      }
      packed.stops.forEach((stop) => assigned.add(stop.id));
      packed = markBookedStops(packed, packFrozen, learners, dateKey);
      packed = attachPhones(packed, phones);
      return {
        ...slot,
        dateKey,
        accepted: Boolean(accepted),
        allVerified:
          !packed.stops.length ||
          packed.stops.every((stop) => isConfirmedStop(stop, verified)),
        droppedUnverified,
        ...packed,
      };
    }

    if (!slot.available) {
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: false,
        stops: [],
        phoneStops: [],
        returnTravel: 0,
        returnArrive: slot.startMinutes,
        driveTotal: 0,
        reviewCount: 0,
      };
    }

    const phones = claimPhoneReviews(learners, slot, assigned, settings);
    const dayStart = phones.endMinutes;
    const expiredAwaiting = expiredAwaitingIds(awaitingReply, dateKey, now);
    const excluded = [
      ...(excludedFromDate?.[dateKey] || []),
      ...expiredAwaiting,
    ];
    const pool = learners.filter(
      (learner) =>
        canVisitOnDay(learner, slot, assigned, excluded, lockedById, settings) &&
        (hasAppointmentOn(learner, dateKey) ||
          verified.has(learner.id) ||
          lockedById.get(learner.id) === dateKey),
    );

    const frozenById = {
      ...frozenTimesForDay(frozenTimes, dateKey, null, awaitingReply, now),
      ...appointmentFrozenById(
        learners.filter((learner) => hasAppointmentOn(learner, dateKey)),
        settings,
      ),
    };
    const frozenLearners = Object.keys(frozenById)
      .map((id) => learners.find((learner) => learner.id === id))
      .filter((learner) => learner && frozenById[learner.id]?.arrive != null)
      .sort(
        (a, b) => frozenById[a.id].arrive - frozenById[b.id].arrive,
      );
    for (const id of verified) {
      if (expiredAwaiting.includes(id)) continue;
      if (frozenLearners.some((item) => item.id === id)) continue;
      const learner = learners.find((item) => item.id === id);
      if (learner) frozenLearners.push(learner);
    }

    if (settings.fillGaps || frozenLearners.length) {
      const pinLearners = (pinnedIds || [])
        .map((id) => learners.find((learner) => learner.id === id))
        .filter((learner) => {
          if (!learner) return false;
          if (expiredAwaiting.includes(learner.id)) return false;
          if (frozenLearners.some((item) => item.id === learner.id)) return false;
          const lockedDate = lockedById.get(learner.id);
          if (lockedDate) return lockedDate === dateKey;
          return false;
        });
      const coreById = new Map(
        [...frozenLearners, ...pinLearners].map((learner) => [
          learner.id,
          learner,
        ]),
      );
      const core = [];
      const seen = new Set();
      for (const id of pinnedIds || []) {
        const learner = coreById.get(id);
        if (!learner || seen.has(learner.id)) continue;
        core.push(learner);
        seen.add(learner.id);
      }
      for (const learner of frozenLearners) {
        if (seen.has(learner.id)) continue;
        core.push(learner);
        seen.add(learner.id);
      }
      const holdOrder = frozenLearners.length > 0;
      const clusteredCore = holdOrder
        ? core
        : clusterSameWorkplace(core, frozenById);
      const extras =
        settings.fillGaps && (!fillDateKey || fillDateKey === dateKey)
          ? learners.filter(
              (learner) =>
                allowsGapFill(learner, settings) &&
                canVisitOnDay(learner, slot, assigned, excluded, hardLocks, settings) &&
                !core.some((item) => item.id === learner.id),
            )
          : [];
      const daySettings = {
        ...settings,
        startMinutes: dayStart,
        callMinutes:
          extras.length && !core.every((learner) => frozenById[learner.id]?.arrive != null)
            ? settings.callMinutes || 0
            : core.length && core.every((learner) => frozenById[learner.id]?.arrive != null)
              ? 0
              : extras.length || core.length
                ? settings.callMinutes || 0
                : 0,
      };
      let packed = clusteredCore.length
        ? packOrderedDay(
            clusteredCore,
            matrix,
            officeIndex,
            daySettings,
            frozenById,
            true,
            holdOrder,
          )
        : packWithCalls([], matrix, officeIndex, settings, dayStart, 0);
      if (settings.fillGaps && extras.length) {
        packed = appendFillExtras(
          packed,
          learnersFromStops(packed.stops, clusteredCore),
          extras,
          matrix,
          officeIndex,
          {
            ...daySettings,
            callMinutes: packed.stops.length ? 0 : daySettings.callMinutes,
          },
          frozenById,
          settings,
        );
      }
      packed = markBookedStops(packed, frozenById, learners, dateKey);
      packed.stops.forEach((stop) => assigned.add(stop.id));
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: allStopsVerified(packed.stops, verified),
        ...attachPhones(packed, phones),
      };
    }

    const appointed = pool
      .filter((learner) => hasAppointmentOn(learner, dateKey))
      .sort(
        (a, b) =>
          (a.appointment?.arriveMinutes || 0) -
          (b.appointment?.arriveMinutes || 0),
      );
    const appointmentFrozen = appointmentFrozenById(appointed, settings);
    const extras = pool.filter((learner) => !appointmentFrozen[learner.id]);
    const daySettings = {
      ...settings,
      startMinutes: dayStart,
      callMinutes: pool.length ? settings.callMinutes || 0 : 0,
    };

    if (appointed.length) {
      const frozenById = {
        ...frozenTimesForDay(frozenTimes, dateKey, null, awaitingReply, now),
        ...appointmentFrozen,
      };
      const packed = packAroundAppointments(
        appointed,
        extras,
        matrix,
        officeIndex,
        {
          ...daySettings,
          callMinutes: extras.length ? daySettings.callMinutes : 0,
        },
        frozenById,
      );
      packed.stops.forEach((stop) => assigned.add(stop.id));
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: allStopsVerified(
          packed.stops,
          verifiedIds(verifiedByDate, dateKey),
        ),
        ...attachPhones(packed, phones),
      };
    }

    const withCalls = packWithCalls(
      pool,
      matrix,
      officeIndex,
      settings,
      dayStart,
      pool.length ? settings.callMinutes || 0 : 0,
    );

    if (!withCalls.stops.length) {
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: true,
        ...attachPhones(withCalls, phones),
      };
    }

    if (allStopsVerified(withCalls.stops, verified)) {
      const keep = withCalls.stops
        .map((stop) => pool.find((learner) => learner.id === stop.id))
        .filter(Boolean);
      const frozenById = frozenTimesForDay(
        frozenTimes,
        dateKey,
        null,
        awaitingReply,
        now,
      );
      const allFrozen = keep.every(
        (learner) => frozenById[learner.id]?.arrive != null,
      );
      const ready = packOrderedDay(
        keep,
        matrix,
        officeIndex,
        {
          ...settings,
          startMinutes: dayStart,
          callMinutes: allFrozen ? 0 : settings.callMinutes || 0,
        },
        frozenById,
        true,
      );
      ready.stops.forEach((stop) => assigned.add(stop.id));
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: true,
        ...attachPhones(ready, phones),
      };
    }

    if (slot.isToday) {
      const anchor = callAnchors[dateKey] ?? dayStart;
      const calls = scheduleOfficeCalls(
        anchor,
        settings.callMinutes || 0,
        settings.lunchStart,
        settings.lunchEnd,
      );
      const callEnd = calls.callEnd;
      if (nowMinutes >= callEnd) {
        const keep = withCalls.stops
          .map((stop) => pool.find((learner) => learner.id === stop.id))
          .filter((learner) => learner && isConfirmedLearner(learner, dateKey, verified));
        const remaining = packOrderedDay(
          keep,
          matrix,
          officeIndex,
          {
            ...settings,
            startMinutes: dayStart,
            callMinutes: 0,
          },
          frozenTimesForDay(frozenTimes, dateKey, null, awaitingReply, now),
          true,
        );
        remaining.stops.forEach((stop) => assigned.add(stop.id));
        return {
          ...slot,
          dateKey,
          accepted: false,
          allVerified: allStopsVerified(remaining.stops, verified),
          droppedUnverified: true,
          ...attachPhones(remaining, phones),
        };
      }

      withCalls.stops.forEach((stop) => assigned.add(stop.id));
      return {
        ...slot,
        dateKey,
        accepted: false,
        allVerified: false,
        callAnchor: anchor,
        ...attachPhones(withCalls, phones),
        callStart: calls.callStart,
        callEnd: calls.callEnd,
        leaveMinutes: calls.leaveMinutes,
      };
    }

    withCalls.stops.forEach((stop) => assigned.add(stop.id));
    return {
      ...slot,
      dateKey,
      accepted: false,
      allVerified: false,
      ...attachPhones(withCalls, phones),
    };
  });

  const leftover = learners.filter((learner) => !assigned.has(learner.id));
  return { days, leftover, weekend: weekend && !customDates, customDates };
}
