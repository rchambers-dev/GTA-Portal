import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { isAssignedGtaId } from "./apprentice-record";
import { asIsoDate, personName, sortReasons, type ReasonOption } from "./apprentice-programme";
import { londonToday, normaliseGtaId } from "./apprentice-tutor";
import {
  explainExitError,
  validateExitReversal,
  validateLearnerExit,
  type ExitActionResult,
  type LearnerExitPage,
  type LearnerExitRecord,
} from "./learner-exit";

type ExitRow = {
  id: string;
  gta_id: string;
  exit_type: string;
  exit_date: string;
  reason: string | null;
  is_safeguarding: boolean | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_note: string | null;
};

type ReasonRow = {
  id: string;
  label: string;
  sort_order: number;
  is_safeguarding: boolean | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type NameMap = Map<string, { display_name: string | null; email: string | null }>;

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") return [data as T];
  return [];
}

function emptyPage(today: string, loadError: string | null): LearnerExitPage {
  return { exits: [], reasons: [], courseStart: null, today, loadError };
}

function mapExit(row: ExitRow, names: NameMap, canManage: boolean): LearnerExitRecord {
  const safeguarding = row.is_safeguarding === true;
  const notesWithheld = safeguarding && !canManage && row.notes == null;
  const reversalNoteWithheld = safeguarding && !canManage && row.reversed_at != null && row.reversal_note == null;
  return {
    id: row.id,
    gtaId: row.gta_id,
    exitType: row.exit_type,
    exitDate: asIsoDate(row.exit_date) ?? row.exit_date,
    reason: row.reason?.trim() || null,
    isSafeguarding: safeguarding,
    notes: row.notes?.trim() || null,
    notesWithheld,
    recordedByName: personName(row.recorded_by ? names.get(row.recorded_by) : undefined),
    recordedAt: row.created_at,
    reversedAt: row.reversed_at,
    reversedByName: row.reversed_by ? personName(names.get(row.reversed_by)) : null,
    reversalNote: row.reversal_note?.trim() || null,
    reversalNoteWithheld,
  };
}

/**
 * Reads exits through get_learner_exits so tutors receive the row with
 * safeguarding notes removed. Withdrawal reasons are only needed to record one.
 */
export async function readLearnerExits(
  supabase: SupabaseClient,
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<LearnerExitPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  const today = londonToday();
  if (!isAssignedGtaId(requestedId)) {
    return emptyPage(today, "GTA IDs look like GTA-000002.");
  }

  const reasonQuery = options.canManage
    ? supabase
        .from("reasons")
        .select("id, label, sort_order, is_safeguarding")
        .eq("used_for_withdrawals", true)
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: [] as ReasonRow[], error: null });

  const [exitResult, courseResult, reasonsResult] = await Promise.all([
    supabase.rpc("get_learner_exits", { p_gta_id: requestedId }),
    supabase.from("apprentices").select("course_start").eq("gta_id", requestedId).maybeSingle(),
    reasonQuery,
  ]);

  const problems: string[] = [];
  if (exitResult.error) problems.push(`Exits could not be loaded. ${exitResult.error.message}`);
  if (courseResult.error) {
    problems.push(`The course start date could not be loaded. ${courseResult.error.message}`);
  }
  if (reasonsResult.error) {
    problems.push(`Withdrawal reasons could not be loaded. ${reasonsResult.error.message}`);
  }

  const exitRows = exitResult.error ? [] : asRows<ExitRow>(exitResult.data);
  const names: NameMap = new Map();
  const nameIds = [
    ...new Set(
      exitRows.flatMap((row) => [row.recorded_by, row.reversed_by]).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (nameIds.length > 0) {
    const nameResult = await supabase.from("profiles").select("id, display_name, email").in("id", nameIds);
    if (nameResult.error) {
      problems.push(`Names could not be loaded. ${nameResult.error.message}`);
    } else {
      for (const row of (nameResult.data ?? []) as ProfileRow[]) {
        names.set(row.id, { display_name: row.display_name, email: row.email });
      }
    }
  }

  const reasons = reasonsResult.error
    ? []
    : sortReasons(
        ((reasonsResult.data ?? []) as ReasonRow[]).map(
          (row): ReasonOption => ({
            id: row.id,
            label: row.label,
            sortOrder: row.sort_order,
            isSafeguarding: row.is_safeguarding === true,
          }),
        ),
      );

  const courseStart = courseResult.error
    ? null
    : asIsoDate((courseResult.data as { course_start?: string | null } | null)?.course_start);

  return {
    exits: exitRows.map((row) => mapExit(row, names, options.canManage)),
    reasons: options.canManage ? reasons : [],
    courseStart,
    today,
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

export async function loadLearnerExits(
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<LearnerExitPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) {
    return emptyPage(londonToday(), "GTA IDs look like GTA-000002.");
  }
  const supabase = await createSupabaseServerClient();
  return readLearnerExits(supabase, requestedId, options);
}

export async function recordLearnerExit(
  supabase: SupabaseClient,
  input: {
    gtaId: string;
    exitType: string;
    exitDate: string;
    reasonId: string;
    notes: string;
    today: string;
  },
): Promise<ExitActionResult> {
  const shape = validateLearnerExit({ ...input, courseStart: null });
  if (!shape.ok) return shape;

  const course = await supabase
    .from("apprentices")
    .select("course_start")
    .eq("gta_id", shape.value.gtaId)
    .maybeSingle();
  if (course.error) return { ok: false, formError: explainExitError(course.error) };
  if (!course.data) {
    return { ok: false, formError: "This apprentice could not be found. Refresh the page." };
  }

  const courseStart = asIsoDate((course.data as { course_start: string | null }).course_start);
  const checked = validateLearnerExit({ ...input, courseStart });
  if (!checked.ok) return checked;

  const { error } = await supabase.rpc("record_learner_exit", {
    p_gta_id: checked.value.gtaId,
    p_exit_type: checked.value.exitType,
    p_exit_date: checked.value.exitDate,
    p_reason_id: checked.value.reasonId,
    p_notes: checked.value.notes,
  });
  if (error) return { ok: false, formError: explainExitError(error) };
  return { ok: true };
}

export async function reverseLearnerExit(
  supabase: SupabaseClient,
  input: { exitId: string; note: string },
): Promise<ExitActionResult> {
  const parsed = validateExitReversal(input);
  if (!parsed.ok) return parsed;
  const { error } = await supabase.rpc("reverse_learner_exit", {
    p_exit_id: parsed.value.exitId,
    p_note: parsed.value.note,
  });
  if (error) return { ok: false, formError: explainExitError(error) };
  return { ok: true };
}
