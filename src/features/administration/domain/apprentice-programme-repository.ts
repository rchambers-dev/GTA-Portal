import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { isAssignedGtaId } from "./apprentice-record";
import {
  PLANNED_DATE_TYPES,
  asIsoDate,
  dateChangeExplanation,
  emptyProgrammePage,
  emptyStoredDates,
  explainProgrammeError,
  personName,
  planCourseDateUpdate,
  plannedDateIsSet,
  plannedDateRow,
  plannedReturnOn,
  sortReasons,
  type ApprenticeBreaks,
  type ApprenticeProgrammePage,
  type BreakRecord,
  type ChecklistItemState,
  type CourseDateSubmission,
  type DateChangeRecord,
  type EffectiveDates,
  type OpenBreak,
  type PlannedDateType,
  type ProgrammeActionResult,
  type ReasonOption,
  type StoredDates,
} from "./apprentice-programme";
import { londonToday, normaliseGtaId } from "./apprentice-tutor";

const DATE_COLUMNS =
  "course_start, planned_course_end, actual_course_end, planned_gateway_1, actual_gateway_1, planned_gateway_2, actual_gateway_2, planned_epa, actual_epa";

type DateRow = {
  course_start: string | null;
  planned_course_end: string | null;
  actual_course_end: string | null;
  planned_gateway_1: string | null;
  actual_gateway_1: string | null;
  planned_gateway_2: string | null;
  actual_gateway_2: string | null;
  planned_epa: string | null;
  actual_epa: string | null;
};

type EffectiveRow = {
  course_end: string | null;
  gateway_1: string | null;
  gateway_2: string | null;
  epa: string | null;
  original_course_end: string | null;
  original_gateway_1: string | null;
  original_gateway_2: string | null;
  original_epa: string | null;
  course_end_changed: boolean | null;
  gateway_1_changed: boolean | null;
  gateway_2_changed: boolean | null;
  epa_changed: boolean | null;
};

type ChangeRow = {
  id: string;
  date_type: string;
  old_date: string | null;
  new_date: string;
  reason: string | null;
  is_safeguarding: boolean | null;
  explanation: string | null;
  extension_paperwork: boolean | null;
  status: string;
  requested_by: string | null;
  requested_at: string;
  signed_off_by: string | null;
  signed_off_at: string | null;
};

type ReasonRow = {
  id: string;
  label: string;
  sort_order: number;
  active?: boolean | null;
  is_safeguarding: boolean | null;
};

type BreakRow = {
  id: string;
  start_date: string;
  planned_return: string | null;
  actual_return: string | null;
  reason_id: string;
  explanation: string;
  started_by: string;
};

type CheckRow = {
  id: string;
  signed_off_by: string | null;
  signed_off_at: string | null;
};

type CheckResultRow = {
  item_id: string;
  passed: boolean | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type NameMap = Map<string, { display_name: string | null; email: string | null }>;

function failure(error: { code?: string; message?: string; details?: string }): ProgrammeActionResult {
  return { ok: false, formError: explainProgrammeError(error) };
}

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") return [data as T];
  return [];
}

function mapStored(row: DateRow): StoredDates {
  return {
    courseStart: asIsoDate(row.course_start),
    plannedCourseEnd: asIsoDate(row.planned_course_end),
    actualCourseEnd: asIsoDate(row.actual_course_end),
    plannedGateway1: asIsoDate(row.planned_gateway_1),
    actualGateway1: asIsoDate(row.actual_gateway_1),
    plannedGateway2: asIsoDate(row.planned_gateway_2),
    actualGateway2: asIsoDate(row.actual_gateway_2),
    plannedEpa: asIsoDate(row.planned_epa),
    actualEpa: asIsoDate(row.actual_epa),
  };
}

function mapEffective(row: EffectiveRow): EffectiveDates {
  return {
    courseEnd: asIsoDate(row.course_end),
    gateway1: asIsoDate(row.gateway_1),
    gateway2: asIsoDate(row.gateway_2),
    epa: asIsoDate(row.epa),
    originalCourseEnd: asIsoDate(row.original_course_end),
    originalGateway1: asIsoDate(row.original_gateway_1),
    originalGateway2: asIsoDate(row.original_gateway_2),
    originalEpa: asIsoDate(row.original_epa),
    courseEndChanged: row.course_end_changed === true,
    gateway1Changed: row.gateway_1_changed === true,
    gateway2Changed: row.gateway_2_changed === true,
    epaChanged: row.epa_changed === true,
  };
}

function mapReason(row: ReasonRow): ReasonOption {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
    isSafeguarding: row.is_safeguarding === true,
  };
}

function mapChange(row: ChangeRow, names: NameMap): DateChangeRecord {
  const isSafeguarding = row.is_safeguarding === true;
  const explanation = dateChangeExplanation({
    isSafeguarding,
    explanation: row.explanation,
  });
  return {
    id: row.id,
    dateType: row.date_type,
    oldDate: asIsoDate(row.old_date),
    newDate: asIsoDate(row.new_date) ?? row.new_date,
    reason: row.reason?.trim() || "Reason unavailable",
    isSafeguarding,
    explanation,
    extensionPaperwork: row.extension_paperwork === true,
    status: row.status,
    requestedByName: personName(row.requested_by ? names.get(row.requested_by) : undefined),
    requestedAt: row.requested_at,
    signedOffByName: row.signed_off_by
      ? personName(names.get(row.signed_off_by))
      : null,
    signedOffAt: row.signed_off_at,
  };
}

async function loadNames(
  supabase: SupabaseClient,
  ids: readonly (string | null | undefined)[],
  into: NameMap,
): Promise<string | null> {
  const missing = [...new Set(ids.filter((id): id is string => Boolean(id)))].filter(
    (id) => !into.has(id),
  );
  if (missing.length === 0) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", missing);
  if (error) return `Names could not be loaded. ${error.message}`;
  for (const row of (data ?? []) as ProfileRow[]) {
    into.set(row.id, { display_name: row.display_name, email: row.email });
  }
  return null;
}

function breakSummary(row: BreakRow, reasons: Map<string, ReasonOption>, names: NameMap): BreakRecord {
  return {
    id: row.id,
    startDate: asIsoDate(row.start_date) ?? row.start_date,
    plannedReturn: plannedReturnOn(asIsoDate(row.start_date) ?? row.start_date, asIsoDate(row.planned_return)),
    actualReturn: asIsoDate(row.actual_return),
    reason: reasons.get(row.reason_id)?.label ?? "Reason unavailable",
    explanation: row.explanation.trim(),
    startedByName: personName(names.get(row.started_by)),
  };
}

/**
 * Reads course dates, the effective planned dates, and date-change history.
 * Breaks are loaded only when canManage is true. Tutors must not receive them.
 */
export async function readApprenticeProgramme(
  supabase: SupabaseClient,
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<ApprenticeProgrammePage> {
  const requestedId = normaliseGtaId(rawGtaId);
  const today = londonToday();
  if (!isAssignedGtaId(requestedId)) {
    return emptyProgrammePage(today, "GTA IDs look like GTA-000002.");
  }

  const reasonQuery = options.canManage
    ? supabase
        .from("date_change_reasons")
        .select("id, label, sort_order, is_safeguarding")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: [] as ReasonRow[], error: null });

  const [datesResult, effectiveResult, changesResult, reasonsResult] = await Promise.all([
    supabase.from("apprentices").select(DATE_COLUMNS).eq("gta_id", requestedId).maybeSingle(),
    supabase.rpc("get_effective_planned_dates", { p_apprentice_id: requestedId }),
    supabase.rpc("get_planned_date_changes", { p_apprentice_id: requestedId }),
    reasonQuery,
  ]);

  const problems: string[] = [];
  if (datesResult.error) {
    problems.push(`Course dates could not be loaded. ${datesResult.error.message}`);
  }
  if (effectiveResult.error) {
    problems.push(`Current planned dates could not be loaded. ${effectiveResult.error.message}`);
  }
  if (changesResult.error) {
    problems.push(`Date changes could not be loaded. ${changesResult.error.message}`);
  }
  if (reasonsResult.error) {
    problems.push(`Date change reasons could not be loaded. ${reasonsResult.error.message}`);
  }

  if (!datesResult.error && !datesResult.data) {
    return emptyProgrammePage(
      today,
      problems.length > 0 ? problems.join(" ") : "This apprentice could not be found.",
    );
  }

  const dates = datesResult.error || !datesResult.data
    ? null
    : mapStored(datesResult.data as DateRow);
  const effectiveRow = effectiveResult.error
    ? null
    : asRows<EffectiveRow>(effectiveResult.data)[0] ?? null;
  const effective = effectiveRow ? mapEffective(effectiveRow) : null;
  const changeRows = changesResult.error ? [] : asRows<ChangeRow>(changesResult.data);
  const dateChangeReasons = reasonsResult.error
    ? []
    : sortReasons(((reasonsResult.data ?? []) as ReasonRow[]).map(mapReason));

  const names: NameMap = new Map();
  const nameProblem = await loadNames(
    supabase,
    changeRows.flatMap((row) => [row.requested_by, row.signed_off_by]),
    names,
  );
  if (nameProblem) problems.push(nameProblem);

  const changes = changeRows.map((row) => mapChange(row, names));
  const breaks = options.canManage
    ? await readBreaks(supabase, requestedId, names, problems)
    : null;

  return {
    dates: dates ?? (datesResult.error ? null : emptyStoredDates()),
    effective,
    changes,
    dateChangeReasons: options.canManage ? dateChangeReasons : [],
    breaks,
    loadError: problems.length > 0 ? problems.join(" ") : null,
    today,
  };
}

async function readBreaks(
  supabase: SupabaseClient,
  gtaId: string,
  names: NameMap,
  problems: string[],
): Promise<ApprenticeBreaks> {
  const [breaksResult, reasonsResult, checklistResult] = await Promise.all([
    supabase
      .from("breaks_in_learning")
      .select("id, start_date, planned_return, actual_return, reason_id, explanation, started_by")
      .eq("apprentice_id", gtaId),
    supabase
      .from("break_reasons")
      .select("id, label, sort_order, active, is_safeguarding")
      .order("sort_order", { ascending: true }),
    supabase
      .from("return_checklist_items")
      .select("id, label, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (breaksResult.error) {
    problems.push(`Breaks in learning could not be loaded. ${breaksResult.error.message}`);
  }
  if (reasonsResult.error) {
    problems.push(`Break reasons could not be loaded. ${reasonsResult.error.message}`);
  }
  if (checklistResult.error) {
    problems.push(`The return checklist could not be loaded. ${checklistResult.error.message}`);
  }

  const breakRows = breaksResult.error ? [] : ((breaksResult.data ?? []) as BreakRow[]);
  const reasonRows = reasonsResult.error ? [] : ((reasonsResult.data ?? []) as ReasonRow[]);
  const reasons = new Map(reasonRows.map((row) => [row.id, mapReason(row)]));
  const activeReasons = sortReasons(
    reasonRows.filter((row) => row.active !== false).map(mapReason),
  );
  const checklist = checklistResult.error
    ? []
    : ((checklistResult.data ?? []) as { id: string; label: string; sort_order: number }[])
        .map((row) => ({ id: row.id, label: row.label, sortOrder: row.sort_order }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "en-GB"));

  const openRows = breakRows
    .filter((row) => row.actual_return === null)
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id.localeCompare(a.id));
  const pastRows = breakRows
    .filter((row) => row.actual_return !== null)
    .sort(
      (a, b) =>
        (b.actual_return ?? "").localeCompare(a.actual_return ?? "") ||
        b.start_date.localeCompare(a.start_date) ||
        b.id.localeCompare(a.id),
    );

  const chosen = openRows[0] ?? null;
  let check: CheckRow | null = null;
  let results: CheckResultRow[] = [];
  let checksUnavailable = checklistResult.error !== null;
  if (chosen) {
    const checkResult = await supabase
      .from("return_to_learning_checks")
      .select("id, signed_off_by, signed_off_at")
      .eq("break_id", chosen.id)
      .maybeSingle();
    if (checkResult.error) {
      checksUnavailable = true;
      problems.push(`The return sign-off could not be loaded. ${checkResult.error.message}`);
    } else {
      check = (checkResult.data as CheckRow | null) ?? null;
      if (check?.id && !checklistResult.error) {
        const resultsResult = await supabase
          .from("return_check_results")
          .select("item_id, passed")
          .eq("check_id", check.id);
        if (resultsResult.error) {
          checksUnavailable = true;
          problems.push(`Checklist answers could not be loaded. ${resultsResult.error.message}`);
        } else {
          results = (resultsResult.data ?? []) as CheckResultRow[];
        }
      }
    }
  }

  const nameProblem = await loadNames(
    supabase,
    [
      ...breakRows.map((row) => row.started_by),
      check?.signed_off_by,
    ],
    names,
  );
  if (nameProblem) problems.push(nameProblem);

  const passed = new Map(results.map((row) => [row.item_id, row.passed === true]));
  const checks: ChecklistItemState[] = checksUnavailable
    ? []
    : checklist.map((item) => ({
        id: item.id,
        label: item.label,
        sortOrder: item.sortOrder,
        passed: passed.get(item.id) === true,
      }));

  const open: OpenBreak | null = chosen
    ? {
        ...breakSummary(chosen, reasons, names),
        signedOff: Boolean(check?.signed_off_at),
        signedOffByName: check?.signed_off_by
          ? personName(names.get(check.signed_off_by))
          : null,
        signedOffAt: check?.signed_off_at ?? null,
        checks,
        checksUnavailable,
      }
    : null;

  return {
    open,
    history: pastRows.map((row) => breakSummary(row, reasons, names)),
    reasons: activeReasons,
    multipleOpen: openRows.length > 1,
  };
}

/** Session entry point for the programme tab. */
export async function loadApprenticeProgramme(
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<ApprenticeProgrammePage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) {
    return emptyProgrammePage(londonToday(), "GTA IDs look like GTA-000002.");
  }
  const supabase = await createSupabaseServerClient();
  return readApprenticeProgramme(supabase, requestedId, options);
}

export async function saveApprenticeCourseDates(
  supabase: SupabaseClient,
  submission: CourseDateSubmission,
): Promise<ProgrammeActionResult> {
  const { data, error } = await supabase
    .from("apprentices")
    .select(DATE_COLUMNS)
    .eq("gta_id", submission.gtaId)
    .maybeSingle();
  if (error) return failure(error);
  if (!data) {
    return { ok: false, formError: "This apprentice could not be found. Refresh the page." };
  }

  const current = mapStored(data as DateRow);
  const attemptsPlanned = PLANNED_DATE_TYPES.some((row) => {
    const submitted = submission[row.plannedKey];
    return typeof submitted === "string" && submitted !== current[row.plannedKey];
  });

  let effective: EffectiveDates | null = null;
  if (attemptsPlanned) {
    const effectiveResult = await supabase.rpc("get_effective_planned_dates", {
      p_apprentice_id: submission.gtaId,
    });
    if (effectiveResult.error) return failure(effectiveResult.error);
    const row = asRows<EffectiveRow>(effectiveResult.data)[0];
    effective = row ? mapEffective(row) : null;
  }

  const plan = planCourseDateUpdate(current, effective, submission);
  if (!plan.ok) return plan;

  for (const item of plan.value.initialPlanned) {
    const { data: updated, error: updateError } = await supabase
      .from("apprentices")
      .update({ [item.column]: item.value })
      .eq("gta_id", submission.gtaId)
      .is(item.column, null)
      .select("gta_id");
    if (updateError) return failure(updateError);
    if (!updated || updated.length === 0) {
      const label = plannedDateRow(item.dateType)?.plannedLabel ?? "This planned date";
      return {
        ok: false,
        formError: `${label} is already set. Change it with a date change request.`,
      };
    }
  }

  if (Object.keys(plan.value.direct).length > 0) {
    const { error: directError } = await supabase
      .from("apprentices")
      .update(plan.value.direct)
      .eq("gta_id", submission.gtaId);
    if (directError) {
      const explained = explainProgrammeError(directError);
      if (plan.value.initialPlanned.length > 0) {
        return {
          ok: false,
          formError: `Some planned dates were saved, but the other dates could not. Refresh the page. ${explained}`,
        };
      }
      return { ok: false, formError: explained };
    }
  }

  return { ok: true };
}

export async function requestApprenticePlannedDateChange(
  supabase: SupabaseClient,
  value: {
    gtaId: string;
    dateType: PlannedDateType;
    newDate: string;
    reasonId: string;
    explanation: string;
    extensionPaperwork: boolean;
  },
): Promise<ProgrammeActionResult> {
  const row = plannedDateRow(value.dateType);
  if (!row) {
    return { ok: false, formError: "Choose course end, gateway 1, gateway 2, or EPA." };
  }

  const [storedResult, effectiveResult] = await Promise.all([
    supabase.from("apprentices").select(row.column).eq("gta_id", value.gtaId).maybeSingle(),
    supabase.rpc("planned_date_effective", {
      p_apprentice_id: value.gtaId,
      p_date_type: value.dateType,
    }),
  ]);
  if (storedResult.error) return failure(storedResult.error);
  if (!storedResult.data) {
    return { ok: false, formError: "This apprentice could not be found. Refresh the page." };
  }
  if (effectiveResult.error) return failure(effectiveResult.error);

  const stored = asIsoDate((storedResult.data as Record<string, unknown>)[row.column]);
  const effective = asIsoDate(effectiveResult.data);
  if (!plannedDateIsSet(stored, effective)) {
    return {
      ok: false,
      formError: `Set ${row.plannedLabel.toLowerCase()} on the course dates form first. A date change request is for a date that is already set.`,
    };
  }

  const { error } = await supabase.rpc("request_planned_date_change", {
    p_apprentice_id: value.gtaId,
    p_date_type: value.dateType,
    p_new_date: value.newDate,
    p_reason_id: value.reasonId,
    p_explanation: value.explanation,
    p_extension_paperwork: value.extensionPaperwork,
  });
  if (error) return failure(error);
  return { ok: true };
}

export async function approveApprenticePlannedDateChange(
  supabase: SupabaseClient,
  changeId: string,
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("approve_planned_date_change", { p_change_id: changeId });
  if (error) return failure(error);
  return { ok: true };
}

export async function rejectApprenticePlannedDateChange(
  supabase: SupabaseClient,
  changeId: string,
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("reject_planned_date_change", { p_change_id: changeId });
  if (error) return failure(error);
  return { ok: true };
}

export async function setApprenticeExtensionPaperwork(
  supabase: SupabaseClient,
  changeId: string,
  received: boolean,
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("set_extension_paperwork", {
    p_change_id: changeId,
    p_received: received,
  });
  if (error) return failure(error);
  return { ok: true };
}

export async function startApprenticeBreak(
  supabase: SupabaseClient,
  value: { gtaId: string; reasonId: string; explanation: string; startDate: string },
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("start_break_in_learning", {
    p_apprentice_id: value.gtaId,
    p_reason_id: value.reasonId,
    p_explanation: value.explanation,
    p_start_date: value.startDate,
  });
  if (error) return failure(error);
  return { ok: true };
}

export async function recordApprenticeReturnCheck(
  supabase: SupabaseClient,
  value: { breakId: string; itemId: string; passed: boolean },
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("record_return_check_result", {
    p_break_id: value.breakId,
    p_item_id: value.itemId,
    p_passed: value.passed,
  });
  if (error) return failure(error);
  return { ok: true };
}

export async function signOffApprenticeReturn(
  supabase: SupabaseClient,
  breakId: string,
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("sign_off_return_to_learning", { p_break_id: breakId });
  if (error) return failure(error);
  return { ok: true };
}

export async function returnApprenticeFromBreak(
  supabase: SupabaseClient,
  breakId: string,
  returnDate: string,
): Promise<ProgrammeActionResult> {
  const { error } = await supabase.rpc("return_from_break", {
    p_break_id: breakId,
    p_return_date: returnDate,
  });
  if (error) return failure(error);
  return { ok: true };
}
