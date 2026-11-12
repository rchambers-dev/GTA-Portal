import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { formatManagerName } from "@/features/administration/domain/employer-record";
import {
  methodLabel,
  minutesToTime,
  nextReviewDate,
  reviewDueLabel,
  timeToMinutes,
  type DueState,
} from "./plan-due";

export type PlanCounter = "waiting" | "to_book" | "locked" | "booked";

export type PlanPerson = {
  gtaId: string;
  name: string;
  tutor: string;
  company: string;
  postcode: string;
  location: string;
  phone: string;
  contact: string;
  releaseDay: string;
  counter: PlanCounter;
  reviewId: string | null;
  stage: string | null;
  method: string;
  appointmentOn: string | null;
  appointmentMinutes: number | null;
  notes: string;
  notesUntil: string;
  signoffId: string | null;
  dueLabel: string;
  dueState: DueState;
  safeguarding: boolean;
  concern: boolean;
};

export type PlanStop = {
  gtaId: string;
  name: string;
  company: string;
  postcode: string;
  phone: string;
  contact: string;
  sortOrder: number;
  kind: string;
  verified: boolean;
  completed: boolean;
  accepted: boolean;
  arrive: string;
  leave: string;
  locked: boolean;
  dueLabel: string;
  dueState: DueState;
  safeguarding: boolean;
  signoffId: string | null;
  reviewId: string | null;
  notes: string;
  notesUntil: string;
  method: string;
};

export type PlanSettings = {
  skipToday: boolean;
  officePostcode: string;
  startTime: string;
  callMinutes: number;
  lunchStart: string;
  lunchMinutes: number;
  returnBy: string;
  stayMinutes: number;
  extraEmails: string[];
  hiddenTutorIds: string[];
  outEnabled: boolean;
};

export type CompletedReview = {
  id: string;
  gtaId: string;
  name: string;
  actualOn: string;
  method: string;
  plannedOn: string | null;
};

export type PlanPageData = {
  today: string;
  canWrite: boolean;
  people: PlanPerson[];
  counts: Record<PlanCounter, number>;
  settings: PlanSettings;
  tutors: { id: string; name: string }[];
  monthMarks: { date: string; accepted: boolean; completed: boolean }[];
  day: {
    date: string;
    accepted: boolean;
    completed: boolean;
    stops: PlanStop[];
    completedReviews: CompletedReview[];
  } | null;
  loadError: string | null;
};

const EMPTY_COUNTS: Record<PlanCounter, number> = {
  waiting: 0,
  to_book: 0,
  locked: 0,
  booked: 0,
};

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") return [data as T];
  return [];
}

function isCounter(value: string): value is PlanCounter {
  return value === "waiting" || value === "to_book" || value === "locked" || value === "booked";
}

export async function readPlanPage(
  supabase: SupabaseClient,
  options: { canWrite: boolean; date: string; month: string },
): Promise<PlanPageData> {
  const today = londonToday();
  const monthStart = `${options.month}-01`;
  const [year, month] = options.month.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextMonth = nextMonthDate.toISOString().slice(0, 10);

  const [
    countersResult,
    apprenticesResult,
    employmentsResult,
    employersResult,
    sitesResult,
    managersResult,
    reviewsResult,
    concernsResult,
    signoffsResult,
    tutorsResult,
    settingsResult,
    daysResult,
    stopsResult,
    completedResult,
  ] = await Promise.all([
    supabase.from("plan_counters").select("gta_id, name, tutor, stage, counter, appointment_on"),
    supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name, release_day"),
    supabase
      .from("apprentice_employments")
      .select("gta_id, employer_id, site_id, manager_id")
      .is("end_date", null),
    supabase.from("employers").select("employer_id, company_name"),
    supabase.from("employer_sites").select("id, postcode, area_name"),
    supabase.from("employer_managers").select("id, first_name, middle_names, last_name, phone"),
    supabase
      .from("reviews")
      .select("id, gta_id, status, planned_on, actual_on, method, notes, interval_weeks"),
    supabase.from("learner_concerns").select("gta_id").is("resolved_on", null),
    supabase.from("apprentice_safeguarding_signoffs").select("id, gta_id").is("reversed_at", null),
    supabase.from("profiles").select("id, display_name").eq("base_role", "Tutor"),
    supabase.rpc("get_review_settings"),
    supabase
      .from("review_days")
      .select("date_on, accepted, completed_at")
      .gte("date_on", monthStart)
      .lt("date_on", nextMonth),
    supabase
      .from("review_day_stops")
      .select(
        "gta_id, sort_order, kind, verified, completed, accepted, excluded, arrive_minutes, leave_minutes, locked_until_minutes, accepted_arrive_minutes, accepted_leave_minutes",
      )
      .eq("date_on", options.date)
      .eq("excluded", false),
    supabase
      .from("reviews")
      .select("id, gta_id, actual_on, method, planned_on")
      .eq("status", "completed")
      .order("actual_on", { ascending: false })
      .limit(200),
  ]);

  const problems: string[] = [];
  for (const result of [
    countersResult,
    apprenticesResult,
    employmentsResult,
    reviewsResult,
    settingsResult,
    stopsResult,
  ]) {
    if (result.error) problems.push(result.error.message);
  }

  const employers = new Map(
    ((employersResult.data ?? []) as { employer_id: string; company_name: string }[]).map((row) => [
      row.employer_id,
      row.company_name,
    ]),
  );
  const sites = new Map(
    ((sitesResult.data ?? []) as { id: string; postcode: string; area_name: string }[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const managers = new Map(
    (
      (managersResult.data ?? []) as {
        id: string;
        first_name: string;
        middle_names: string | null;
        last_name: string;
        phone: string | null;
      }[]
    ).map((row) => [row.id, row]),
  );
  const employment = new Map(
    (
      (employmentsResult.data ?? []) as {
        gta_id: string;
        employer_id: string;
        site_id: string;
        manager_id: string;
      }[]
    ).map((row) => [row.gta_id, row]),
  );
  const apprenticeRows = (apprenticesResult.data ?? []) as {
    gta_id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    release_day: string | null;
  }[];
  const release = new Map(apprenticeRows.map((row) => [row.gta_id, row.release_day ?? ""]));
  const apprenticeNames = new Map(
    apprenticeRows.map((row) => [
      row.gta_id,
      [row.first_name, row.middle_names, row.last_name].filter((part) => part && part.trim()).join(" "),
    ]),
  );
  const concerns = new Set(
    ((concernsResult.data ?? []) as { gta_id: string }[]).map((row) => row.gta_id),
  );
  const signed = new Map(
    ((signoffsResult.data ?? []) as { id: string; gta_id: string }[]).map((row) => [row.gta_id, row.id]),
  );
  const noteUntil = new Map<string, string>();
  const untilResult = await supabase.from("reviews").select("id, notes_until");
  if (!untilResult.error) {
    for (const row of (untilResult.data ?? []) as { id: string; notes_until: string | null }[]) {
      if (row.notes_until) noteUntil.set(row.id, row.notes_until);
    }
  }
  type ReviewRow = {
    id: string;
    gta_id: string;
    status: string;
    planned_on: string | null;
    actual_on: string | null;
    method: string | null;
    notes: string | null;
    interval_weeks: number | null;
  };
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const openReview = new Map(reviews.filter((row) => row.status === "open").map((row) => [row.gta_id, row]));
  const lastActual = new Map<string, string>();
  for (const row of reviews) {
    if (row.status !== "completed" || !row.actual_on) continue;
    const current = lastActual.get(row.gta_id);
    if (!current || row.actual_on > current) lastActual.set(row.gta_id, row.actual_on);
  }
  const bookings = new Map<string, { on: string | null; minutes: number | null; method: string | null }>();
  const bookingResult = await supabase
    .from("review_bookings")
    .select("review_id, appointment_on, appointment_minutes, method");
  if (bookingResult.error) problems.push(bookingResult.error.message);
  const reviewById = new Map(reviews.map((row) => [row.id, row]));
  for (const row of (bookingResult.data ?? []) as {
    review_id: string;
    appointment_on: string | null;
    appointment_minutes: number | null;
    method: string | null;
  }[]) {
    const review = reviewById.get(row.review_id);
    if (!review) continue;
    bookings.set(review.gta_id, {
      on: row.appointment_on,
      minutes: row.appointment_minutes,
      method: row.method,
    });
  }

  const people: PlanPerson[] = [];
  const counts = { ...EMPTY_COUNTS };
  for (const row of (countersResult.data ?? []) as {
    gta_id: string;
    name: string;
    tutor: string | null;
    stage: string | null;
    counter: string;
    appointment_on: string | null;
  }[]) {
    if (!isCounter(row.counter)) continue;
    counts[row.counter] += 1;
    const job = employment.get(row.gta_id);
    const site = job ? sites.get(job.site_id) : undefined;
    const manager = job ? managers.get(job.manager_id) : undefined;
    const review = openReview.get(row.gta_id);
    const interval = review?.interval_weeks ?? (concerns.has(row.gta_id) ? 5 : 10);
    const due = reviewDueLabel({
      today,
      nextDate: nextReviewDate({
        lastActual: lastActual.get(row.gta_id) ?? null,
        planned: review?.planned_on ?? null,
        intervalWeeks: interval,
      }),
      intervalWeeks: interval,
    });
    const booking = bookings.get(row.gta_id);
    people.push({
      gtaId: row.gta_id,
      name: row.name,
      tutor: row.tutor?.trim() || "No tutor",
      company: (job && employers.get(job.employer_id)) || "No employer",
      postcode: site?.postcode || "No postcode",
      location: site?.area_name || "No location",
      phone: manager?.phone?.trim() || "",
      contact: manager
        ? formatManagerName({
            firstName: manager.first_name,
            middleNames: manager.middle_names,
            lastName: manager.last_name,
          })
        : "",
      releaseDay: release.get(row.gta_id) || "No release day",
      counter: row.counter,
      reviewId: review?.id ?? null,
      stage: row.stage,
      method: booking?.method || review?.method || "in_person",
      appointmentOn: booking?.on ?? row.appointment_on,
      appointmentMinutes: booking?.minutes ?? null,
      notes: review?.notes?.trim() || "",
      notesUntil: (review && noteUntil.get(review.id)) || "",
      signoffId: signed.get(row.gta_id) ?? null,
      dueLabel: due.label,
      dueState: due.state,
      safeguarding: signed.has(row.gta_id),
      concern: concerns.has(row.gta_id),
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  const byId = new Map(people.map((person) => [person.gtaId, person]));
  const dayRow = ((daysResult.data ?? []) as { date_on: string; accepted: boolean; completed_at: string | null }[]).find(
    (row) => row.date_on === options.date,
  );
  const stops = ((stopsResult.data ?? []) as {
    gta_id: string;
    sort_order: number;
    kind: string;
    verified: boolean;
    completed: boolean;
    accepted: boolean;
    arrive_minutes: number | null;
    leave_minutes: number | null;
    locked_until_minutes: number | null;
    accepted_arrive_minutes: number | null;
    accepted_leave_minutes: number | null;
  }[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((stop) => {
      const person = byId.get(stop.gta_id);
      const arrive = stop.accepted ? stop.accepted_arrive_minutes : stop.arrive_minutes;
      const leave = stop.accepted ? stop.accepted_leave_minutes : stop.leave_minutes;
      return {
        gtaId: stop.gta_id,
        name: person?.name || apprenticeNames.get(stop.gta_id) || stop.gta_id,
        company: person?.company || "No employer",
        postcode: person?.postcode || "",
        phone: person?.phone || "",
        contact: person?.contact || "",
        sortOrder: stop.sort_order,
        kind: stop.kind,
        verified: stop.verified,
        completed: stop.completed,
        accepted: stop.accepted,
        arrive: minutesToTime(arrive),
        leave: minutesToTime(leave),
        locked: stop.locked_until_minutes != null,
        dueLabel: person?.dueLabel || "Not set",
        dueState: person?.dueState || "unknown",
        safeguarding: person?.safeguarding || false,
        signoffId: person?.signoffId ?? null,
        reviewId: person?.reviewId ?? null,
        notes: person?.notes || "",
        notesUntil: person?.notesUntil || "",
        method: person?.method || "in_person",
      } satisfies PlanStop;
    });

  const settingsRow = asRows<{
    skip_today: boolean;
    office_postcode: string;
    start_time: string;
    call_minutes: number;
    lunch_start: string;
    lunch_minutes: number;
    return_by: string;
    stay_minutes: number;
    extra_emails: string[] | null;
    hidden_tutor_ids: string[] | null;
    out_enabled: boolean;
  }>(settingsResult.data)[0];

  const completed = ((completedResult.data ?? []) as {
    id: string;
    gta_id: string;
    actual_on: string | null;
    method: string | null;
    planned_on: string | null;
  }[])
    .filter((row) => row.actual_on === options.date)
    .map((row) => ({
      id: row.id,
      gtaId: row.gta_id,
      name: byId.get(row.gta_id)?.name || apprenticeNames.get(row.gta_id) || row.gta_id,
      actualOn: row.actual_on || options.date,
      method: methodLabel(row.method),
      plannedOn: row.planned_on,
    }));

  return {
    today,
    canWrite: options.canWrite,
    people,
    counts,
    settings: {
      skipToday: settingsRow?.skip_today ?? true,
      officePostcode: settingsRow?.office_postcode || "DN3 3DY",
      startTime: String(settingsRow?.start_time || "10:00:00").slice(0, 5),
      callMinutes: settingsRow?.call_minutes ?? 60,
      lunchStart: String(settingsRow?.lunch_start || "13:00:00").slice(0, 5),
      lunchMinutes: settingsRow?.lunch_minutes ?? 30,
      returnBy: String(settingsRow?.return_by || "16:45:00").slice(0, 5),
      stayMinutes: settingsRow?.stay_minutes ?? 30,
      extraEmails: settingsRow?.extra_emails ?? [],
      hiddenTutorIds: settingsRow?.hidden_tutor_ids ?? [],
      outEnabled: settingsRow?.out_enabled ?? false,
    },
    tutors: ((tutorsResult.data ?? []) as { id: string; display_name: string | null }[])
      .map((row) => ({ id: row.id, name: row.display_name?.trim() || "Tutor" }))
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB")),
    monthMarks: ((daysResult.data ?? []) as { date_on: string; accepted: boolean; completed_at: string | null }[]).map(
      (row) => ({ date: row.date_on, accepted: row.accepted, completed: Boolean(row.completed_at) }),
    ),
    day: {
      date: options.date,
      accepted: Boolean(dayRow?.accepted),
      completed: Boolean(dayRow?.completed_at),
      stops,
      completedReviews: completed,
    },
    loadError: problems.length ? problems.join(" ") : null,
  };
}

export async function loadPlanPage(input: {
  canWrite: boolean;
  date: string;
  month: string;
}): Promise<PlanPageData> {
  const supabase = await createSupabaseServerClient();
  return readPlanPage(supabase, input);
}

export { timeToMinutes };
