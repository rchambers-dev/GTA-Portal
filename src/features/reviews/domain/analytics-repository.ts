import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import {
  buildAnalytics,
  isLiveApprentice,
  type AnalyticsEvent,
  type AnalyticsFilters,
  type AnalyticsRange,
  type AnalyticsSource,
} from "./analytics";

export function parseAnalyticsFilters(input: {
  range?: string;
  tutor?: string;
  programme?: string;
  employer?: string;
}): AnalyticsFilters {
  const range: AnalyticsRange = input.range === "week" || input.range === "4" || input.range === "12" ? input.range : "all";
  return {
    range,
    tutorId: input.tutor || "all",
    programmeId: input.programme || "all",
    employerId: input.employer || "all",
  };
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function loadAnalytics(filters: AnalyticsFilters) {
  const supabase = await createSupabaseServerClient();
  const today = londonToday();
  const columns = "gta_id, first_name, middle_names, last_name, programme_id, status";
  const withFlag = await supabase.from("apprentices").select(`${columns}, is_test`);
  const apprenticesResult =
    withFlag.error && isMissingTestColumn(withFlag.error.message)
      ? await supabase.from("apprentices").select(columns)
      : withFlag;
  const [jobs, employers, programmes, tutors, profiles, reviews, packs, events, signoffs, concerns, breaks] =
    await Promise.all([
      supabase.from("apprentice_employments").select("gta_id, employer_id").is("end_date", null),
      supabase.from("employers").select("employer_id, company_name"),
      supabase.from("programmes").select("id, name"),
      supabase.from("apprentice_tutors").select("apprentice_id, tutor_id").is("end_date", null),
      supabase.from("profiles").select("id, display_name, base_role"),
      supabase.from("reviews").select("id, gta_id, status, planned_on, actual_on, method"),
      supabase.from("review_packs").select("id, gta_id, stage, stage_since"),
      supabase.from("review_pack_events").select("pack_id, event_type, occurred_at, actor_profile_id, actor_role, detail"),
      supabase.from("apprentice_safeguarding_signoffs").select("gta_id, reversed_at"),
      supabase.from("learner_concerns").select("gta_id, resolved_on"),
      supabase.from("breaks_in_learning").select("apprentice_id, actual_return"),
    ]);
  const failed = [apprenticesResult, reviews, packs].find((result) => result.error);
  const names = new Map(rows<{ id: string; display_name: string | null }>(profiles.data).map((row) => [row.id, row.display_name || "Reviewer"]));
  const roles = new Map(rows<{ id: string; base_role: string | null }>(profiles.data).map((row) => [row.id, row.base_role || ""]));
  const employerName = new Map(rows<{ employer_id: string; company_name: string | null }>(employers.data).map((row) => [row.employer_id, row.company_name || "Employer"]));
  const programmeName = new Map(rows<{ id: string; name: string | null }>(programmes.data).map((row) => [row.id, row.name || "Programme"]));
  const job = new Map(rows<{ gta_id: string; employer_id: string | null }>(jobs.data).map((row) => [row.gta_id, row.employer_id]));
  const tutorOf = new Map(rows<{ apprentice_id: string; tutor_id: string }>(tutors.data).map((row) => [row.apprentice_id, row.tutor_id]));
  const packGta = new Map(rows<{ id: string; gta_id: string }>(packs.data).map((row) => [row.id, row.gta_id]));

  const learners = excludeTestApprentices(
    rows<{ gta_id: string; first_name: string | null; middle_names: string | null; last_name: string | null; programme_id: string | null; status: string | null; is_test?: boolean | null }>(
      apprenticesResult.data,
    ),
  )
    .filter((row) => isLiveApprentice(row.status, row.is_test ?? false))
    .map((row) => {
      const tutorId = tutorOf.get(row.gta_id) || null;
      const employerId = job.get(row.gta_id) || null;
      return {
        gtaId: row.gta_id,
        name: [row.first_name, row.middle_names, row.last_name].filter(Boolean).join(" ") || row.gta_id,
        programmeId: row.programme_id,
        programme: row.programme_id ? programmeName.get(row.programme_id) || "Programme" : "No programme",
        employerId,
        employer: employerId ? employerName.get(employerId) || "Employer" : "No employer",
        tutorId,
        tutor: tutorId ? names.get(tutorId) || "Tutor" : "No tutor set",
      };
    });

  const source: AnalyticsSource = {
    today,
    learners,
    reviews: rows<{ id: string; gta_id: string; status: string; planned_on: string | null; actual_on: string | null; method: string | null }>(reviews.data).map((row) => ({
      id: row.id,
      gtaId: row.gta_id,
      status: row.status,
      plannedOn: row.planned_on,
      actualOn: row.actual_on,
      method: row.method,
    })),
    packs: rows<{ id: string; gta_id: string; stage: string; stage_since: string | null }>(packs.data).map((row) => ({
      id: row.id,
      gtaId: row.gta_id,
      stage: row.stage,
      stageSince: row.stage_since,
    })),
    events: rows<{ pack_id: string; event_type: string; occurred_at: string; actor_profile_id: string | null; actor_role: string | null; detail: unknown }>(
      events.data,
    ).map((row) => ({
      packId: row.pack_id,
      gtaId: packGta.get(row.pack_id) || "",
      type: row.event_type,
      at: row.occurred_at,
      actorName: row.actor_profile_id ? names.get(row.actor_profile_id) || "" : "",
      actorRole: row.actor_role || (row.actor_profile_id ? roles.get(row.actor_profile_id) || "" : ""),
      detail: detailText(row.detail),
    })).filter((event) => event.gtaId),
    activeSignoffs: rows<{ gta_id: string; reversed_at: string | null }>(signoffs.data)
      .filter((row) => !row.reversed_at)
      .map((row) => row.gta_id),
    reversedSignoffs: rows<{ gta_id: string; reversed_at: string | null }>(signoffs.data)
      .filter((row) => row.reversed_at)
      .map((row) => row.gta_id),
    openConcerns: rows<{ gta_id: string; resolved_on: string | null }>(concerns.data)
      .filter((row) => !row.resolved_on)
      .map((row) => row.gta_id),
    resolvedConcerns: rows<{ gta_id: string; resolved_on: string | null }>(concerns.data)
      .filter((row) => row.resolved_on)
      .map((row) => row.gta_id),
    openBreaks: rows<{ apprentice_id: string; actual_return: string | null }>(breaks.data)
      .filter((row) => !row.actual_return)
      .map((row) => row.apprentice_id),
  };

  return {
    today,
    filters,
    loadError: failed?.error?.message ?? breaks.error?.message ?? null,
    page: buildAnalytics(source, filters),
  };
}

function detailText(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const record = detail as Record<string, unknown>;
  const reason = record.reason || record.summary;
  return typeof reason === "string" ? reason : "";
}

export type { AnalyticsEvent };
