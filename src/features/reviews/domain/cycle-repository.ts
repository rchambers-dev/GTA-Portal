import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { formatTutorDate, londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import { formatManagerName } from "@/features/administration/domain/employer-record";
import {
  CYCLE_STEPS,
  currentStepDetail,
  cycleStepFromStage,
  reviewCountLabel,
  stepTone,
  tutorDueBand,
  type CycleStepId,
} from "./cycle";
import { methodLabel, reviewDueLabel } from "./plan-due";
import {
  emptyTutorForm,
  type Rag,
  type TargetDraft,
  type TargetStatus,
  type TutorFormDraft,
} from "./tutor-form-rules";
import type { CycleLearner, CyclePage, CycleStepView, DigitalReview, HistoryRow, LearnerReviews } from "./cycle-view";

export type { CycleLearner, CyclePage, CycleStepView, DigitalReview, HistoryRow, LearnerReviews };

type ApprenticeRow = {
  gta_id: string;
  first_name: string | null;
  middle_names: string | null;
  last_name: string | null;
  programme_id: string | null;
  release_day: string | null;
  status: string | null;
  is_test?: boolean | null;
};

function personName(row: { first_name?: string | null; middle_names?: string | null; last_name?: string | null; display_name?: string | null }): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  return [row.first_name, row.middle_names, row.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return [];
}

async function loadApprentices(supabase: SupabaseClient) {
  const columns = "gta_id, first_name, middle_names, last_name, programme_id, release_day, status";
  const withFlag = await supabase.from("apprentices").select(`${columns}, is_test`);
  if (withFlag.error && isMissingTestColumn(withFlag.error.message)) {
    return supabase.from("apprentices").select(columns);
  }
  return withFlag;
}

type Loaded = {
  error: string | null;
  apprentices: ApprenticeRow[];
  programmes: Map<string, string>;
  jobs: Map<string, { employerId: string | null; siteId: string | null; managerId: string | null }>;
  employers: Map<string, string>;
  postcodes: Map<string, string>;
  managers: Map<string, { name: string }>;
  tutors: Map<string, { id: string; name: string }>;
  reviews: {
    id: string;
    gta_id: string;
    status: string;
    planned_on: string | null;
    actual_on: string | null;
    method: string | null;
    interval_weeks: number | null;
    reviewer_id: string | null;
  }[];
  packs: {
    id: string;
    review_id: string;
    gta_id: string;
    stage: string;
    tutor_id: string | null;
  }[];
  events: { pack_id: string; event_type: string; occurred_at: string; to_stage: string | null }[];
  signoffs: { gta_id: string; signed_on: string; recorded_by: string | null }[];
  profiles: Map<string, string>;
  concerns: Set<string>;
  reviewers: { id: string; name: string; isDefault: boolean }[];
};

async function loadShared(supabase: SupabaseClient): Promise<Loaded> {
  const [
    apprenticesResult,
    programmesResult,
    jobsResult,
    employersResult,
    sitesResult,
    managersResult,
    tutorsResult,
    reviewsResult,
    packsResult,
    eventsResult,
    signoffsResult,
    profilesResult,
    concernsResult,
    reviewersResult,
  ] = await Promise.all([
    loadApprentices(supabase),
    supabase.from("programmes").select("id, name"),
    supabase.from("apprentice_employments").select("gta_id, employer_id, site_id, manager_id").is("end_date", null),
    supabase.from("employers").select("employer_id, company_name"),
    supabase.from("employer_sites").select("id, postcode"),
    supabase.from("employer_managers").select("id, first_name, middle_names, last_name"),
    supabase.from("apprentice_tutors").select("apprentice_id, tutor_id").is("end_date", null),
    supabase.from("reviews").select("id, gta_id, status, planned_on, actual_on, method, interval_weeks, reviewer_id"),
    supabase.from("review_packs").select("id, review_id, gta_id, stage, tutor_id"),
    supabase.from("review_pack_events").select("pack_id, event_type, occurred_at, to_stage"),
    supabase.from("apprentice_safeguarding_signoffs").select("gta_id, signed_on, recorded_by").is("reversed_at", null),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("learner_concerns").select("gta_id").is("resolved_on", null),
    supabase.from("review_reviewers").select("profile_id, is_default"),
  ]);

  const failed = [
    apprenticesResult,
    programmesResult,
    jobsResult,
    reviewsResult,
    packsResult,
  ].find((result) => result.error);
  const profiles = new Map(asRows<{ id: string; display_name: string | null }>(profilesResult.data).map((row) => [row.id, row.display_name || "Unnamed"]));
  const tutorRows = asRows<{ apprentice_id: string; tutor_id: string }>(tutorsResult.data);
  const tutors = new Map<string, { id: string; name: string }>();
  tutorRows.forEach((row) => {
    tutors.set(row.apprentice_id, { id: row.tutor_id, name: profiles.get(row.tutor_id) || "Tutor" });
  });
  const reviewerRows = asRows<{ profile_id: string; is_default: boolean }>(reviewersResult.data);
  return {
    error: failed?.error?.message ?? null,
    apprentices: excludeTestApprentices(asRows<ApprenticeRow>(apprenticesResult.data)),
    programmes: new Map(asRows<{ id: string; name: string | null }>(programmesResult.data).map((row) => [row.id, row.name || "Programme"])),
    jobs: new Map(
      asRows<{ gta_id: string; employer_id: string | null; site_id: string | null; manager_id: string | null }>(jobsResult.data).map((row) => [
        row.gta_id,
        { employerId: row.employer_id, siteId: row.site_id, managerId: row.manager_id },
      ]),
    ),
    employers: new Map(asRows<{ employer_id: string; company_name: string | null }>(employersResult.data).map((row) => [row.employer_id, row.company_name || "Employer"])),
    postcodes: new Map(asRows<{ id: string; postcode: string | null }>(sitesResult.data).map((row) => [row.id, row.postcode || ""])),
    managers: new Map(
      asRows<{ id: string; first_name: string | null; middle_names: string | null; last_name: string | null }>(managersResult.data).map((row) => [
        row.id,
        { name: formatManagerName({ firstName: row.first_name || "", middleNames: row.middle_names || "", lastName: row.last_name || "" }) },
      ]),
    ),
    tutors,
    reviews: asRows(reviewsResult.data),
    packs: asRows(packsResult.data),
    events: asRows(eventsResult.data),
    signoffs: asRows(signoffsResult.data),
    profiles,
    concerns: new Set(asRows<{ gta_id: string }>(concernsResult.data).map((row) => row.gta_id)),
    reviewers: reviewerRows.map((row) => ({
      id: row.profile_id,
      name: profiles.get(row.profile_id) || "Reviewer",
      isDefault: Boolean(row.is_default),
    })),
  };
}

const EVENT_STEP: Partial<Record<string, CycleStepId>> = {
  released: "released",
  submitted: "booking",
  booked: "booked",
  reviewed: "completed",
  completed: "archived",
  created: "waiting",
};

function buildLearner(loaded: Loaded, apprentice: ApprenticeRow, today: string): CycleLearner {
  const job = loaded.jobs.get(apprentice.gta_id);
  const reviews = loaded.reviews.filter((review) => review.gta_id === apprentice.gta_id);
  const completed = reviews
    .filter((review) => review.status === "completed" && review.actual_on)
    .sort((a, b) => String(a.actual_on).localeCompare(String(b.actual_on)));
  const open = reviews.find((review) => review.status === "open") ?? null;
  const packs = loaded.packs.filter((pack) => pack.gta_id === apprentice.gta_id);
  const openPack = open ? packs.find((pack) => pack.review_id === open.id) ?? null : null;
  const latestPack = openPack ?? packs[0] ?? null;
  const stepId = cycleStepFromStage(latestPack?.stage ?? (open ? "waiting" : completed.length ? "archived" : "waiting"));
  const planned = isoDate(open?.planned_on);
  const interval = open?.interval_weeks || (loaded.concerns.has(apprentice.gta_id) ? 5 : 10);
  const inBreak = apprentice.status === "break_in_learning";
  const due = inBreak
    ? { state: "ok" as const, label: "Paused in break", daysUntil: Number.POSITIVE_INFINITY, nextDate: planned }
    : reviewDueLabel({ today, nextDate: planned, intervalWeeks: interval });
  const late = due.state === "overdue";
  const daysLeft = Number.isFinite(due.daysUntil) ? due.daysUntil : null;
  const eventDates = new Map<CycleStepId, string>();
  if (latestPack) {
    loaded.events
      .filter((event) => event.pack_id === latestPack.id)
      .forEach((event) => {
        const step = EVENT_STEP[event.event_type];
        if (step) eventDates.set(step, isoDate(event.occurred_at) || "");
      });
  }
  const steps: CycleStepView[] = CYCLE_STEPS.map((step) => {
    const tone = stepTone(step.id, stepId, late);
    const dated = eventDates.get(step.id);
    let detail = "Not yet";
    if (tone === "done") detail = dated ? formatTutorDate(dated) : "Done";
    if (tone === "current" || tone === "late") detail = currentStepDetail(late, daysLeft);
    return { id: step.id, label: step.label, tone, detail };
  });
  const signoff = loaded.signoffs.find((row) => row.gta_id === apprentice.gta_id);
  const signedOn = isoDate(signoff?.signed_on);
  const tutor = loaded.tutors.get(apprentice.gta_id);
  const band = tutorDueBand({
    today,
    plannedOn: planned,
    intervalWeeks: interval,
    stage: latestPack?.stage ?? null,
    inBreak,
  }).band;
  return {
    gtaId: apprentice.gta_id,
    name: personName(apprentice),
    tutor: tutor?.name || "No tutor set",
    tutorId: tutor?.id ?? null,
    company: job?.employerId ? loaded.employers.get(job.employerId) || "Employer" : "No employer",
    postcode: job?.siteId ? loaded.postcodes.get(job.siteId) || "" : "",
    programme: apprentice.programme_id ? loaded.programmes.get(apprentice.programme_id) || "Programme" : "No programme",
    programmeId: apprentice.programme_id,
    managerId: job?.managerId ?? null,
    managerName: job?.managerId ? loaded.managers.get(job.managerId)?.name || "Manager" : "No manager",
    collegeDay: apprentice.release_day?.trim() || "Not recorded",
    stepId,
    stepLabel: CYCLE_STEPS.find((step) => step.id === stepId)?.label || "Waiting",
    timing: due.label,
    late,
    daysLeft,
    reviewCount: completed.length,
    reviewCountLabel: reviewCountLabel(completed.length),
    signedOn,
    signedLabel: signedOn ? `Safeguarding signed · ${formatTutorDate(signedOn)}` : null,
    steps,
    band,
    packId: latestPack?.id ?? null,
    packStage: latestPack?.stage ?? null,
    editable: latestPack?.stage === "with_tutor",
    fillPercent: 0,
  };
}

export async function readReviewCycle(supabase: SupabaseClient): Promise<CyclePage> {
  const today = londonToday();
  const loaded = await loadShared(supabase);
  const learners = loaded.apprentices
    .map((apprentice) => buildLearner(loaded, apprentice, today))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.name.localeCompare(b.name));
  const tutors = [...new Set(learners.map((learner) => learner.tutor))].sort((a, b) => a.localeCompare(b));
  return { today, learners, tutors, loadError: loaded.error };
}

export async function loadReviewCycle(): Promise<CyclePage> {
  const supabase = await createSupabaseServerClient();
  return readReviewCycle(supabase);
}

export async function readLearnerReviews(supabase: SupabaseClient, gtaId: string): Promise<LearnerReviews> {
  const today = londonToday();
  const loaded = await loadShared(supabase);
  const apprentice = loaded.apprentices.find((row) => row.gta_id === gtaId);
  const empty: LearnerReviews = {
    gtaId,
    today,
    steps: [],
    nextDue: "Not set",
    nextDueState: "unknown",
    lastActual: "No review yet",
    reviewerId: null,
    reviewerName: loaded.reviewers.find((row) => row.isDefault)?.name || "Reiss",
    reviewers: loaded.reviewers.map((row) => ({ id: row.id, name: row.name })),
    method: null,
    openReviewId: null,
    booked: false,
    inBreak: false,
    history: [],
    loadError: loaded.error,
  };
  if (!apprentice) return { ...empty, loadError: loaded.error || "This apprentice could not be loaded." };
  const learner = buildLearner(loaded, apprentice, today);
  const reviews = loaded.reviews.filter((review) => review.gta_id === gtaId);
  const completed = reviews
    .filter((review) => review.status === "completed")
    .sort((a, b) => String(a.actual_on).localeCompare(String(b.actual_on)));
  const open = reviews.find((review) => review.status === "open");
  const last = completed.at(-1);
  const history: HistoryRow[] = completed.map((review, index) => {
    const pack = loaded.packs.find((item) => item.review_id === review.id);
    return {
      id: review.id,
      packId: pack?.id ?? null,
      number: index + 1,
      reviewer: loaded.profiles.get(review.reviewer_id || "") || "Reviewer",
      plannedOn: review.planned_on ? formatTutorDate(review.planned_on) : "—",
      actualOn: review.actual_on ? formatTutorDate(review.actual_on) : "—",
      method: review.method ? methodLabel(review.method) : "—",
      status: "Completed",
    };
  });
  return {
    ...empty,
    steps: learner.steps,
    nextDue: open?.planned_on ? formatTutorDate(open.planned_on) : learner.timing,
    nextDueState: learner.timing,
    lastActual: last?.actual_on ? formatTutorDate(last.actual_on) : "No review yet",
    reviewerId: open?.reviewer_id ?? last?.reviewer_id ?? loaded.reviewers.find((row) => row.isDefault)?.id ?? null,
    reviewerName:
      loaded.profiles.get(open?.reviewer_id || last?.reviewer_id || "") ||
      loaded.reviewers.find((row) => row.isDefault)?.name ||
      "Reiss",
    method: open?.method ? methodLabel(open.method) : null,
    openReviewId: open?.id ?? null,
    booked: learner.stepId === "booked" || learner.stepId === "completed",
    inBreak: apprentice.status === "break_in_learning",
    history,
  };
}

export async function loadLearnerReviews(gtaId: string): Promise<LearnerReviews> {
  const supabase = await createSupabaseServerClient();
  return readLearnerReviews(supabase, gtaId);
}

function targetFromRow(row: {
  id: string;
  slot: number;
  action: string | null;
  owner: string | null;
  measure: string | null;
  target_date: string | null;
  status: string | null;
  carried_from_id: string | null;
}): TargetDraft {
  return {
    id: row.id,
    slot: row.slot,
    action: row.action || "",
    owner: row.owner || "",
    measure: row.measure || "",
    targetDate: isoDate(row.target_date) || "",
    status: (row.status as TargetStatus) || "open",
    carriedFromId: row.carried_from_id,
  };
}

export async function readDigitalReview(supabase: SupabaseClient, packId: string, userId: string | null): Promise<DigitalReview> {
  const today = londonToday();
  const blank = emptyTutorForm();
  const failed = (message: string): DigitalReview => ({
    packId,
    gtaId: "",
    name: "",
    stage: "",
    editable: false,
    intervalWeeks: 10,
    today,
    section1: [],
    form: blank,
    savedAt: null,
    loadError: message,
  });
  const packResult = await supabase.from("review_packs").select("id, review_id, gta_id, stage, tutor_id").eq("id", packId).maybeSingle();
  if (packResult.error || !packResult.data) return failed(packResult.error?.message || "This review could not be opened.");
  const pack = packResult.data;
  const [apprenticeResult, reviewResult, formResult, targetsResult, progressResult, employmentResult] = await Promise.all([
    supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name, programme_id, release_day, status").eq("gta_id", pack.gta_id).maybeSingle(),
    supabase.from("reviews").select("id, planned_on, actual_on, method, interval_weeks, reviewer_id").eq("id", pack.review_id).maybeSingle(),
    supabase.from("review_tutor_forms").select("previous_summary, tutor_comment, draft_saved_at").eq("pack_id", packId).maybeSingle(),
    supabase.from("review_targets").select("id, kind, slot, action, owner, measure, target_date, status, carried_from_id").eq("pack_id", packId),
    supabase.from("review_progress_rows").select("area, evidence, action_ref, rag, target_hours, current_hours").eq("pack_id", packId),
    supabase.from("apprentice_employments").select("employer_id, site_id, manager_id").eq("gta_id", pack.gta_id).is("end_date", null).maybeSingle(),
  ]);
  const apprentice = apprenticeResult.data;
  const form = emptyTutorForm();
  if (formResult.data) {
    form.previousSummary = formResult.data.previous_summary || "";
    form.tutorComment = formResult.data.tutor_comment || "";
  }
  const targets = asRows<{
    id: string;
    kind: string;
    slot: number;
    action: string | null;
    owner: string | null;
    measure: string | null;
    target_date: string | null;
    status: string | null;
    carried_from_id: string | null;
  }>(targetsResult.data);
  targets.filter((row) => row.kind === "previous").forEach((row) => {
    form.previousTargets[row.slot - 1] = targetFromRow(row);
  });
  targets.filter((row) => row.kind === "new").forEach((row) => {
    form.newTargets[row.slot - 1] = targetFromRow(row);
  });
  asRows<{ area: string; evidence: string | null; action_ref: string | null; rag: string | null; target_hours: number | null; current_hours: number | null }>(progressResult.data).forEach((row) => {
    const progress = form.progress.find((item) => item.area === row.area);
    if (!progress) return;
    progress.evidence = row.evidence || "";
    progress.actionRef = row.action_ref || "";
    progress.rag = (row.rag as Rag) || "";
    progress.targetHours = row.target_hours == null ? "" : String(row.target_hours);
    progress.currentHours = row.current_hours == null ? "" : String(row.current_hours);
  });
  const employerId = employmentResult.data?.employer_id;
  const siteId = employmentResult.data?.site_id;
  const managerId = employmentResult.data?.manager_id;
  const [employer, site, manager, programme, reviewer] = await Promise.all([
    employerId ? supabase.from("employers").select("company_name").eq("employer_id", employerId).maybeSingle() : Promise.resolve({ data: null }),
    siteId ? supabase.from("employer_sites").select("postcode").eq("id", siteId).maybeSingle() : Promise.resolve({ data: null }),
    managerId ? supabase.from("employer_managers").select("first_name, middle_names, last_name, phone").eq("id", managerId).maybeSingle() : Promise.resolve({ data: null }),
    apprentice?.programme_id ? supabase.from("programmes").select("name").eq("id", apprentice.programme_id).maybeSingle() : Promise.resolve({ data: null }),
    reviewResult.data?.reviewer_id ? supabase.from("profiles").select("display_name").eq("id", reviewResult.data.reviewer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const name = apprentice ? personName(apprentice) : pack.gta_id;
  const section1 = [
    ["Apprentice name", name],
    ["Review date", "Filled in once the review is verified from the Plan page"],
    ["Apprenticeship standard / route / level", programme.data?.name || "Not recorded"],
    ["Release day", apprentice?.release_day || "Not recorded"],
    ["GTA reviewer", reviewer.data?.display_name || "Reiss"],
    ["Apprenticeship start date", "Not recorded on the apprentice row"],
    ["Apprenticeship planned end date", "Not recorded on the apprentice row"],
    ["Employer / workplace", employer.data?.company_name || "Not recorded"],
    ["Postcode", site.data?.postcode || "Not recorded"],
    ["Employer contact name", manager.data ? formatManagerName({ firstName: manager.data.first_name, middleNames: manager.data.middle_names, lastName: manager.data.last_name }) : "Not recorded"],
    ["Employer contact phone", manager.data?.phone || "Not recorded"],
    ["Employer contact email", "Not recorded"],
    ["Planned review date", reviewResult.data?.planned_on ? formatTutorDate(reviewResult.data.planned_on) : "Not set"],
    ["Previous review date", "See the learner Reviews tab"],
  ].map(([label, value]) => ({ label, value }));
  return {
    packId,
    gtaId: pack.gta_id,
    name,
    stage: pack.stage,
    editable: pack.stage === "with_tutor" && Boolean(userId) && pack.tutor_id === userId,
    intervalWeeks: reviewResult.data?.interval_weeks || 10,
    today,
    section1,
    form,
    savedAt: formResult.data?.draft_saved_at || null,
    loadError: null,
  };
}

export async function loadDigitalReview(packId: string, userId: string | null): Promise<DigitalReview> {
  const supabase = await createSupabaseServerClient();
  return readDigitalReview(supabase, packId, userId);
}

export function tutorLearners(page: CyclePage, tutorId: string): CycleLearner[] {
  return page.learners.filter((learner) => learner.tutorId === tutorId && learner.packId);
}
