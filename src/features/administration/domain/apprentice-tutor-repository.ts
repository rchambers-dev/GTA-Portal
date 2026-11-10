import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { APPRENTICE_COLUMNS, isAssignedGtaId, type ApprenticeRow } from "./apprentice-record";
import { formatManagerName, type CurrentApprenticeEmployment } from "./employer-record";
import {
  APPRENTICESHIP_TUTOR_RESPONSIBILITY,
  eligibleTutorOptions,
  explainTutorWriteError,
  learnerRecordFromRow,
  mapTutorAssignment,
  normaliseGtaId,
  splitTutorAssignments,
  type ApprenticeLearnerRecord,
  type AssignTutorResult,
  type TutorAssignment,
  type TutorAssignmentRow,
  type TutorOption,
  type TutorProfileRow,
  type ValidatedTutorAssignment,
} from "./apprentice-tutor";

const TUTOR_PROFILE_COLUMNS =
  "id, display_name, email, base_role, responsibilities";

export type ApprenticeLearnerPage = {
  requestedId: string;
  apprentice: ApprenticeLearnerRecord | null;
  currentTutor: TutorAssignment | null;
  tutorHistory: TutorAssignment[];
  tutorOptions: TutorOption[];
  currentEmployment: CurrentApprenticeEmployment | null;
  loadError: string | null;
};

type EmploymentRow = {
  employer_id: string;
  site_id: string;
  manager_id: string;
  start_date: string;
};

type ProgrammeRow = {
  name: string;
  standard_code: string | null;
};

type NameRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

function mapCurrentEmployment(
  row: EmploymentRow,
  employer: { company_name: string } | null,
  site: { postcode: string; area_name: string; site_name: string | null } | null,
  manager: { first_name: string; middle_names: string | null; last_name: string } | null,
): CurrentApprenticeEmployment {
  return {
    companyName: employer?.company_name?.trim() || "Employer unavailable",
    postcode: site?.postcode ?? "",
    areaName: site?.area_name ?? "",
    siteName: site?.site_name?.trim() || null,
    managerName: manager
      ? formatManagerName({
          firstName: manager.first_name,
          middleNames: manager.middle_names,
          lastName: manager.last_name,
        })
      : "Manager unavailable",
    startDate: row.start_date,
  };
}

function emptyPage(requestedId: string, loadError: string | null): ApprenticeLearnerPage {
  return {
    requestedId,
    apprentice: null,
    currentTutor: null,
    tutorHistory: [],
    tutorOptions: [],
    currentEmployment: null,
    loadError,
  };
}

/**
 * Reads one apprentice, their tutor history, and the people the trigger
 * allows to be assigned. The caller supplies the session client so RLS applies.
 */
export async function readApprenticeLearner(
  supabase: SupabaseClient,
  rawGtaId: string,
): Promise<ApprenticeLearnerPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) {
    return emptyPage(requestedId, "GTA IDs look like GTA-000002.");
  }

  const [
    apprenticeResult,
    assignmentResult,
    roleTutorResult,
    responsibilityTutorResult,
    employmentResult,
  ] = await Promise.all([
    supabase
      .from("apprentices")
      .select(APPRENTICE_COLUMNS)
      .eq("gta_id", requestedId)
      .maybeSingle(),
    supabase
      .from("apprentice_tutors")
      .select("id, tutor_id, start_date, end_date")
      .eq("apprentice_id", requestedId),
    supabase.from("profiles").select(TUTOR_PROFILE_COLUMNS).eq("base_role", "Tutor"),
    supabase
      .from("profiles")
      .select(TUTOR_PROFILE_COLUMNS)
      .filter("responsibilities", "cs", `{"${APPRENTICESHIP_TUTOR_RESPONSIBILITY}"}`),
    supabase
      .from("apprentice_employments")
      .select("employer_id, site_id, manager_id, start_date")
      .eq("gta_id", requestedId)
      .is("end_date", null)
      .maybeSingle(),
  ]);

  const problems: string[] = [];
  if (apprenticeResult.error) {
    problems.push(
      `This apprentice could not be loaded. ${apprenticeResult.error.message}`,
    );
  }
  if (assignmentResult.error) {
    problems.push(`Tutors could not be loaded. ${assignmentResult.error.message}`);
  }
  if (roleTutorResult.error || responsibilityTutorResult.error) {
    const message =
      roleTutorResult.error?.message ?? responsibilityTutorResult.error?.message;
    problems.push(`The tutor list could not be loaded. ${message}`);
  }
  if (employmentResult.error) {
    problems.push(`The employer could not be loaded. ${employmentResult.error.message}`);
  }

  const apprenticeRow = apprenticeResult.error
    ? null
    : (apprenticeResult.data as ApprenticeRow | null);
  if (!apprenticeResult.error && !apprenticeRow) {
    return emptyPage(requestedId, problems.length > 0 ? problems.join(" ") : null);
  }

  const assignmentRows = assignmentResult.error
    ? []
    : ((assignmentResult.data ?? []) as TutorAssignmentRow[]);
  const profileRows = [
    ...((roleTutorResult.error ? [] : roleTutorResult.data ?? []) as TutorProfileRow[]),
    ...((responsibilityTutorResult.error
      ? []
      : responsibilityTutorResult.data ?? []) as TutorProfileRow[]),
  ];
  const tutorOptions = eligibleTutorOptions(profileRows);
  const names = new Map<string, { display_name: string | null; email: string | null }>(
    tutorOptions.map((option) => [
      option.id,
      { display_name: option.displayName, email: option.email },
    ]),
  );

  const missingIds = [
    ...new Set(assignmentRows.map((row) => row.tutor_id).filter((id) => !names.has(id))),
  ];
  const programmeId = apprenticeRow?.programme_id ?? null;
  const employment = employmentResult.error ? null : (employmentResult.data as EmploymentRow | null);

  const [programmeResult, extraResult, employerResult, siteResult, managerResult] =
    await Promise.all([
      programmeId
        ? supabase
            .from("programmes")
            .select("name, standard_code")
            .eq("id", programmeId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      missingIds.length > 0
        ? supabase.from("profiles").select("id, display_name, email").in("id", missingIds)
        : Promise.resolve({ data: [], error: null }),
      employment
        ? supabase
            .from("employers")
            .select("company_name")
            .eq("employer_id", employment.employer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      employment
        ? supabase
            .from("employer_sites")
            .select("postcode, area_name, site_name")
            .eq("id", employment.site_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      employment
        ? supabase
            .from("employer_managers")
            .select("first_name, middle_names, last_name")
            .eq("id", employment.manager_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (programmeResult.error) {
    problems.push(`The programme could not be loaded. ${programmeResult.error.message}`);
  }
  if (extraResult.error) {
    problems.push(`Tutor names could not be loaded. ${extraResult.error.message}`);
  } else {
    for (const row of (extraResult.data ?? []) as NameRow[]) {
      names.set(row.id, { display_name: row.display_name, email: row.email });
    }
  }
  if (employerResult.error || siteResult.error || managerResult.error) {
    const message =
      employerResult.error?.message ?? siteResult.error?.message ?? managerResult.error?.message;
    problems.push(`The employer could not be loaded. ${message}`);
  }

  const assignments = assignmentRows.map((row) =>
    mapTutorAssignment(row, names.get(row.tutor_id)),
  );
  const split = splitTutorAssignments(assignments);
  if (split.multipleCurrent) {
    problems.push("This apprentice has more than one current tutor.");
  }

  const programme = programmeResult.error
    ? null
    : (programmeResult.data as ProgrammeRow | null);
  const currentEmployment =
    employment && !employerResult.error && !siteResult.error && !managerResult.error
      ? mapCurrentEmployment(
          employment,
          employerResult.data as { company_name: string } | null,
          siteResult.data as {
            postcode: string;
            area_name: string;
            site_name: string | null;
          } | null,
          managerResult.data as {
            first_name: string;
            middle_names: string | null;
            last_name: string;
          } | null,
        )
      : null;

  return {
    requestedId,
    apprentice: apprenticeRow
      ? learnerRecordFromRow(apprenticeRow, programme
          ? { name: programme.name, standardCode: programme.standard_code ?? "" }
          : null)
      : null,
    currentTutor: split.current,
    tutorHistory: split.history,
    tutorOptions,
    currentEmployment,
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

/** Session entry point for the learner page. */
export async function loadApprenticeLearner(
  rawGtaId: string,
): Promise<ApprenticeLearnerPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) {
    return emptyPage(requestedId, "GTA IDs look like GTA-000002.");
  }
  const supabase = await createSupabaseServerClient();
  return readApprenticeLearner(supabase, requestedId);
}

/**
 * Assigns a tutor. A change sets end_date to today on the current row,
 * then inserts the new row. The closed row is reopened if the insert fails.
 * Rows for other apprentices are not updated.
 */
export async function assignApprenticeTutor(
  supabase: SupabaseClient,
  value: ValidatedTutorAssignment,
  today: string,
): Promise<AssignTutorResult> {
  const { data, error } = await supabase
    .from("apprentice_tutors")
    .select("id, tutor_id, start_date")
    .eq("apprentice_id", value.gtaId)
    .is("end_date", null);

  if (error) {
    return { ok: false, formError: explainTutorWriteError(error) };
  }

  const currentRows = (data ?? []) as { id: string; tutor_id: string; start_date: string }[];
  if (currentRows.length > 1) {
    return {
      ok: false,
      formError:
        "This apprentice has more than one current tutor. Refresh the page and try again.",
    };
  }

  const current = currentRows[0] ?? null;
  if (current?.tutor_id === value.tutorId) {
    return { ok: false, formError: "This tutor is already assigned." };
  }

  if (current) {
    const { data: closed, error: closeError } = await supabase
      .from("apprentice_tutors")
      .update({ end_date: today })
      .eq("id", current.id)
      .is("end_date", null)
      .select("id");

    if (closeError) {
      return { ok: false, formError: explainTutorWriteError(closeError) };
    }
    if (!closed || closed.length === 0) {
      return {
        ok: false,
        formError:
          "The current tutor changed while this was saving. Refresh the page and try again.",
      };
    }
  }

  const { error: insertError } = await supabase
    .from("apprentice_tutors")
    .insert({
      apprentice_id: value.gtaId,
      tutor_id: value.tutorId,
      start_date: today,
    })
    .select("id")
    .single();

  if (insertError) {
    if (!current) {
      return { ok: false, formError: explainTutorWriteError(insertError) };
    }
    const { error: restoreError } = await supabase
      .from("apprentice_tutors")
      .update({ end_date: null })
      .eq("id", current.id)
      .eq("end_date", today);
    const insertMessage = explainTutorWriteError(insertError);
    if (restoreError) {
      return {
        ok: false,
        formError: `${insertMessage} The previous tutor could not be restored. ${explainTutorWriteError(restoreError)}`,
      };
    }
    return { ok: false, formError: insertMessage };
  }

  return { ok: true };
}
