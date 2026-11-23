import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import { buildReviewBoard, earliestBookedOn, latestCompletedOn, planBoardPill, stagePresentation, type BoardCard, type ReviewBoard } from "./review-board";

export type ReviewBoardPage = ReviewBoard & { loadError: string | null };

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function missingRelation(message: string | undefined, name: string): boolean {
  return Boolean(message && message.includes(name) && /does not exist|schema cache|column/i.test(message));
}

export async function readReviewBoard(supabase: SupabaseClient): Promise<ReviewBoardPage> {
  const today = londonToday();
  const apprenticeColumns = "gta_id, first_name, middle_names, last_name, status";
  const withFlag = await supabase.from("apprentices").select(`${apprenticeColumns}, is_test`);
  const apprenticesResult =
    withFlag.error && isMissingTestColumn(withFlag.error.message)
      ? await supabase.from("apprentices").select(apprenticeColumns)
      : withFlag;
  const reviewSelect = "id, gta_id, status, planned_on, shelved_at";
  const reviewFallback = await supabase.from("reviews").select(reviewSelect).eq("status", "open");
  const reviewsResult = reviewFallback.error && missingRelation(reviewFallback.error.message, "shelved_at")
    ? await supabase.from("reviews").select("id, gta_id, status, planned_on").eq("status", "open")
    : reviewFallback;
  const [
    packsResult,
    tutorsResult,
    profilesResult,
    jobsResult,
    employersResult,
    settingsResult,
    holdsResult,
    concernsResult,
    exitsResult,
    completedResult,
    countersResult,
    stopsResult,
  ] = await Promise.all([
    supabase.from("review_packs").select("review_id, stage"),
    supabase.from("apprentice_tutors").select("apprentice_id, tutor_id").is("end_date", null),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("apprentice_employments").select("gta_id, employer_id").is("end_date", null),
    supabase.from("employers").select("employer_id, company_name"),
    supabase.rpc("get_review_settings"),
    supabase.from("review_holds").select("review_id, held_until, released_at"),
    supabase.from("learner_concerns").select("gta_id").is("resolved_on", null),
    supabase.from("learner_exits").select("gta_id, reversed_at"),
    everyPage<{ gta_id: string; actual_on: string | null }>((from, to) =>
      supabase.from("reviews").select("gta_id, actual_on").eq("status", "completed").not("actual_on", "is", null).range(from, to),
    ),
    supabase.from("plan_counters").select("gta_id, stage, counter, appointment_on, awaiting_date"),
    everyPage<{ gta_id: string; date_on: string; verified: boolean | null; completed: boolean | null; accepted: boolean | null; kind: string | null }>((from, to) =>
      supabase
        .from("review_day_stops")
        .select("gta_id, date_on, verified, completed, accepted, kind")
        .gte("date_on", today)
        .order("date_on", { ascending: true })
        .range(from, to),
    ),
  ]);

  const problems = [apprenticesResult, reviewsResult, completedResult, countersResult, stopsResult]
    .filter((result) => result.error)
    .map((result) => result.error?.message);
  const counterOf = new Map(
    rows<{ gta_id: string; stage: string | null; counter: string | null; appointment_on: string | null; awaiting_date: string | null }>(
      countersResult.data,
    ).map((row) => [row.gta_id, row]),
  );
  const nextBooked = earliestBookedOn(
    rows<{ gta_id: string; date_on: string; verified: boolean | null; completed: boolean | null }>(stopsResult.data).map((row) => ({
      gtaId: row.gta_id,
      dateOn: row.date_on,
      verified: Boolean(row.verified),
      completed: Boolean(row.completed),
    })),
    today,
  );
  const lastOn = latestCompletedOn(
    rows<{ gta_id: string; actual_on: string | null }>(completedResult.data).map((row) => ({
      gtaId: row.gta_id,
      actualOn: row.actual_on,
    })),
  );
  const settingsRows = Array.isArray(settingsResult.data)
    ? settingsResult.data
    : settingsResult.data
      ? [settingsResult.data]
      : [];
  const hidden = new Set<string>(
    (settingsRows as { hidden_tutor_ids?: string[] | null }[]).flatMap((row) => row.hidden_tutor_ids ?? []),
  );
  const names = new Map(rows<{ id: string; display_name: string | null }>(profilesResult.data).map((row) => [row.id, row.display_name?.trim() || "Tutor"]));
  const tutorOf = new Map(
    rows<{ apprentice_id: string; tutor_id: string }>(tutorsResult.data).map((row) => [row.apprentice_id, row.tutor_id]),
  );
  const employerOf = new Map(
    rows<{ gta_id: string; employer_id: string }>(jobsResult.data).map((row) => [row.gta_id, row.employer_id]),
  );
  const employerName = new Map(
    rows<{ employer_id: string; company_name: string | null }>(employersResult.data).map((row) => [row.employer_id, row.company_name?.trim() || "Employer"]),
  );
  const stageOf = new Map(rows<{ review_id: string; stage: string | null }>(packsResult.data).map((row) => [row.review_id, row.stage]));
  const concern = new Set(rows<{ gta_id: string }>(concernsResult.data).map((row) => row.gta_id));
  const exited = new Set(
    exitsResult.error
      ? []
      : rows<{ gta_id: string; reversed_at: string | null }>(exitsResult.data)
          .filter((row) => !row.reversed_at)
          .map((row) => row.gta_id),
  );
  const holds = new Set<string>();
  if (!holdsResult.error) {
    for (const row of rows<{ review_id: string; held_until: string | null; released_at: string | null }>(holdsResult.data)) {
      const until = row.held_until?.slice(0, 10) || "";
      if (!row.released_at && until && until >= today) holds.add(row.review_id);
    }
  }

  type ReviewRow = { id: string; gta_id: string; planned_on: string | null; shelved_at?: string | null };
  const firstOpen = new Map<string, ReviewRow>();
  for (const row of rows<ReviewRow>(reviewsResult.data)) {
    if (row.shelved_at) continue;
    const planned = row.planned_on?.slice(0, 10) || null;
    const current = firstOpen.get(row.gta_id);
    if (!current) {
      firstOpen.set(row.gta_id, { ...row, planned_on: planned });
      continue;
    }
    const currentPlanned = current.planned_on || "9999-99-99";
    const nextPlanned = planned || "9999-99-99";
    if (nextPlanned < currentPlanned) firstOpen.set(row.gta_id, { ...row, planned_on: planned });
  }

  const cards: BoardCard[] = [];
  for (const row of excludeTestApprentices(
    rows<{
      gta_id: string;
      first_name: string | null;
      middle_names: string | null;
      last_name: string | null;
      status: string | null;
      is_test?: boolean | null;
    }>(apprenticesResult.data),
  )) {
    if (row.status !== "in_learning") continue;
    if (exited.has(row.gta_id)) continue;
    const tutorId = tutorOf.get(row.gta_id) || null;
    if (tutorId && hidden.has(tutorId)) continue;
    const review = firstOpen.get(row.gta_id);
    if (!review) continue;
    const packStage = stageOf.get(review.id) ?? null;
    const counter = counterOf.get(row.gta_id);
    const stage = counter
      ? planBoardPill({
          counter: counter.counter,
          stage: counter.stage ?? packStage,
          appointmentOn: counter.appointment_on,
          nextBookedOn: nextBooked.get(row.gta_id) ?? null,
          awaitingDate: counter.awaiting_date,
        })
      : stagePresentation(packStage);
    const employerId = employerOf.get(row.gta_id);
    cards.push({
      gtaId: row.gta_id,
      name: [row.first_name, row.middle_names, row.last_name].filter((part) => part && part.trim()).join(" ") || row.gta_id,
      employer: employerId ? employerName.get(employerId) || "Employer" : "No employer",
      tutor: tutorId ? names.get(tutorId) || "Tutor" : "No tutor",
      plannedOn: review.planned_on,
      lastOn: lastOn.get(row.gta_id) ?? null,
      stage: stage.stage,
      stageLabel: stage.label,
      hold: holds.has(review.id),
      concern: concern.has(row.gta_id),
    });
  }

  return { ...buildReviewBoard(cards, today), loadError: problems[0] ?? null };
}

async function everyPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const size = 1000;
  const data: T[] = [];
  for (let from = 0; from < 20000; from += size) {
    const page = await load(from, from + size - 1);
    if (page.error) return { data, error: page.error };
    const batch = page.data ?? [];
    data.push(...batch);
    if (batch.length < size) return { data, error: null };
  }
  return { data, error: null };
}

export async function loadReviewBoard(): Promise<ReviewBoardPage> {
  const supabase = await createSupabaseServerClient();
  return readReviewBoard(supabase);
}
