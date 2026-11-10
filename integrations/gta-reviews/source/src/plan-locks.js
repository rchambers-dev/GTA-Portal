const PLAN_LOCK_BUCKETS = [
  "acceptedRoutes",
  "verifiedByDate",
  "pinnedRoutes",
  "frozenTimes",
  "callAnchors",
  "completedRoutes",
  "awaitingReply",
  "excludedFromDate",
];

function stampValue(value) {
  return Date.parse(value || "") || 0;
}

function mergeStampMap(incoming, existing) {
  const next = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
  for (const [id, stamp] of Object.entries(existing && typeof existing === "object" ? existing : {})) {
    if (stampValue(stamp) > stampValue(next[id])) next[id] = stamp;
  }
  return next;
}

function pickAwaitingEntry(incomingEntry, existingEntry, clearedAt) {
  const incomingLock = stampValue(incomingEntry?.lockedAt);
  const existingLock = stampValue(existingEntry?.lockedAt);
  const entry =
    incomingEntry && existingEntry
      ? incomingLock >= existingLock
        ? incomingEntry
        : existingEntry
      : incomingEntry || existingEntry;
  if (!entry) return null;
  const lockAt = stampValue(entry.lockedAt);
  const clearAt = stampValue(clearedAt);
  if (clearAt && clearAt >= lockAt) return null;
  return entry;
}

function learnerHasUpcomingBooking(learner, today) {
  const booked = String(learner?.appointment?.dateKey || "").trim();
  return Boolean(booked && booked >= today);
}

function mergeAwaitingReply(incoming, existing, today) {
  incoming.awaitingClearedAt = mergeStampMap(
    incoming.awaitingClearedAt,
    existing.awaitingClearedAt,
  );
  const incomingBucket =
    incoming.awaitingReply && typeof incoming.awaitingReply === "object"
      ? incoming.awaitingReply
      : {};
  const existingBucket =
    existing.awaitingReply && typeof existing.awaitingReply === "object"
      ? existing.awaitingReply
      : {};
  incoming.awaitingReply = incomingBucket;
  const dates = new Set([...Object.keys(incomingBucket), ...Object.keys(existingBucket)]);
  for (const dateKey of dates) {
    if (!dateKey || dateKey < today) {
      delete incomingBucket[dateKey];
      continue;
    }
    const incomingDate =
      incomingBucket[dateKey] && typeof incomingBucket[dateKey] === "object"
        ? incomingBucket[dateKey]
        : {};
    const existingDate =
      existingBucket[dateKey] && typeof existingBucket[dateKey] === "object"
        ? existingBucket[dateKey]
        : {};
    const next = {};
    for (const id of new Set([...Object.keys(incomingDate), ...Object.keys(existingDate)])) {
      const learner =
        (incoming.learners || []).find((item) => item.id === id) ||
        (incoming.followUps || []).find((item) => item.id === id);
      if (learnerHasUpcomingBooking(learner, today)) continue;
      const verifiedAhead = Object.entries(incoming.verifiedByDate || {}).some(
        ([key, ids]) => key >= today && (ids || []).includes(id),
      );
      const excluded = (incoming.excludedFromDate?.[dateKey] || []).includes(id);
      if (verifiedAhead || excluded) continue;
      const picked = pickAwaitingEntry(
        incomingDate[id],
        existingDate[id],
        incoming.awaitingClearedAt?.[id],
      );
      if (picked) next[id] = picked;
    }
    if (Object.keys(next).length) incomingBucket[dateKey] = next;
    else delete incomingBucket[dateKey];
  }
}

export function localDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasLockValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function learnerById(state, id) {
  return (
    (state?.learners || []).find((item) => item?.id === id) ||
    (state?.followUps || []).find((item) => item?.id === id) ||
    (state?.archive || []).find((item) => item?.id === id) ||
    null
  );
}

function frozenDayWithoutStaleBookings(times, state, dateKey) {
  const next = {};
  for (const [id, freeze] of Object.entries(times || {})) {
    if (!freeze || typeof freeze !== "object") continue;
    const appointed = String(learnerById(state, id)?.appointment?.dateKey || "") === dateKey;
    next[id] = appointed ? { ...freeze } : { ...freeze, booked: false };
  }
  return next;
}

export function mergePreservedPlanLocks(incoming, existing, now = new Date()) {
  if (!incoming || !existing) return incoming;
  const today = localDateKey(now);
  mergeAwaitingReply(incoming, existing, today);
  for (const bucket of PLAN_LOCK_BUCKETS) {
    if (bucket === "awaitingReply") continue;
    const from = existing[bucket];
    if (!from || typeof from !== "object" || Array.isArray(from)) continue;
    if (!incoming[bucket] || typeof incoming[bucket] !== "object" || Array.isArray(incoming[bucket])) {
      incoming[bucket] = {};
    }
    for (const dateKey of Object.keys(from)) {
      if (!dateKey || dateKey < today) continue;
      if (hasLockValue(from[dateKey]) && !hasLockValue(incoming[bucket][dateKey])) {
        if (bucket === "pinnedRoutes") {
          const excluded = new Set(incoming.excludedFromDate?.[dateKey] || []);
          const kept = (Array.isArray(from[dateKey]) ? from[dateKey] : []).filter(
            (id) => id && !excluded.has(id),
          );
          if (kept.length) incoming[bucket][dateKey] = kept;
        } else {
          incoming[bucket][dateKey] =
            bucket === "frozenTimes"
              ? frozenDayWithoutStaleBookings(from[dateKey], incoming, dateKey)
              : from[dateKey];
        }
      }
      if (bucket === "pinnedRoutes") {
        const incomingIds = Array.isArray(incoming[bucket][dateKey]) ? incoming[bucket][dateKey] : [];
        const existingIds = Array.isArray(from[dateKey]) ? from[dateKey] : [];
        const excluded = new Set(incoming.excludedFromDate?.[dateKey] || []);
        const kept = [];
        const source = incomingIds.length ? incomingIds : existingIds;
        for (const id of source) {
          if (!id || kept.includes(id)) continue;
          if (!incomingIds.includes(id) && excluded.has(id)) continue;
          const learner =
            (incoming.learners || []).find((item) => item.id === id) ||
            (incoming.followUps || []).find((item) => item.id === id);
          const booked = String(learner?.appointment?.dateKey || "").trim();
          if (booked && booked >= today && booked !== dateKey) continue;
          kept.push(id);
        }
        if (kept.length) incoming[bucket][dateKey] = kept;
        else delete incoming[bucket][dateKey];
      }
    }
  }
  return incoming;
}

function learnerStamp(learner) {
  return Date.parse(learner?.updatedAt || "") || 0;
}

function hasAppointment(learner) {
  const appointment = learner?.appointment;
  return Boolean(
    appointment &&
      String(appointment.dateKey || "").trim() &&
      Number.isFinite(Number(appointment.arriveMinutes)),
  );
}

export function writeLearnerAppointment(learner, appointment, now = new Date()) {
  if (!learner) return learner;
  const stamp = now.toISOString();
  if (appointment) {
    learner.appointment = appointment;
    learner.appointmentAt = stamp;
    learner.appointmentClearedAt = "";
  } else {
    learner.appointment = null;
    learner.appointmentClearedAt = stamp;
  }
  return learner;
}

function appointmentBookedAt(learner) {
  return stampValue(learner?.appointmentAt) || (hasAppointment(learner) ? learnerStamp(learner) : 0);
}

function pickAppointment(incoming, existing) {
  const incomingBooked = hasAppointment(incoming);
  const existingBooked = hasAppointment(existing);
  const incomingBookAt = stampValue(incoming?.appointmentAt);
  const existingBookAt = stampValue(existing?.appointmentAt);
  const incomingClearAt = stampValue(incoming?.appointmentClearedAt);
  const existingClearAt = stampValue(existing?.appointmentClearedAt);

  if (incomingBooked && existingBooked) {
    if (incomingBookAt && existingBookAt) {
      return incomingBookAt >= existingBookAt ? incoming.appointment : existing.appointment;
    }
    if (existingBookAt && !incomingBookAt) return existing.appointment;
    if (incomingBookAt && !existingBookAt) return incoming.appointment;
    return learnerStamp(incoming) >= learnerStamp(existing)
      ? incoming.appointment
      : existing.appointment;
  }
  if (incomingBooked && !existingBooked) {
    if (existingClearAt && existingClearAt > (incomingBookAt || appointmentBookedAt(incoming))) {
      return null;
    }
    return incoming.appointment;
  }
  if (!incomingBooked && existingBooked) {
    if (incomingClearAt && incomingClearAt > (existingBookAt || appointmentBookedAt(existing))) {
      return null;
    }
    return existing.appointment;
  }
  return null;
}

function pickAppointmentMeta(incoming, existing, appointment) {
  if (appointment) {
    const incomingMatch =
      hasAppointment(incoming) &&
      incoming.appointment?.dateKey === appointment.dateKey &&
      Number(incoming.appointment?.arriveMinutes) === Number(appointment.arriveMinutes);
    const source = incomingMatch ? incoming : existing;
    return {
      appointmentAt: source?.appointmentAt || source?.updatedAt || "",
      appointmentClearedAt: "",
    };
  }
  const incomingClearAt = stampValue(incoming?.appointmentClearedAt);
  const existingClearAt = stampValue(existing?.appointmentClearedAt);
  return {
    appointmentAt: "",
    appointmentClearedAt:
      incomingClearAt >= existingClearAt
        ? incoming?.appointmentClearedAt || existing?.appointmentClearedAt || ""
        : existing?.appointmentClearedAt || incoming?.appointmentClearedAt || "",
  };
}

function mergeOneLearner(incoming, existing) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const incomingTime = learnerStamp(incoming);
  const existingTime = learnerStamp(existing);
  const base = existingTime && existingTime > incomingTime ? existing : incoming;
  const appointment = pickAppointment(incoming, existing);
  const signed =
    base.safeguardingSigned != null
      ? Boolean(base.safeguardingSigned)
      : Boolean(incoming.safeguardingSigned) || Boolean(existing.safeguardingSigned);
  return {
    ...base,
    safeguardingSigned: signed,
    appointment,
    ...pickAppointmentMeta(incoming, existing, appointment),
  };
}

function mergePeopleList(incomingList = [], existingList = []) {
  const existingById = new Map(
    (existingList || []).filter((item) => item?.id).map((item) => [item.id, item]),
  );
  return (incomingList || []).map((item) =>
    mergeOneLearner(item, existingById.get(item.id)),
  );
}

function knownLearnerIds(state) {
  const ids = new Set();
  for (const list of [state?.learners, state?.followUps, state?.archive]) {
    for (const item of list || []) if (item?.id) ids.add(item.id);
  }
  return ids;
}

function withPeopleOnlyOnOtherSide(incomingList, existingList, known, removed) {
  const next = [...(incomingList || [])];
  for (const item of existingList || []) {
    if (!item?.id || known.has(item.id) || removed?.has(item.id)) continue;
    known.add(item.id);
    next.push(item);
  }
  return next;
}

// Someone in the last acknowledged copy, and in none of this tab's lists, was
// removed here. The browser or SQLite copy must not put them back. Someone
// who was never acknowledged is still a new local-only person.
function removedSinceAck(base, incoming) {
  const removed = new Set();
  if (!base) return removed;
  const still = knownLearnerIds(incoming);
  for (const list of [base.learners, base.followUps, base.archive]) {
    for (const item of list || []) {
      if (item?.id && !still.has(item.id)) removed.add(item.id);
    }
  }
  return removed;
}

export function applyNewerPlanSnapshot(state, newer) {
  if (!state || !newer) return state;
  mergeLearnerRecords(state, newer);
  for (const bucket of PLAN_LOCK_BUCKETS) {
    if (!newer[bucket] || typeof newer[bucket] !== "object") continue;
    state[bucket] = newer[bucket];
  }
  return state;
}

const PEOPLE_LISTS = ["learners", "followUps", "archive"];

function findPerson(state, id) {
  for (const list of PEOPLE_LISTS) {
    const found = (state?.[list] || []).find((item) => item?.id === id);
    if (found) return { list, item: found };
  }
  return null;
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function personChanged(left, right) {
  if (!left && !right) return false;
  if (!left || !right) return true;
  return left.list !== right.list || !sameJson(left.item, right.item);
}

const SKIP_TOP_LEVEL = new Set(["version", "savedAt", "baseSavedAt", ...PEOPLE_LISTS]);

// Re-apply only the fields that differ from the last acknowledged copy.
// A field the server also changed stays as the server has it. A person the
// server deleted is not brought back. Every other top-level key, including
// saved reviews and visit days, uses the same three-way rule.
function peopleBucket(state, list) {
  if (!Array.isArray(state[list])) state[list] = [];
  return state[list];
}

function mergePersonFields(baseItem, localItem, serverItem, conflicts, id) {
  const next = JSON.parse(JSON.stringify(serverItem || {}));
  const keys = new Set([
    ...Object.keys(baseItem || {}),
    ...Object.keys(localItem || {}),
    ...Object.keys(serverItem || {}),
  ]);
  for (const key of keys) {
    const baseValue = baseItem ? baseItem[key] : undefined;
    const localValue = localItem ? localItem[key] : undefined;
    const serverValue = serverItem ? serverItem[key] : undefined;
    if (sameJson(baseValue, localValue) || sameJson(localValue, serverValue)) continue;
    if (!sameJson(baseValue, serverValue)) {
      conflicts.push(`${id}.${key}`);
      continue;
    }
    if (localValue === undefined) delete next[key];
    else next[key] = JSON.parse(JSON.stringify(localValue));
  }
  return next;
}

function placePerson(next, id, list, item) {
  const copy = JSON.parse(JSON.stringify(item));
  for (const name of PEOPLE_LISTS) {
    if (name === list || !Array.isArray(next[name])) continue;
    next[name] = next[name].filter((entry) => entry?.id !== id);
  }
  const bucket = peopleBucket(next, list);
  const index = bucket.findIndex((entry) => entry?.id === id);
  if (index === -1) bucket.push(copy);
  else bucket[index] = copy;
}

export function reapplyPendingOnServer(server, local, base) {
  const next = JSON.parse(JSON.stringify(server || {}));
  const conflicts = [];
  if (!base) return { state: next, conflicts: ["missing-base"] };
  const ids = new Set();
  for (const list of PEOPLE_LISTS) {
    for (const item of [...(base[list] || []), ...(local?.[list] || []), ...(server?.[list] || [])]) {
      if (item?.id) ids.add(item.id);
    }
  }
  for (const id of ids) {
    const basePerson = findPerson(base, id);
    const localPerson = findPerson(local, id);
    const serverPerson = findPerson(server, id);
    if (!personChanged(basePerson, localPerson)) continue;
    if (basePerson && !serverPerson) {
      conflicts.push(id);
      continue;
    }
    if (!localPerson) {
      if (serverPerson && personChanged(basePerson, serverPerson)) {
        conflicts.push(id);
        continue;
      }
      if (serverPerson && Array.isArray(next[serverPerson.list])) {
        next[serverPerson.list] = next[serverPerson.list].filter((item) => item?.id !== id);
      }
      continue;
    }
    let list = serverPerson ? serverPerson.list : localPerson.list;
    if (serverPerson && serverPerson.list !== localPerson.list) {
      const baseList = basePerson ? basePerson.list : serverPerson.list;
      if (serverPerson.list === baseList) list = localPerson.list;
      else {
        conflicts.push(`${id}.list`);
        list = serverPerson.list;
      }
    }
    const merged = mergePersonFields(
      basePerson?.item,
      localPerson.item,
      serverPerson?.item,
      conflicts,
      id,
    );
    placePerson(next, id, list, merged);
  }
  const keys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(server || {}),
  ]);
  for (const key of keys) {
    if (SKIP_TOP_LEVEL.has(key)) continue;
    if (sameJson(base[key], local?.[key])) continue;
    if (!sameJson(base[key], server?.[key]) && !sameJson(local?.[key], server?.[key])) {
      conflicts.push(key);
      continue;
    }
    if (sameJson(base[key], server?.[key])) {
      if (local?.[key] === undefined) delete next[key];
      else next[key] = JSON.parse(JSON.stringify(local[key]));
    }
  }
  if (Number(server?.version) > 0) next.version = Number(server.version);
  if (server?.savedAt) next.savedAt = server.savedAt;
  return { state: next, conflicts };
}

export function mergeLearnerRecords(incoming, existing, base) {
  if (!incoming || !existing) return incoming;
  const known = knownLearnerIds(incoming);
  const removed = removedSinceAck(base, incoming);
  incoming.learners = withPeopleOnlyOnOtherSide(
    mergePeopleList(incoming.learners, existing.learners),
    existing.learners,
    known,
    removed,
  );
  incoming.followUps = withPeopleOnlyOnOtherSide(
    mergePeopleList(incoming.followUps, existing.followUps),
    existing.followUps,
    known,
    removed,
  );
  incoming.archive = withPeopleOnlyOnOtherSide(
    mergePeopleList(incoming.archive, existing.archive),
    existing.archive,
    known,
    removed,
  );
  return incoming;
}
