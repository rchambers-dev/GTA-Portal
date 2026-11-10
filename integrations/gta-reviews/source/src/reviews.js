import { PDFDocument } from "pdf-lib";
import {
  addDays,
  dateFromKey,
  formatWeeksAndDays,
  lastReviewDateKey,
  learnerProfileFrom,
  nextReviewDateKey,
  normaliseAppointment,
  readAppointment,
  normaliseAttachment,
  normaliseAttended,
  normaliseDateKey,
  reviewDueStatus,
  reviewIntervalWeeks,
  REVIEW_INTERVAL_WEEKS,
  startOfLocalDay,
  toDateKey,
  TUTOR_NOTICE_WEEKS,
} from "./planner.js";
import {
  addWeeksToDateKey,
  dateKeyFromIso,
  daysBetweenDateKeys,
  parseFormDate,
} from "./lib/dates.js";
import { allLearners } from "./lib/learners.js";

export { parseFormDate };

export const REVIEW_HOLDERS = [
  {
    id: "reviewer",
    label: "To release",
    detail: "Pre-filled, not released yet",
  },
  {
    id: "tutor",
    label: "With tutor",
    detail: "Waiting to come back",
  },
  {
    id: "returned",
    label: "Back with you",
    detail: "Ready to print",
  },
  {
    id: "print",
    label: "Upload review",
    detail: "Visit done — scan the form in",
  },
  {
    id: "completed",
    label: "Done",
    detail: "Scanned in after the visit",
  },
];

export function reviewHolderMeta(status) {
  return (
    REVIEW_HOLDERS.find((item) => item.id === status) || REVIEW_HOLDERS[0]
  );
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const REVIEW_TARGET_SLOTS = 3;

export const TUTOR_PROGRESS_ROWS = [
  { id: "overall_progress", label: "Overall progress" },
  { id: "knowledge_theory", label: "Knowledge / theory" },
  { id: "practical_skills", label: "Practical skills" },
  { id: "behaviours_attendance", label: "Behaviours and attendance" },
  {
    id: "english_maths",
    label: "English and maths",
    naComment:
      "English and maths are not applicable to this apprentice at this review. Functional skills are not part of this apprenticeship standard, so no extra English or maths work is required this cycle. I am marking this not applicable unless the standard or funding rules change before the next review. No catch-up plan is needed from me at this visit.",
  },
  { id: "off_the_job", label: "Off-the-job training" },
  {
    id: "epa_gateway",
    label: "EPA / gateway",
    naComment:
      "The apprentice is not yet close to EPA or gateway, so this is not applicable at this review. Portfolio evidence is still being gathered, there is no planned gateway date this cycle, and signed-off work is only just starting to build. Keep collecting workplace evidence and review how close they are again at the next visit. No EPA booking is needed yet.",
  },
];

export const TUTOR_FIELD_LIMITS = {
  previousSummary: { words: 65 },
  previousAction: { words: 38 },
  previousMeasure: { words: 47 },
  newAction: { words: 38 },
  newMeasure: { words: 47 },
  progressEvidence: { words: 90 },
  progressActionRef: { words: 15 },
  tutorComment: { words: 400 },
};

export function countWords(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function clipToTutorLimit(value, limit) {
  let text = String(value ?? "");
  if (!limit) return text;
  if (limit.chars && text.length > limit.chars) text = text.slice(0, limit.chars);
  if (limit.words && countWords(text) > limit.words) {
    text = text.trim().split(/\s+/).slice(0, limit.words).join(" ");
  }
  return text;
}

export function parseOtjHours(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const hours = Number(text);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return hours;
}

export function formatOtjHours(value) {
  const hours = parseOtjHours(value);
  if (hours == null) return "";
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}

export function otjTrackFromHours(targetHours, currentHours) {
  const target = parseOtjHours(targetHours);
  const current = parseOtjHours(currentHours);
  if (target == null || current == null) {
    return {
      rag: "",
      label: "Waiting for hours",
      detail: "Add the target and what they are at now.",
      percent: 0,
      bar: 0,
    };
  }
  if (target === 0) {
    return {
      rag: "",
      label: "Target needed",
      detail: "Target hours must be more than 0.",
      percent: 0,
      bar: 0,
    };
  }
  const ratio = current / target;
  const percent = Math.round(ratio * 100);
  const bar = Math.max(6, Math.min(100, percent));
  const detail = `${formatOtjHours(current)} of ${formatOtjHours(target)} hours · ${percent}%`;
  if (ratio < 0.8) return { rag: "red", label: "Behind track", detail, percent, bar };
  if (ratio < 0.95) return { rag: "amber", label: "Slightly behind", detail, percent, bar };
  if (ratio < 1.2) return { rag: "green", label: "On track", detail, percent, bar };
  return { rag: "blue", label: "Well ahead", detail, percent, bar };
}

export function otjHoursPdfNote(row) {
  const target = formatOtjHours(row?.targetHours);
  const current = formatOtjHours(row?.currentHours);
  if (!target || !current) return "";
  const track = otjTrackFromHours(target, current);
  return `OTJ hours: ${current} / ${target} — ${track.label} (${track.percent}%).`;
}

export function emptyTutorForm() {
  return {
    previousSummary: "",
    apprenticeComment: "",
    employerComment: "",
    tutorComment: "",
    reviewerComment: "",
    agreedSummary: "",
    differingViews: "",
    progress: TUTOR_PROGRESS_ROWS.map((row) => ({
      id: row.id,
      evidence: "",
      actionRef: "",
      rag: "",
      targetHours: "",
      currentHours: "",
    })),
  };
}

export function normaliseTutorForm(value) {
  const base = emptyTutorForm();
  if (!value || typeof value !== "object") return base;
  const progressById = new Map(
    (Array.isArray(value.progress) ? value.progress : []).map((row) => [row.id, row]),
  );
  return {
    previousSummary: String(value.previousSummary || "").trim(),
    apprenticeComment: String(value.apprenticeComment || "").trim(),
    employerComment: String(value.employerComment || "").trim(),
    tutorComment: String(value.tutorComment || "").trim(),
    reviewerComment: String(value.reviewerComment || "").trim(),
    agreedSummary: String(value.agreedSummary || "").trim(),
    differingViews: String(value.differingViews || "").trim(),
    progress: TUTOR_PROGRESS_ROWS.map((row) => {
      const current = progressById.get(row.id) || {};
      const targetHours = row.id === "off_the_job" ? formatOtjHours(current.targetHours) : "";
      const currentHours = row.id === "off_the_job" ? formatOtjHours(current.currentHours) : "";
      const tracked = row.id === "off_the_job" ? otjTrackFromHours(targetHours, currentHours) : null;
      const rag = tracked?.rag
        || (["red", "amber", "green", "na", "blue"].includes(current.rag) ? current.rag : "");
      return {
        id: row.id,
        evidence: String(current.evidence || "").trim(),
        actionRef: String(current.actionRef || "").trim(),
        rag,
        targetHours,
        currentHours,
      };
    }),
  };
}

export function emptyTarget() {
  return {
    id: newId(),
    action: "",
    owner: "",
    measure: "",
    targetDate: "",
    status: "open",
  };
}

export function padTargets(targets = [], slots = REVIEW_TARGET_SLOTS) {
  const rows = (Array.isArray(targets) ? targets : [])
    .map(normaliseTarget)
    .slice(0, slots);
  while (rows.length < slots) rows.push(emptyTarget());
  return rows;
}

export function normaliseTarget(value) {
  if (!value || typeof value !== "object") return emptyTarget();
  const status = ["open", "met", "partly", "not-met", "carry-forward"].includes(
    value.status,
  )
    ? value.status
    : "open";
  return {
    id: String(value.id || newId()),
    action: String(value.action || "").trim(),
    owner: String(value.owner || "").trim(),
    measure: String(value.measure || "").trim(),
    targetDate: String(value.targetDate || "").trim(),
    status,
  };
}

export function normaliseSavedReview(value) {
  if (!value || typeof value !== "object") return null;
  const status = REVIEW_HOLDERS.some((item) => item.id === value.status)
    ? value.status
    : "reviewer";
  const previousTargets = Array.isArray(value.previousTargets)
    ? value.previousTargets.map(normaliseTarget)
    : [];
  const newTargets = Array.isArray(value.newTargets)
    ? value.newTargets.map(normaliseTarget)
    : [];
  return {
    id: String(value.id || newId()),
    learnerId: String(value.learnerId || ""),
    dateKey: String(value.dateKey || ""),
    status,
    createdAt: value.createdAt || new Date().toISOString(),
    sentAt: value.sentAt || "",
    returnedAt: value.returnedAt || "",
    bookedAt: value.bookedAt || "",
    printedAt: value.printedAt || "",
    completedAt: value.completedAt || "",
    archivedAt: value.archivedAt || "",
    visitDateKey: String(value.visitDateKey || ""),
    previousDateKey: String(value.previousDateKey || ""),
    attended: normaliseAttended(value.attended),
    isInitial: Boolean(value.isInitial),
    previousTargets: previousTargets.slice(0, REVIEW_TARGET_SLOTS),
    newTargets: padTargets(newTargets),
    notes: String(value.notes || ""),
    reviewerNotes: String(value.reviewerNotes || value.notes || ""),
    tutorForm: normaliseTutorForm(value.tutorForm),
    signatures: {
      apprentice: String(value.signatures?.apprentice || "").startsWith("data:image/")
        ? String(value.signatures.apprentice)
        : "",
      employer: String(value.signatures?.employer || "").startsWith("data:image/")
        ? String(value.signatures.employer)
        : "",
      reviewer: String(value.signatures?.reviewer || "").startsWith("data:image/")
        ? String(value.signatures.reviewer)
        : "",
    },
    source: String(value.source || "plan"),
    attachment: normaliseAttachment(value.attachment),
    previousAttachment: normaliseAttachment(value.previousAttachment),
    returnedAttachment: normaliseAttachment(value.returnedAttachment),
  };
}

export function normaliseSavedReviews(value) {
  return (Array.isArray(value) ? value : [])
    .map(normaliseSavedReview)
    .filter((item) => item?.learnerId && item.dateKey);
}

export function plannedReviewSlots(state) {
  const slots = new Map();
  const add = (learnerId, dateKey, source) => {
    if (!learnerId || !dateKey) return;
    const key = `${learnerId}:${dateKey}`;
    if (!slots.has(key)) slots.set(key, { learnerId, dateKey, source });
  };
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    for (const id of ids || []) add(id, dateKey, "plan");
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    for (const id of ids || []) add(id, dateKey, "verified");
  }
  for (const learner of allLearners(state)) {
    const booked = normaliseAppointment(learner.appointment);
    if (booked?.dateKey) add(learner.id, booked.dateKey, "booked");
  }
  return [...slots.values()].sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || a.learnerId.localeCompare(b.learnerId),
  );
}

export function findSavedReview(state, learnerId, dateKey) {
  return (state.savedReviews || []).find(
    (item) => item.learnerId === learnerId && item.dateKey === dateKey,
  );
}

export function previousSavedReview(state, learnerId, beforeDateKey) {
  return (state.savedReviews || [])
    .filter(
      (item) =>
        item.learnerId === learnerId &&
        item.dateKey &&
        (!beforeDateKey || item.dateKey < beforeDateKey),
    )
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null;
}

function carryForwardTargets(previous) {
  if (!previous) return [];
  const pool = [...(previous.previousTargets || []), ...(previous.newTargets || [])];
  const seen = new Set();
  const rows = [];
  for (const item of pool) {
    const key = String(item.action || "").trim().toLowerCase();
    if (!key || item.status === "met" || seen.has(key)) continue;
    seen.add(key);
    rows.push(
      normaliseTarget({
        ...item,
        id: newId(),
        status: "open",
      }),
    );
    if (rows.length >= REVIEW_TARGET_SLOTS) break;
  }
  return rows;
}

function packHasTargets(targets) {
  return (targets || []).some((item) => item.action);
}

export function rememberOpenTargets(learner, review) {
  if (!learner) return;
  const open = [...(review?.previousTargets || []), ...(review?.newTargets || [])]
    .filter((item) => item.action && item.status !== "met")
    .map((item) =>
      normaliseTarget({
        ...item,
        status: item.status === "not-met" ? "not-met" : "open",
      }),
    );
  learner.lastReviewTargets = open;
}

function previousSourceForCarry(state, learnerId, dateKey) {
  const previous = previousSavedReview(state, learnerId, dateKey);
  if (
    previous &&
    packHasTargets([...(previous.previousTargets || []), ...(previous.newTargets || [])])
  ) {
    return previous;
  }
  const learner = reviewLearner(state, learnerId);
  const current = findSavedReview(state, learnerId, dateKey);
  if (current && !previous) return previous || null;
  const alreadyOnThisPack = new Set(
    [...(current?.previousTargets || []), ...(current?.newTargets || [])]
      .map((item) => String(item.action || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const remembered = (learner?.lastReviewTargets || []).filter((item) => {
    const key = String(item.action || "").trim().toLowerCase();
    return key && !alreadyOnThisPack.has(key);
  });
  const last = lastReviewDateKey(learner);
  if (!remembered.length || !last || !dateKey || dateKey <= last) {
    return previous || null;
  }
  return {
    previousTargets: [],
    newTargets: remembered,
  };
}

function syncCarriedTargetsOnto(state, pack) {
  if (!pack) return pack;
  const previous = previousSourceForCarry(state, pack.learnerId, pack.dateKey);
  pack.isInitial = !previous;
  if (!previous) return pack;
  if (!packHasTargets(pack.previousTargets)) {
    pack.previousTargets = carryForwardTargets(previous);
  }
  return pack;
}

export function createSavedReview(state, { learnerId, dateKey, source = "plan" }) {
  const existing = findSavedReview(state, learnerId, dateKey);
  if (existing) {
    syncCarriedTargetsOnto(state, existing);
    return { review: existing, created: false };
  }
  const previous = previousSourceForCarry(state, learnerId, dateKey);
  const review = normaliseSavedReview({
    id: newId(),
    learnerId,
    dateKey,
    status: "reviewer",
    createdAt: new Date().toISOString(),
    isInitial: !previous,
    previousTargets: carryForwardTargets(previous),
    newTargets: padTargets([]),
    source,
  });
  state.savedReviews = [...(state.savedReviews || []), review];
  return { review, created: true };
}

function dropSelfCopiedPreviousTargets(state, pack) {
  if (!pack || previousSavedReview(state, pack.learnerId, pack.dateKey)) return false;
  const newKeys = new Set(
    (pack.newTargets || [])
      .map((item) => String(item.action || "").trim().toLowerCase())
      .filter(Boolean),
  );
  if (!newKeys.size) return false;
  const before = (pack.previousTargets || []).length;
  pack.previousTargets = (pack.previousTargets || []).filter(
    (item) => !newKeys.has(String(item.action || "").trim().toLowerCase()),
  );
  return (pack.previousTargets || []).length !== before;
}

export function refreshCarriedTargets(state, learnerId) {
  let changed = false;
  const packs = (state.savedReviews || [])
    .filter((item) => item.learnerId === learnerId)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  packs.forEach((pack) => {
    const previous = previousSourceForCarry(state, learnerId, pack.dateKey);
    pack.isInitial = !previous;
    if (pack.isInitial && packHasTargets(pack.previousTargets)) {
      pack.previousTargets = [];
      changed = true;
    } else if (previous && !packHasTargets(pack.previousTargets)) {
      pack.previousTargets = carryForwardTargets(previous);
      changed = true;
    }
    if (dropSelfCopiedPreviousTargets(state, pack)) changed = true;
  });
  return changed;
}

export function refreshAllCarriedTargets(state) {
  const ids = new Set((state.savedReviews || []).map((item) => item.learnerId));
  for (const learnerId of ids) refreshCarriedTargets(state, learnerId);
}

export function saveReviewsFromPlan(state) {
  let created = 0;
  for (const slot of plannedReviewSlots(state)) {
    if (createSavedReview(state, slot).created) created += 1;
  }
  refreshAllCarriedTargets(state);
  return created;
}

export function updateSavedReview(state, reviewId, patch) {
  state.savedReviews = (state.savedReviews || []).map((item) =>
    item.id === reviewId ? normaliseSavedReview({ ...item, ...patch }) : item,
  );
  return (state.savedReviews || []).find((item) => item.id === reviewId) || null;
}

export function setReviewHolder(state, reviewId, status) {
  const current = (state.savedReviews || []).find((item) => item.id === reviewId);
  const now = new Date().toISOString();
  const learner = reviewLearner(state, current?.learnerId);
  const patch = { status };
  if (status === "tutor") {
    const releaseKey = cycleReleaseDateKey(learner);
    if (releaseKey) patch.sentAt = releaseKey;
    else if (!current?.sentAt) patch.sentAt = now;
  }
  if (status === "returned" && !current?.returnedAt) patch.returnedAt = now;
  if (status === "print" && !current?.printedAt) patch.printedAt = now;
  if (status === "completed") {
    if (!current?.completedAt) patch.completedAt = now;
  }
  return updateSavedReview(state, reviewId, patch);
}

export const SENT_BACK_SLA_DAYS = TUTOR_NOTICE_WEEKS * 7;
export const BOOKED_SLA_DAYS = 7;

export const REVIEW_FLOW_STEPS = [
  { id: "sent", label: "Review released", currentLabel: "Review released" },
  { id: "returned", label: "Needs booking", currentLabel: "Needs booking", slaDays: SENT_BACK_SLA_DAYS, slaFrom: "sentAt" },
  { id: "booked", label: "Review booked", currentLabel: "Review booked", slaDays: BOOKED_SLA_DAYS, slaFrom: "returnedAt" },
  { id: "completed", label: "Review completed", currentLabel: "Review completed" },
  { id: "archived", label: "Archived", currentLabel: "Archived" },
  { id: "waiting", label: "Waiting", currentLabel: "Waiting" },
];

export const TUTOR_DUE_BANDS = [
  { id: "need-doing", label: "Need doing" },
  { id: "coming-up", label: "Coming up" },
  { id: "not-due", label: "Not due yet" },
  { id: "done", label: "Sent back" },
];

function daysSinceIso(iso, now = new Date()) {
  if (!iso) return null;
  const from = new Date(iso);
  if (Number.isNaN(from.getTime())) return null;
  return Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(from).getTime()) / 86400000,
  );
}

export function formatCycleStamp(iso) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    const date = dateFromKey(iso);
    if (!date) return "";
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stampDateKey(value) {
  const key = normaliseDateKey(value);
  if (key) return key;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toDateKey(date);
}

function dateKeyToIso(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return "";
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function cycleDueDateKey(learner, now = new Date()) {
  const due = reviewDueStatus(learner, now);
  if (due.next) return due.next;
  if (due.needed) return due.needed;
  if (due.daysUntil != null) {
    return toDateKey(addDays(startOfLocalDay(now), due.daysUntil));
  }
  return due.weekEnd || "";
}

export function cycleReleaseDateKey(learner, now = new Date()) {
  const last = lastReviewDateKey(learner);
  if (last) {
    return toDateKey(
      addDays(dateFromKey(last), (reviewIntervalWeeks(learner) - TUTOR_NOTICE_WEEKS) * 7),
    );
  }
  const dueKey = cycleDueDateKey(learner, now);
  if (dueKey) {
    return toDateKey(addDays(dateFromKey(dueKey), -TUTOR_NOTICE_WEEKS * 7));
  }
  return reviewDueStatus(learner, now).notice || "";
}

export function tutorWindowOpen(learner, now = new Date()) {
  const due = reviewDueStatus(learner, now);
  if (due.state === "overdue" || due.state === "due-soon") return true;
  if (due.daysUntilNotice == null) return false;
  return due.daysUntilNotice <= 0;
}

function packDateKey(pack) {
  return (
    normaliseDateKey(pack?.visitDateKey) ||
    stampDateKey(pack?.completedAt) ||
    normaliseDateKey(pack?.dateKey) ||
    stampDateKey(pack?.createdAt) ||
    ""
  );
}

export function currentCyclePack(state, learner) {
  const packs = reviewsForLearner(state, learner?.id);
  if (!packs.length) return null;
  const open = packs.filter((item) => item.status !== "completed");
  const latestCompleted = [...packs]
    .reverse()
    .find((item) => item.status === "completed");
  if (!open.length) return latestCompleted || packs[packs.length - 1];
  const doneKey = packDateKey(latestCompleted);
  const paper = [...open]
    .reverse()
    .find((item) => {
      if (!["returned", "print", "reviewer"].includes(item.status)) return false;
      const paperKey = packDateKey(item);
      if (doneKey && paperKey && paperKey <= doneKey) return false;
      return true;
    });
  return paper || latestCompleted || open[open.length - 1];
}

export function cycleReturned(pack) {
  if (!pack) return false;
  return Boolean(pack.returnedAt) || ["returned", "print", "completed"].includes(pack.status);
}

export function canBookReview(state, learner) {
  if (normaliseAppointment(learner?.appointment)) return true;
  return cycleReturned(currentCyclePack(state, learner));
}

export function tutorDueBand(state, learner, now = new Date()) {
  const pack = currentCyclePack(state, learner);
  if (cycleReturned(pack) && pack?.status !== "completed") return "done";
  if (pack?.status === "completed" && !tutorWindowOpen(learner, now)) return "done";
  if (tutorWindowOpen(learner, now)) return "need-doing";
  const due = reviewDueStatus(learner, now);
  if (due.daysUntilNotice != null && due.daysUntilNotice <= SENT_BACK_SLA_DAYS) {
    return "coming-up";
  }
  return "not-due";
}

export function ensureReviewCycle(state, learner, now = new Date()) {
  if (!learner?.id) return false;
  if (learner.isTest) return false;
  if (!tutorWindowOpen(learner, now)) return false;
  const packs = reviewsForLearner(state, learner?.id);
  if (
    packs.some((item) => ["returned", "print", "reviewer"].includes(item.status))
  ) {
    return false;
  }
  if (readAppointment(learner?.appointment) || isBookedOrVerified(state, learner, now)) {
    return false;
  }
  const pack = currentCyclePack(state, learner);
  if (pack && pack.status !== "completed") {
    const releaseKey = cycleReleaseDateKey(learner, now);
    if (!pack.sentAt || pack.status === "reviewer") {
      setReviewHolder(state, pack.id, "tutor");
      return true;
    }
    if (releaseKey && stampDateKey(pack.sentAt) !== releaseKey) {
      updateSavedReview(state, pack.id, { sentAt: releaseKey });
      return true;
    }
    return false;
  }
  const dateKey =
    nextReviewDateKey(learner) ||
    lastReviewDateKey(learner) ||
    toDateKey(startOfLocalDay(now));
  if (pack?.status === "completed" && pack.dateKey === dateKey) return false;
  const { review } = createSavedReview(state, {
    learnerId: learner.id,
    dateKey,
    source: "cycle",
  });
  if (!review.sentAt || review.status === "reviewer") {
    setReviewHolder(state, review.id, "tutor");
  }
  return true;
}

export function ensureReviewCycles(state, learners, now = new Date()) {
  let changed = false;
  for (const learner of learners || []) {
    if (ensureReviewCycle(state, learner, now)) changed = true;
  }
  return changed;
}

export function repairCycleReleaseDates(state, learners, now = new Date()) {
  let changed = false;
  for (const learner of learners || []) {
    if (!learner?.id) continue;
    const pack = currentCyclePack(state, learner);
    if (!pack?.id) continue;
    if (flowCurrentId(state, learner, pack, now) === "waiting") continue;
    const releaseKey = cycleReleaseDateKey(learner, now);
    if (!releaseKey) continue;
    if (stampDateKey(pack.sentAt) !== releaseKey) {
      updateSavedReview(state, pack.id, { sentAt: releaseKey });
      changed = true;
    }
    const iso = dateKeyToIso(releaseKey);
    for (const event of state.analyticsEvents || []) {
      if (event.type !== "sent" || event.reviewId !== pack.id) continue;
      if (event.dateKey === releaseKey && event.at === iso) continue;
      event.dateKey = releaseKey;
      event.at = iso;
      changed = true;
    }
  }
  return changed;
}

export function stampCycleBooked(state, learner, at = new Date().toISOString()) {
  const pack = currentCyclePack(state, learner);
  if (!pack || pack.bookedAt) return pack;
  return updateSavedReview(state, pack.id, { bookedAt: at });
}

export function stampCycleCompleted(state, learner, at = new Date().toISOString()) {
  const pack = currentCyclePack(state, learner);
  if (!pack) return null;
  return updateSavedReview(state, pack.id, {
    status: "completed",
    completedAt: pack.completedAt || at,
    archivedAt: pack.archivedAt || at,
  });
}

export function stampCycleArchived(state, learner, at = new Date().toISOString()) {
  let pack = currentCyclePack(state, learner);
  if (!pack) {
    const dateKey =
      lastReviewDateKey(learner) ||
      nextReviewDateKey(learner) ||
      toDateKey(startOfLocalDay(new Date(at)));
    if (!dateKey || !learner?.id) return null;
    pack = createSavedReview(state, {
      learnerId: learner.id,
      dateKey,
      source: "cycle",
    }).review;
  }
  if (pack?.archivedAt) return null;
  const visitDone = Boolean(lastReviewDateKey(learner)) || hasCompletedVisit(learner, pack);
  const patch = { archivedAt: at };
  if (visitDone) {
    patch.status = "completed";
    if (!pack.completedAt) patch.completedAt = at;
  }
  return updateSavedReview(state, pack.id, patch);
}

export function archiveSettledCycles(state, learners, now = new Date()) {
  let changed = false;
  for (const learner of learners || []) {
    if (!learner?.id) continue;
    const pack = currentCyclePack(state, learner);
    if (flowCurrentId(state, learner, pack, now) !== "archived") continue;
    if (stampCycleArchived(state, learner, now.toISOString())) changed = true;
  }
  return changed;
}

export function hasCompletedVisit(learner, pack) {
  if (pack?.completedAt || pack?.archivedAt || pack?.status === "completed") return true;
  if (lastReviewDateKey(learner)) return true;
  return (learner?.reviewHistory || []).some((item) => item?.actualDateKey);
}

function lockedVisitDateKey(state, learner, now = new Date()) {
  const booked = normaliseDateKey(learner?.appointment?.dateKey);
  const today = toDateKey(startOfLocalDay(now));
  let verifiedKey = "";
  for (const [dateKey, ids] of Object.entries(state?.verifiedByDate || {})) {
    if (!(ids || []).includes(learner?.id)) continue;
    const key = normaliseDateKey(dateKey);
    if (!key || key < today) continue;
    if (!verifiedKey || key < verifiedKey) verifiedKey = key;
  }
  return booked || verifiedKey;
}

export function isBookedOrVerified(state, learner, now = new Date()) {
  return Boolean(lockedVisitDateKey(state, learner, now));
}

function flowCurrentId(state, learner, pack, now = new Date()) {
  const lockedKey = lockedVisitDateKey(state, learner, now);
  const last = lastReviewDateKey(learner);
  const appointment = normaliseAppointment(learner?.appointment);
  const sent =
    Boolean(pack?.sentAt) ||
    ["tutor", "returned", "print", "completed"].includes(pack?.status);
  const returned = cycleReturned(pack);
  const booked =
    Boolean(pack?.bookedAt) ||
    Boolean(appointment) ||
    Boolean(lockedKey && (!last || lockedKey > last));
  const completed = Boolean(pack?.completedAt) || pack?.status === "completed";
  const archived = Boolean(pack?.archivedAt);
  const windowOpen = tutorWindowOpen(learner, now);
  const visitDone = Boolean(last) || hasCompletedVisit(learner, pack);
  const upcomingVisit = Boolean(lockedKey && (!last || lockedKey > last));
  const due = reviewDueStatus(learner, now);
  const dueUnknown = due.daysUntilNeeded == null && due.daysUntil == null;

  if (upcomingVisit) return "booked";
  if (booked && !completed && !visitDone) return "booked";
  if (!booked && windowOpen) return "returned";
  if (!booked && !visitDone) return dueUnknown ? "returned" : archived ? "waiting" : "archived";
  if (visitDone && !upcomingVisit && !windowOpen) return archived ? "waiting" : "archived";
  if (archived && !windowOpen) return "waiting";
  if (archived && windowOpen) return "sent";
  if (completed && !archived && !windowOpen) return "archived";
  if (returned && !booked) return "booked";
  if (sent && !returned) return "returned";
  if (windowOpen && !sent) return "sent";
  return archived ? "waiting" : "archived";
}

export function reviewFlowState(state, learner, now = new Date()) {
  const pack = currentCyclePack(state, learner);
  const appointment = normaliseAppointment(learner?.appointment);
  const windowOpen = tutorWindowOpen(learner, now);
  const currentId = flowCurrentId(state, learner, pack, now);
  const last = lastReviewDateKey(learner);
  const sent =
    Boolean(pack?.sentAt) ||
    ["tutor", "returned", "print", "completed"].includes(pack?.status);
  const returned = cycleReturned(pack);
  const booked = Boolean(pack?.bookedAt) || Boolean(appointment);
  const completed = Boolean(pack?.completedAt) || pack?.status === "completed";
  const archived = Boolean(pack?.archivedAt);
  const dueKey = cycleDueDateKey(learner, now);
  const releaseKey =
    currentId === "waiting"
      ? stampDateKey(pack?.sentAt) ||
        (last
          ? toDateKey(addDays(dateFromKey(last), -TUTOR_NOTICE_WEEKS * 7))
          : "")
      : cycleReleaseDateKey(learner, now);
  const bookedKey =
    stampDateKey(pack?.bookedAt) || normaliseDateKey(appointment?.dateKey) || "";
  const completedThisCycle = ["completed", "archived", "waiting"].includes(currentId);
  const completedKey =
    stampDateKey(pack?.completedAt) ||
    stampDateKey(pack?.visitDateKey) ||
    (completedThisCycle ? last : "");
  const archivedKey = stampDateKey(pack?.archivedAt) || completedKey;
  const stamps = {
    sent: releaseKey || stampDateKey(pack?.sentAt) || "",
    returned: stampDateKey(pack?.returnedAt) || dueKey,
    booked: bookedKey,
    completed: completedKey,
    archived: archivedKey,
    waiting:
      currentId === "waiting"
        ? addWeeksToDateKey(last || archivedKey, reviewIntervalWeeks(learner))
        : "",
  };
  const done = {
    sent,
    returned,
    booked,
    completed,
    archived,
    waiting: archived && currentId !== "waiting",
  };
  if (currentId === "waiting") {
    const visitDone = Boolean(last) || hasCompletedVisit(learner, pack);
    done.sent = visitDone;
    done.returned = visitDone;
    done.booked = visitDone;
    done.completed = visitDone;
    done.archived = archived;
    done.waiting = false;
  }
  if (currentId === "returned") {
    done.returned = false;
    done.booked = false;
    done.completed = false;
    done.archived = false;
  }
  if (currentId === "booked") {
    done.returned = true;
    done.booked = false;
    done.completed = false;
    done.archived = false;
  }
  if (currentId === "completed") {
    done.returned = true;
    done.booked = true;
    done.completed = false;
    done.archived = false;
  }
  if (currentId === "archived") {
    const visitDone = Boolean(last) || hasCompletedVisit(learner, pack);
    done.sent = visitDone || sent;
    done.returned = visitDone || returned;
    done.booked = visitDone || booked;
    done.completed = visitDone || completed;
    done.archived = false;
    done.waiting = false;
  }
  const due = reviewDueStatus(learner, now);
  const steps = REVIEW_FLOW_STEPS.map((step) => {
    const slaDays = daysSinceIso(pack?.[step.slaFrom], now);
    let late =
      currentId === step.id &&
      step.slaDays != null &&
      slaDays != null &&
      slaDays > step.slaDays;
    let slaLabel =
      step.slaDays != null && currentId === step.id && slaDays != null
        ? late
          ? `Late · ${formatWeeksAndDays(slaDays - step.slaDays)}`
          : `Left · ${formatWeeksAndDays(Math.max(0, step.slaDays - slaDays))}`
        : "";
    if (step.id === "returned" && currentId === step.id && due.daysUntil != null) {
      late = due.daysUntil < 0;
      slaLabel = late
        ? `Overdue · ${formatWeeksAndDays(due.daysUntil)}`
        : `Left · ${formatWeeksAndDays(due.daysUntil)}`;
    }
    let tone = "idle";
    if (done[step.id] && currentId !== step.id) tone = "done";
    else if (currentId === step.id) tone = late ? "late" : "current";
    return {
      ...step,
      tone,
      at: stamps[step.id] || "",
      stamp: formatCycleStamp(stamps[step.id] || ""),
      slaLabel,
    };
  });
  const current = steps.find((step) => step.id === currentId) || steps[0];
  return { pack, current, steps, windowOpen };
}

export function reviewLearner(state, learnerId) {
  return allLearners(state).find((item) => item.id === learnerId) || null;
}

export function filledTargetCount(review) {
  return [...(review?.previousTargets || []), ...(review?.newTargets || [])].filter(
    (item) => item.action,
  ).length;
}

export function reviewSearchText(review, learner) {
  const profile = learnerProfileFrom(learner || {});
  return [
    learner?.name,
    learner?.company,
    learner?.postcode,
    profile.tutor,
    review.dateKey,
    review.status,
  ]
    .join(" ")
    .toLowerCase();
}

export function reviewsForLearner(state, learnerId) {
  return (state.savedReviews || [])
    .filter((item) => item.learnerId === learnerId)
    .sort((a, b) => String(a.dateKey || "").localeCompare(String(b.dateKey || "")));
}

const WORKFLOW_RANK = { print: 4, returned: 3, tutor: 2 };

export function currentWorkflowReview(state, learner) {
  const packs = reviewsForLearner(state, learner?.id);
  const open = packs
    .filter((item) => WORKFLOW_RANK[item.status])
    .sort(
      (a, b) =>
        WORKFLOW_RANK[b.status] - WORKFLOW_RANK[a.status] ||
        String(b.dateKey || "").localeCompare(String(a.dateKey || "")),
    );
  if (open[0]) return open[0];
  const last = lastReviewDateKey(learner);
  return (
    packs.find(
      (item) =>
        last &&
        (item.visitDateKey === last || item.dateKey === last) &&
        reviewNeedsUpload(learner, item),
    ) || null
  );
}

export function repairOrphanReviewerPacks(state) {
  const busy = new Set(
    (state.savedReviews || [])
      .filter(
        (item) =>
          item.status === "print" ||
          item.status === "returned" ||
          item.status === "tutor",
      )
      .map((item) => item.learnerId),
  );
  if (!busy.size) return state;
  state.savedReviews = (state.savedReviews || []).filter((item) => {
    if (!busy.has(item.learnerId) || item.status !== "reviewer") return true;
    return Boolean(
      item.previousAttachment ||
        item.attachment ||
        item.returnedAttachment ||
        filledTargetCount(item),
    );
  });
  return state;
}

export function reviewLearnerIds(state) {
  return [...new Set((state.savedReviews || []).map((item) => item.learnerId))];
}

export function currentReviewForLearner(reviews, todayKey) {
  const packs = reviews || [];
  if (!packs.length) return null;
  const active = packs.filter(
    (item) => item.status !== "completed",
  );
  const pool = active.length ? active : packs;
  const due = pool
    .filter((item) => item.dateKey && item.dateKey <= todayKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return due[0] || pool[0] || null;
}

export function reviewWorkLeft(review, learner) {
  if (!review) return [];
  if (reviewNeedsUpload(learner, review)) {
    return ["Upload the scanned form from the visit"];
  }
  const items = [];
  // eslint-disable-next-line no-unused-vars
  const targets = filledTargetCount(review);
  if (review.status === "reviewer" || review.status === "tutor") {
    items.push("Waiting for the tutor to send it back");
  }
  if (review.status === "returned") items.push("Book the visit");
  if (review.status === "print") items.push("Upload the scanned form from the visit");
  return items;
}

export function reviewNeedsUpload(learner, review) {
  if (review?.status === "completed" || review?.attachment) return false;
  if (review?.status === "print") return true;
  const lastDone = [...(learner?.reviewHistory || [])]
    .reverse()
    .find((item) => item.source === "completed");
  if (lastDone && !lastDone.attachment) return true;
  return Boolean(learner?.completedOn);
}

export function reviewVisitDateKey(learner, review) {
  return resolveReviewVisitDates(learner, review).completedOn;
}

function alignDueToCompletedVisit(dueOn, completedOn, weeks = REVIEW_INTERVAL_WEEKS) {
  let due = normaliseDateKey(dueOn);
  const done = normaliseDateKey(completedOn);
  if (!due || !done) return due;
  const threshold = Math.max(14, weeks * 7 - 14);
  let guard = 0;
  while (guard < 8) {
    const ahead = daysBetweenDateKeys(done, due);
    if (ahead == null || ahead < threshold) break;
    const previous = addWeeksToDateKey(due, -weeks);
    if (!previous || previous === due) break;
    due = previous;
    guard += 1;
  }
  return due;
}

function dueDateForCompletedVisit(learner, completedOn) {
  const done = normaliseDateKey(completedOn);
  if (!done) return "";
  const leftover = [...(learner?.reviewHistory || [])]
    .reverse()
    .find((item) => item.actualDateKey === done && item.plannedDateKey);
  if (leftover?.plannedDateKey) return normaliseDateKey(leftover.plannedDateKey);
  const nextPlanned = normaliseDateKey(learner?.plannedReviewDate);
  if (nextPlanned && nextPlanned > done) {
    const previousSlot = addWeeksToDateKey(nextPlanned, -reviewIntervalWeeks(learner));
    if (previousSlot && previousSlot <= done) return previousSlot;
    if (previousSlot) return previousSlot;
  }
  return done;
}

export function resolveReviewVisitDates(learner, pack, plannedFallback = "") {
  const last = lastReviewDateKey(learner);
  const leftover = [...(learner?.reviewHistory || [])]
    .reverse()
    .find((item) => item.source === "completed" && item.actualDateKey);
  const planned = normaliseDateKey(pack?.dateKey || plannedFallback || "");
  const packIsNextCycle =
    Boolean(pack) && last && planned && planned > last && !pack.visitDateKey;
  if (!pack || packIsNextCycle) {
    const completedOn = normaliseDateKey(leftover?.actualDateKey || last || "");
    const dueOn = alignDueToCompletedVisit(
      normaliseDateKey(leftover?.plannedDateKey || "") ||
        dueDateForCompletedVisit(learner, completedOn),
      completedOn,
      reviewIntervalWeeks(learner),
    );
    return { dueOn, completedOn };
  }
  const packVisit = normaliseDateKey(pack.visitDateKey || "");
  const printed = dateKeyFromIso(pack.printedAt);
  const finished = dateKeyFromIso(pack.completedAt);
  const matched = (learner?.reviewHistory || []).find(
    (item) =>
      (planned && item.plannedDateKey === planned) ||
      (packVisit && item.actualDateKey === packVisit),
  );
  let completedOn =
    packVisit || normaliseDateKey(matched?.actualDateKey || "");
  if (!completedOn && last && planned && last >= planned) completedOn = last;
  if (!completedOn) completedOn = printed || finished || "";
  return {
    dueOn: alignDueToCompletedVisit(
      planned || normaliseDateKey(matched?.plannedDateKey || ""),
      completedOn,
      reviewIntervalWeeks(learner),
    ),
    completedOn,
  };
}

function completedRouteLearnerIds(state, dateKey) {
  const entry = state?.completedRoutes?.[dateKey];
  const ids = Array.isArray(entry) ? entry : entry?.ids || [];
  return ids.filter(Boolean);
}

export function repairFalseTodayCompletions(state, todayKey) {
  const today = normaliseDateKey(todayKey);
  if (!today) return state;
  const verifiedToday = new Set(state.verifiedByDate?.[today] || []);
  const completedToday = new Set(completedRouteLearnerIds(state, today));
  const realVisitIds = new Set(
    (state.savedReviews || [])
      .filter((item) => normaliseDateKey(item.visitDateKey) === today)
      .map((item) => item.learnerId),
  );
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const learner of list || []) {
      if (!learner || learner.isTest) continue;
      if (
        verifiedToday.has(learner.id) ||
        realVisitIds.has(learner.id) ||
        completedToday.has(learner.id)
      ) {
        continue;
      }
      const hadToday = (learner.reviewHistory || []).some(
        (entry) =>
          normaliseDateKey(entry.actualDateKey) === today ||
          normaliseDateKey(entry.dateKey) === today,
      );
      if (
        !hadToday &&
        normaliseDateKey(learner.lastReviewDate) !== today &&
        normaliseDateKey(learner.completedOn) !== today
      ) {
        continue;
      }
      learner.reviewHistory = (learner.reviewHistory || []).filter(
        (entry) =>
          normaliseDateKey(entry.actualDateKey) !== today &&
          normaliseDateKey(entry.dateKey) !== today,
      );
      if (normaliseDateKey(learner.lastReviewDate) === today) {
        learner.lastReviewDate = "";
      }
      if (normaliseDateKey(learner.completedOn) === today) {
        learner.completedOn = "";
      }
      learner.lastReviewDate = lastReviewDateKey(learner);
    }
  }
  state.savedReviews = (state.savedReviews || []).filter((item) => {
    if (normaliseDateKey(item.dateKey) !== today) return true;
    if (item.visitDateKey || item.status !== "reviewer") return true;
    if (
      realVisitIds.has(item.learnerId) ||
      verifiedToday.has(item.learnerId) ||
      completedToday.has(item.learnerId)
    ) {
      return true;
    }
    return Boolean(
      item.previousAttachment ||
        item.attachment ||
        item.returnedAttachment ||
        filledTargetCount(item),
    );
  });
  return state;
}

export function repairMistakenVisitDates(state, todayKey) {
  const today = normaliseDateKey(todayKey);
  if (!today) return state;
  const completedToday = new Set(completedRouteLearnerIds(state, today));
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const learner of list || []) {
      if (completedToday.has(learner?.id)) continue;
      const better = reviewsForLearner(state, learner.id)
        .map((item) => normaliseDateKey(item.visitDateKey))
        .filter((key) => key && key !== today)
        .sort()
        .at(-1);
      if (!better) continue;
      if (learner.lastReviewDate === today) learner.lastReviewDate = better;
      if (learner.completedOn === today) learner.completedOn = better;
      learner.reviewHistory = (learner.reviewHistory || []).map((entry) => {
        if (entry.actualDateKey !== today && entry.dateKey !== today) return entry;
        return { ...entry, dateKey: better, actualDateKey: better };
      });
    }
  }
  return state;
}

export function repairForwardDueDates(state) {
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const learner of list || []) {
      if (learner?.isTest) continue;
      learner.reviewHistory = (learner.reviewHistory || []).map((entry) => {
        const actual = normaliseDateKey(entry.actualDateKey || entry.dateKey);
        if (!actual) return entry;
        const planned =
          alignDueToCompletedVisit(
            entry.plannedDateKey,
            actual,
            reviewIntervalWeeks(learner),
          ) || dueDateForCompletedVisit(learner, actual);
        if (!planned || planned === entry.plannedDateKey) return entry;
        return { ...entry, plannedDateKey: planned };
      });
    }
  }
  return state;
}

function formText(form, name) {
  try {
    return String(form.getTextField(name).getText() || "").trim();
  } catch {
    return "";
  }
}

function formChecked(form, name) {
  try {
    return form.getCheckBox(name).isChecked();
  } catch {
    return false;
  }
}

function statusFromPrevious(form, index) {
  if (formChecked(form, `s2_status_${index}_met`)) return "met";
  if (formChecked(form, `s2_status_${index}_partly_met`)) return "partly";
  if (formChecked(form, `s2_status_${index}_not_met`)) return "not-met";
  if (formChecked(form, `s2_status_${index}_carry_forward`)) return "carry-forward";
  return "open";
}

const SECTION1_TEXT = {
  name: ["s1_apprentice_name"],
  company: ["s1_employer_workplace"],
  postcode: ["s1_postcode"],
  collegeDay: ["s1_release_day"],
  tutor: ["s1_gta_tutor"],
  apprenticeship: ["s1_apprenticeship_standard_route_level"],
  gtaReviewer: ["s1_gta_reviewer"],
  employerContact: ["s1_employer_contact_name"],
  contactNumber: ["s1_employer_contact_phone"],
  employerEmail: ["s1_employer_contact_email"],
};

function isSkippedPdfDateField(name) {
  return /review_date|planned_review|previous_review|last_review|s7_target_date|s8_.*date/i.test(
    String(name || ""),
  );
}

function allFormText(form) {
  const values = {};
  try {
    for (const field of form.getFields()) {
      const name = String(field.getName() || "");
      if (!name || isSkippedPdfDateField(name)) continue;
      values[name] = formText(form, name);
    }
  } catch {
    // Some older forms expose fields that pdf-lib cannot enumerate.
  }
  return values;
}

function pickFormText(values, names, match) {
  for (const name of names) {
    if (values[name]) return values[name];
  }
  if (!match) return "";
  for (const [name, value] of Object.entries(values)) {
    if (value && match(name.toLowerCase())) return value;
  }
  return "";
}

export async function extractSection1FromPdf(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const values = allFormText(form);
  for (const names of Object.values(SECTION1_TEXT)) {
    for (const name of names) {
      if (!(name in values)) values[name] = formText(form, name);
    }
  }
  return {
    name: pickFormText(values, SECTION1_TEXT.name, (name) =>
      name.includes("apprentice_name") && !name.startsWith("s8_"),
    ),
    company: pickFormText(values, SECTION1_TEXT.company, (name) =>
      name.includes("employer") && name.includes("workplace"),
    ),
    postcode: pickFormText(values, SECTION1_TEXT.postcode, (name) =>
      name.includes("postcode"),
    ),
    collegeDay: pickFormText(values, SECTION1_TEXT.collegeDay, (name) =>
      name.includes("release"),
    ),
    tutor: pickFormText(values, SECTION1_TEXT.tutor, (name) =>
      name.includes("tutor") && !name.includes("contribution"),
    ),
    apprenticeship: pickFormText(values, SECTION1_TEXT.apprenticeship, (name) =>
      name.includes("apprenticeship") && name.includes("standard"),
    ),
    gtaReviewer: pickFormText(values, SECTION1_TEXT.gtaReviewer, (name) =>
      name.includes("gta_reviewer") || (name.includes("reviewer") && name.startsWith("s1_")),
    ),
    employerContact: pickFormText(values, SECTION1_TEXT.employerContact, (name) =>
      name.includes("employer_contact_name") ||
      (name.includes("contact") && name.includes("name") && !name.includes("phone")),
    ),
    contactNumber: pickFormText(values, SECTION1_TEXT.contactNumber, (name) =>
      name.includes("phone") || name.includes("contact_number"),
    ),
    employerEmail: pickFormText(values, SECTION1_TEXT.employerEmail, (name) =>
      name.includes("email"),
    ),
    apprenticeshipStartDate: parseFormDate(
      formText(form, "s1_apprenticeship_start_date"),
    ),
    apprenticeshipEndDate: parseFormDate(
      formText(form, "s1_apprenticeship_planned_end_date"),
    ),
  };
}

export async function extractTargetsFromPdf(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const previousTargets = [];
  const newTargets = [];
  for (let index = 1; index <= 3; index += 1) {
    const previousAction = formText(form, `s2_action_${index}`);
    if (previousAction) {
      previousTargets.push(
        normaliseTarget({
          action: previousAction,
          owner: formText(form, `s2_owner_${index}`),
          measure: formText(form, `s2_progress_outcome_evidence_${index}`),
          status: statusFromPrevious(form, index),
        }),
      );
    }
    const nextAction = formText(form, `s7_action_target_${index}`);
    if (nextAction) {
      newTargets.push(
        normaliseTarget({
          action: nextAction,
          owner: formText(form, `s7_owner_${index}`),
          measure: formText(form, `s7_success_measure_support_${index}`),
          targetDate: parseFormDate(formText(form, `s7_target_date_${index}`)),
          status: "open",
        }),
      );
    }
  }
  return { previousTargets, newTargets };
}

export function applyTutorReturnedTargets(extracted) {
  return {
    previousTargets: (extracted?.previousTargets || [])
      .filter((item) => item.action)
      .slice(0, REVIEW_TARGET_SLOTS),
    newTargets: padTargets(extracted?.newTargets || []),
  };
}

export function forwardTargetsForPrint(pack) {
  const stillOpen = (pack?.previousTargets || []).filter(
    (item) => item.action && item.status !== "met",
  );
  const added = (pack?.newTargets || []).filter((item) => item.action);
  const seen = new Set();
  const rows = [];
  for (const item of [...stillOpen, ...added]) {
    const key = String(item.action || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(
      normaliseTarget({
        ...item,
        id: newId(),
        status: "open",
      }),
    );
    if (rows.length >= REVIEW_TARGET_SLOTS) break;
  }
  return rows;
}

export function applyExtractedTargets(review, extracted, kind) {
  const extractedTargets = [
    ...(extracted?.previousTargets || []),
    ...(extracted?.newTargets || []),
  ].filter((item) => item.action);
  if (!extractedTargets.length) return {};
  if (kind === "last") {
    const carried = extractedTargets
      .filter((item) => item.status !== "met")
      .map((item) =>
        normaliseTarget({
          ...item,
          id: newId(),
          status: item.status === "not-met" ? "not-met" : "carry-forward",
        }),
      );
    return {
      previousTargets: carried.slice(0, REVIEW_TARGET_SLOTS),
      newTargets: padTargets(
        (review.newTargets || []).some((item) => item.action)
          ? review.newTargets
          : [],
      ),
      isInitial: false,
    };
  }
  return {
    previousTargets: (extracted.previousTargets || []).slice(0, REVIEW_TARGET_SLOTS),
    newTargets: padTargets(extracted.newTargets || []),
    isInitial: true,
  };
}
