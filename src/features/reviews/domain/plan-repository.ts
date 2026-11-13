import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import { GTA_TUTORS } from "./gta-tutors";
import { formatManagerName } from "@/features/administration/domain/employer-record";
import { callEndMinutes, heldPastCallEnd, londonClock } from "./plan-call-end";
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
  daysUntil: number;
  nextDate: string | null;
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
  releaseDay: string;
  appointmentOn: string | null;
  sortOrder: number;
  kind: string;
  verified: boolean;
  completed: boolean;
  accepted: boolean;
  arrive: string;
  leave: string;
  arriveMinutes: number | null;
  leaveMinutes: number | null;
  locked: boolean;
  dueLabel: string;
  dueState: DueState;
  tutor: string;
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

export type PlanDay = {
  date: string;
  accepted: boolean;
  completed: boolean;
  stops: PlanStop[];
  completedReviews: CompletedReview[];
};

export type PlanPageData = {
  today: string;
  canWrite: boolean;
  people: PlanPerson[];
  counts: Record<PlanCounter, number>;
  settings: PlanSettings;
  tutors: { id: string; name: string; department: string }[];
  monthMarks: { date: string; accepted: boolean; completed: boolean }[];
  /** Every day in the loaded month that has a route or a completed review. */
  days: PlanDay[];
  day: PlanDay | null;
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
  const released = await supabase.rpc("release_unverified_after_call_end");
  const releaseMissing = released.error?.code === "PGRST202"
    || /release_unverified_after_call_end/i.test(released.error?.message || "");
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
    loadPlanApprentices(supabase),
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
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .in(
        "display_name",
        GTA_TUTORS.map((tutor) => tutor.name),
      ),
    supabase.rpc("get_review_settings"),
    supabase
      .from("review_days")
      .select("date_on, accepted, completed_at, call_anchor_minutes")
      .gte("date_on", monthStart)
      .lt("date_on", nextMonth),
    supabase
      .from("review_day_stops")
      .select(
        "date_on, gta_id, sort_order, kind, verified, completed, accepted, excluded, arrive_minutes, leave_minutes, locked_until_minutes, lock_arrive_minutes, lock_leave_minutes, accepted_arrive_minutes, accepted_leave_minutes",
      )
      .gte("date_on", monthStart)
      .lt("date_on", nextMonth)
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
  if (released.error && !releaseMissing) problems.push(released.error.message);

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
  const apprenticeRows = excludeTestApprentices((apprenticesResult.data ?? []) as {
    gta_id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    release_day: string | null;
    is_test?: boolean | null;
  }[]);
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
      daysUntil: due.daysUntil,
      nextDate: due.nextDate,
      safeguarding: signed.has(row.gta_id),
      concern: concerns.has(row.gta_id),
    });
  }
  const dueRank = { overdue: 3, "due-soon": 2, ok: 1, unknown: 0 } as const;
  people.sort((a, b) => {
    const rank = dueRank[b.dueState] - dueRank[a.dueState];
    if (rank) return rank;
    const days = a.daysUntil - b.daysUntil;
    if (days) return days;
    const company = a.company.localeCompare(b.company, "en-GB");
    if (company) return company;
    return a.name.localeCompare(b.name, "en-GB");
  });

  const byId = new Map(people.map((person) => [person.gtaId, person]));
  const dayRows = (daysResult.data ?? []) as {
    date_on: string;
    accepted: boolean;
    completed_at: string | null;
    call_anchor_minutes: number | null;
  }[];
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
  const clock = londonClock();
  const lunchStart = timeToMinutes(String(settingsRow?.lunch_start || "13:00").slice(0, 5)) ?? 13 * 60;
  const callEnd = callEndMinutes({
    startMinutes: timeToMinutes(String(settingsRow?.start_time || "10:00").slice(0, 5)) ?? 10 * 60,
    lunchStart,
    lunchEnd: lunchStart + (settingsRow?.lunch_minutes ?? 30),
    callAnchorMinutes: dayRows.find((row) => row.date_on === clock.today)?.call_anchor_minutes ?? null,
  });
  type StopRow = {
    date_on: string;
    gta_id: string;
    sort_order: number;
    kind: string;
    verified: boolean;
    completed: boolean;
    accepted: boolean;
    arrive_minutes: number | null;
    leave_minutes: number | null;
    locked_until_minutes: number | null;
    lock_arrive_minutes: number | null;
    lock_leave_minutes: number | null;
    accepted_arrive_minutes: number | null;
    accepted_leave_minutes: number | null;
  };
  function toStop(stop: StopRow): PlanStop {
    const person = byId.get(stop.gta_id);
    const arrive = stop.accepted
      ? stop.accepted_arrive_minutes
      : (stop.arrive_minutes ?? stop.lock_arrive_minutes);
    const leave = stop.accepted
      ? stop.accepted_leave_minutes
      : (stop.leave_minutes ?? stop.lock_leave_minutes);
    return {
      gtaId: stop.gta_id,
      name: person?.name || apprenticeNames.get(stop.gta_id) || stop.gta_id,
      company: person?.company || "No employer",
      postcode: person?.postcode || "",
      phone: person?.phone || "",
      contact: person?.contact || "",
      releaseDay: person?.releaseDay || "",
      appointmentOn: person?.appointmentOn ?? null,
      sortOrder: stop.sort_order,
      kind: stop.kind,
      verified: stop.verified,
      completed: stop.completed,
      accepted: stop.accepted,
      arrive: minutesToTime(arrive),
      leave: minutesToTime(leave),
      arriveMinutes: arrive,
      leaveMinutes: leave,
      locked: stop.locked_until_minutes != null,
      dueLabel: person?.dueLabel || "Not set",
      dueState: person?.dueState || "unknown",
      tutor: person?.tutor || "",
      safeguarding: person?.safeguarding || false,
      signoffId: person?.signoffId ?? null,
      reviewId: person?.reviewId ?? null,
      notes: person?.notes || "",
      notesUntil: person?.notesUntil || "",
      method: person?.method || "in_person",
    };
  }
  const stopsByDate = new Map<string, PlanStop[]>();
  for (const stop of (stopsResult.data ?? []) as StopRow[]) {
    const built = toStop(stop);
    if (
      !bookingResult.error &&
      heldPastCallEnd(built, { date: stop.date_on, today: clock.today, nowMinutes: clock.minutes, callEnd })
    ) {
      continue;
    }
    const list = stopsByDate.get(stop.date_on) ?? [];
    list.push(built);
    stopsByDate.set(stop.date_on, list);
  }
  for (const list of stopsByDate.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const completedByDate = new Map<string, CompletedReview[]>();
  for (const row of (completedResult.data ?? []) as {
    id: string;
    gta_id: string;
    actual_on: string | null;
    method: string | null;
    planned_on: string | null;
  }[]) {
    if (!row.actual_on || row.actual_on < monthStart || row.actual_on >= nextMonth) continue;
    const list = completedByDate.get(row.actual_on) ?? [];
    list.push({
      id: row.id,
      gtaId: row.gta_id,
      name: byId.get(row.gta_id)?.name || apprenticeNames.get(row.gta_id) || row.gta_id,
      actualOn: row.actual_on,
      method: methodLabel(row.method),
      plannedOn: row.planned_on,
    });
    completedByDate.set(row.actual_on, list);
  }
  const dayMeta = new Map(dayRows.map((row) => [row.date_on, row]));
  const dateKeys = new Set<string>([...dayMeta.keys(), ...stopsByDate.keys(), ...completedByDate.keys()]);
  const days = [...dateKeys].sort().map((dateOn) => ({
    date: dateOn,
    accepted: Boolean(dayMeta.get(dateOn)?.accepted),
    completed: Boolean(dayMeta.get(dateOn)?.completed_at),
    stops: stopsByDate.get(dateOn) ?? [],
    completedReviews: completedByDate.get(dateOn) ?? [],
  }));
  const emptyDay = {
    date: options.date,
    accepted: Boolean(dayMeta.get(options.date)?.accepted),
    completed: Boolean(dayMeta.get(options.date)?.completed_at),
    stops: [],
    completedReviews: [],
  };

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
      extraEmails: Array.isArray(settingsRow?.extra_emails) ? settingsRow.extra_emails : [],
      hiddenTutorIds: Array.isArray(settingsRow?.hidden_tutor_ids) ? settingsRow.hidden_tutor_ids : [],
      outEnabled: settingsRow?.out_enabled ?? false,
    },
    tutors: officialTutors((tutorsResult.data ?? []) as { id: string; display_name: string | null; email: string | null }[]),
    monthMarks: dayRows.map((row) => ({
      date: row.date_on,
      accepted: row.accepted,
      completed: Boolean(row.completed_at),
    })),
    days,
    day: days.find((item) => item.date === options.date) ?? emptyDay,
    loadError: problems.length ? problems.join(" ") : null,
  };
}

function officialTutors(rows: { id: string; display_name: string | null; email: string | null }[]) {
  const byName = new Map(rows.map((row) => [row.display_name?.trim().toLowerCase() || "", row]));
  const byEmail = new Map(rows.map((row) => [row.email?.trim().toLowerCase() || "", row]));
  return [...GTA_TUTORS]
    .map((tutor) => {
      const profile = byName.get(tutor.name.toLowerCase()) || byEmail.get(tutor.email.toLowerCase());
      return { id: profile?.id || "", name: tutor.name, department: tutor.trade };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

export type RebookMonthStop = {
  gtaId: string;
  sortOrder: number;
  arriveMinutes: number | null;
  leaveMinutes: number | null;
};

export type RebookMonthDay = {
  date: string;
  accepted: boolean;
  completed: boolean;
  stops: RebookMonthStop[];
};

/** Stops and route flags for one month, so the rebook calendar can fit a visit on a day that is not the month open on the plan. */
export async function readRebookMonth(
  supabase: SupabaseClient,
  month: string,
): Promise<{ days: RebookMonthDay[]; error: string | null }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { days: [], error: "That month is not available." };
  await supabase.rpc("release_unverified_after_call_end");
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const clock = londonClock();
  const [daysResult, stopsResult, settingsResult, reviewsResult] = await Promise.all([
    supabase.from("review_days").select("date_on, accepted, completed_at, call_anchor_minutes").gte("date_on", monthStart).lt("date_on", nextMonth),
    supabase
      .from("review_day_stops")
      .select(
        "date_on, gta_id, sort_order, verified, completed, accepted, arrive_minutes, leave_minutes, lock_arrive_minutes, lock_leave_minutes, accepted_arrive_minutes, accepted_leave_minutes",
      )
      .gte("date_on", monthStart)
      .lt("date_on", nextMonth)
      .eq("excluded", false),
    supabase.rpc("get_review_settings"),
    supabase.from("reviews").select("gta_id, review_bookings(appointment_on)").eq("status", "open"),
  ]);
  if (daysResult.error || stopsResult.error) {
    return { days: [], error: daysResult.error?.message || stopsResult.error?.message || "That month could not be loaded." };
  }
  const settingsRow = asRows<{ start_time: string; lunch_start: string; lunch_minutes: number }>(settingsResult.data)[0];
  const lunchStart = timeToMinutes(String(settingsRow?.lunch_start || "13:00").slice(0, 5)) ?? 13 * 60;
  const dayRowsForAnchor = (daysResult.data ?? []) as { date_on: string; call_anchor_minutes: number | null }[];
  const callEnd = callEndMinutes({
    startMinutes: timeToMinutes(String(settingsRow?.start_time || "10:00").slice(0, 5)) ?? 10 * 60,
    lunchStart,
    lunchEnd: lunchStart + (settingsRow?.lunch_minutes ?? 30),
    callAnchorMinutes: dayRowsForAnchor.find((row) => row.date_on === clock.today)?.call_anchor_minutes ?? null,
  });
  const bookedToday = new Set<string>();
  if (!reviewsResult.error) {
    for (const row of (reviewsResult.data ?? []) as {
      gta_id: string;
      review_bookings: { appointment_on: string | null } | { appointment_on: string | null }[] | null;
    }[]) {
      const booking = Array.isArray(row.review_bookings) ? row.review_bookings[0] : row.review_bookings;
      if (booking?.appointment_on === clock.today) bookedToday.add(row.gta_id);
    }
  }
  const stopsByDate = new Map<string, RebookMonthStop[]>();
  for (const stop of (stopsResult.data ?? []) as {
    date_on: string;
    gta_id: string;
    sort_order: number;
    verified: boolean;
    completed: boolean;
    accepted: boolean;
    arrive_minutes: number | null;
    leave_minutes: number | null;
    lock_arrive_minutes: number | null;
    lock_leave_minutes: number | null;
    accepted_arrive_minutes: number | null;
    accepted_leave_minutes: number | null;
  }[]) {
    if (
      !reviewsResult.error &&
      heldPastCallEnd(
        {
          verified: stop.verified,
          completed: stop.completed,
          accepted: stop.accepted,
          appointmentOn: bookedToday.has(stop.gta_id) ? clock.today : null,
        },
        { date: stop.date_on, today: clock.today, nowMinutes: clock.minutes, callEnd },
      )
    ) {
      continue;
    }
    const arrive = stop.accepted ? stop.accepted_arrive_minutes : (stop.arrive_minutes ?? stop.lock_arrive_minutes);
    const leave = stop.accepted ? stop.accepted_leave_minutes : (stop.leave_minutes ?? stop.lock_leave_minutes);
    const list = stopsByDate.get(stop.date_on) ?? [];
    list.push({ gtaId: stop.gta_id, sortOrder: stop.sort_order, arriveMinutes: arrive, leaveMinutes: leave });
    stopsByDate.set(stop.date_on, list);
  }
  for (const list of stopsByDate.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  const dayRows = (daysResult.data ?? []) as { date_on: string; accepted: boolean; completed_at: string | null }[];
  const meta = new Map(dayRows.map((row) => [row.date_on, row]));
  const dates = new Set<string>([...meta.keys(), ...stopsByDate.keys()]);
  return {
    days: [...dates].sort().map((date) => ({
      date,
      accepted: Boolean(meta.get(date)?.accepted),
      completed: Boolean(meta.get(date)?.completed_at),
      stops: stopsByDate.get(date) ?? [],
    })),
    error: null,
  };
}

async function loadPlanApprentices(supabase: SupabaseClient) {
  const columns = "gta_id, first_name, middle_names, last_name, release_day";
  const withFlag = await supabase.from("apprentices").select(`${columns}, is_test`);
  if (withFlag.error && isMissingTestColumn(withFlag.error.message)) {
    return supabase.from("apprentices").select(columns);
  }
  return withFlag;
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
