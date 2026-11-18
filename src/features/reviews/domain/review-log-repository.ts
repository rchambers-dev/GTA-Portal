import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import { isLiveApprentice } from "./analytics";
import { type DayUndoPlan, type LogRange, type ReviewLogEvent } from "./review-log";

export type ReviewLogQuery = {
  query: string;
  learnerId: string;
  tutorId: string;
  eventType: string;
  range: LogRange;
  page: number;
};

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function detailText(detail: unknown): { text: string; undoes: string | null; dayOn: string | null } {
  if (!detail || typeof detail !== "object") return { text: "", undoes: null, dayOn: null };
  const record = detail as Record<string, unknown>;
  const undoes = typeof record.undoes === "string" ? record.undoes : null;
  const actual = typeof record.actual_on === "string" ? record.actual_on.slice(0, 10) : "";
  const dayOn = /^\d{4}-\d{2}-\d{2}$/.test(actual) ? actual : null;
  for (const key of ["note", "reason", "summary"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return { text: value.trim(), undoes, dayOn };
  }
  return { text: "", undoes, dayOn };
}

function functionMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || /could not find the function/i.test(error.message || "");
}

export function parseLogQuery(input: {
  q?: string;
  learner?: string;
  tutor?: string;
  event?: string;
  range?: string;
  page?: string;
}): ReviewLogQuery {
  const range: LogRange = input.range === "week" || input.range === "4" || input.range === "12" ? input.range : "all";
  const page = Number(input.page);
  return {
    query: input.q?.trim() || "",
    learnerId: input.learner || "all",
    tutorId: input.tutor || "all",
    eventType: input.event || "all",
    range,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export async function loadReviewLog() {
  const supabase = await createSupabaseServerClient();
  const today = londonToday();
  const columns = "gta_id, first_name, middle_names, last_name, status";
  const withFlag = await supabase.from("apprentices").select(`${columns}, is_test`);
  const apprenticesResult =
    withFlag.error && isMissingTestColumn(withFlag.error.message)
      ? await supabase.from("apprentices").select(columns)
      : withFlag;
  const [tutors, profiles, packs, events, days, stops, probe, dayProbe] = await Promise.all([
    supabase.from("apprentice_tutors").select("apprentice_id, tutor_id").is("end_date", null),
    supabase.from("profiles").select("id, display_name, base_role"),
    supabase.from("review_packs").select("id, gta_id"),
    supabase.from("review_pack_events").select("id, pack_id, event_type, from_stage, to_stage, occurred_at, actor_profile_id, actor_role, detail"),
    supabase.from("review_days").select("date_on, completed_at").not("completed_at", "is", null),
    supabase.from("review_day_stops").select("date_on, gta_id, sort_order").eq("completed", true),
    supabase.rpc("undo_review_pack_event", { p_event_id: "00000000-0000-0000-0000-000000000000" }),
    supabase.rpc("undo_review_day_completion", { p_day_id: "1900-01-01" }),
  ]);
  const names = new Map(rows<{ id: string; display_name: string | null }>(profiles.data).map((row) => [row.id, row.display_name || "Reviewer"]));
  const roles = new Map(rows<{ id: string; base_role: string | null }>(profiles.data).map((row) => [row.id, row.base_role || ""]));
  const tutorOf = new Map(rows<{ apprentice_id: string; tutor_id: string }>(tutors.data).map((row) => [row.apprentice_id, row.tutor_id]));
  const packGta = new Map(rows<{ id: string; gta_id: string }>(packs.data).map((row) => [row.id, row.gta_id]));
  const learners = excludeTestApprentices(
    rows<{ gta_id: string; first_name: string | null; middle_names: string | null; last_name: string | null; status: string | null; is_test?: boolean | null }>(
      apprenticesResult.data,
    ),
  ).filter((row) => isLiveApprentice(row.status, row.is_test ?? false));
  const learnerName = new Map(
    learners.map((row) => [row.gta_id, [row.first_name, row.middle_names, row.last_name].filter(Boolean).join(" ") || row.gta_id]),
  );
  const log: ReviewLogEvent[] = rows<{
    id: string;
    pack_id: string;
    event_type: string;
    from_stage: string | null;
    to_stage: string | null;
    occurred_at: string;
    actor_profile_id: string | null;
    actor_role: string | null;
    detail: unknown;
  }>(events.data)
    .map((row) => {
      const gtaId = packGta.get(row.pack_id) || "";
      const detail = detailText(row.detail);
      const tutorId = tutorOf.get(gtaId) || null;
      return {
        id: row.id,
        gtaId,
        learner: learnerName.get(gtaId) || gtaId,
        tutorId,
        tutor: tutorId ? names.get(tutorId) || "Tutor" : "No tutor set",
        type: row.event_type,
        fromStage: row.from_stage,
        toStage: row.to_stage,
        at: row.occurred_at,
        actor: row.actor_profile_id ? names.get(row.actor_profile_id) || "System" : "System",
        role: row.actor_profile_id ? row.actor_role || roles.get(row.actor_profile_id) || "" : "System",
        detail: detail.text,
        undoes: detail.undoes,
        dayOn: detail.dayOn,
      };
    })
    .filter((event) => event.gtaId && learnerName.has(event.gtaId));
  const learnersOnDay = new Map<string, { gtaId: string; sort: number }[]>();
  for (const stop of rows<{ date_on: string; gta_id: string; sort_order: number | null }>(stops.data)) {
    const date = stop.date_on.slice(0, 10);
    const list = learnersOnDay.get(date) || [];
    list.push({ gtaId: stop.gta_id, sort: stop.sort_order ?? 0 });
    learnersOnDay.set(date, list);
  }
  const dayPlans: DayUndoPlan[] = rows<{ date_on: string; completed_at: string }>(days.data).flatMap((day) => {
    const date = day.date_on.slice(0, 10);
    const learners = (learnersOnDay.get(date) || [])
      .sort((a, b) => a.sort - b.sort || a.gtaId.localeCompare(b.gtaId))
      .filter((stop) => learnerName.has(stop.gtaId))
      .map((stop) => ({ gtaId: stop.gtaId, name: learnerName.get(stop.gtaId) || stop.gtaId }));
    if (!day.completed_at || learners.length === 0) return [];
    return [{ date, completedAt: day.completed_at, learners }];
  });
  const undoReady = !functionMissing(probe.error);
  const dayUndoReady = !functionMissing(dayProbe.error);
  const failed = [apprenticesResult, packs, events].find((result) => result.error);
  return { today, events: log, days: dayPlans, undoReady, dayUndoReady, loadError: failed?.error?.message ?? null };
}
