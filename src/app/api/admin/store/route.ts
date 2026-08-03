import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type {
  AdminCohortChangeLogEntry,
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminApprenticeRecord,
  AdminPackItemStatus,
  AdminPortalUser,
  AdminTeachingGroupRecord,
} from "@/features/administration/domain/types";
import type {
  CohortInput,
  EnrolmentInput,
  EmployerInput,
  ApprenticeInput,
  ProgrammeInput,
  TeachingGroupInput,
  UserInput,
} from "@/features/administration/domain/store";
import {
  handleCohortAction,
  isMissingSchemaError,
  mapCohort,
  mapCohortChangeLog,
  mapTeachingGroup,
  type CohortChangeLogRow,
  type CohortRow,
  type TeachingGroupRow,
} from "./cohort-handlers";
import {
  handleStaffAction,
  loadPortalUsers,
} from "./staff-handlers";
import {
  handleCatalogueAction,
  loadEmployers,
  loadProgrammes,
} from "./catalogue-handlers";
import {
  calculateProgrammeWeek,
  calculateProgrammeYear,
} from "@/features/apprentice-lifecycle/domain/programme-week";

type ApprenticeRow = {
  id: string;
  display_name: string;
  apprentice_reference: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  uln: string;
  address_line1: string;
  address_line2: string;
  town: string;
  postcode: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  support_notes: string;
  intake_status: AdminApprenticeRecord["intakeStatus"];
  pack: Record<string, AdminPackItemStatus> | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type ApprenticeProgrammeRow = {
  id: string;
  kind: AdminApprenticeEnrolment["kind"];
  status: AdminApprenticeEnrolment["status"];
  apprentice_id: string | null;
  programme_name: string;
  standard_code: string;
  cohort_id: string | null;
  teaching_group_id: string | null;
  employer_id: string;
  employer_name: string;
  workplace_contact: string;
  mentor_name: string;
  tutor_name: string;
  start_date: string;
  original_planned_end_date: string;
  programme_year: number | null;
  programme_week: number | null;
  attendance_percent: number | null;
  actual_progress_percent: number | null;
  college_days: string;
  notes: string;
  created_at: string;
  updated_at: string;
  apprentices: ApprenticeRow | ApprenticeRow[] | null;
};

function firstJoined<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapApprentice(row: ApprenticeRow): AdminApprenticeRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    apprenticeReference: row.apprentice_reference,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth ?? "",
    uln: row.uln,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    town: row.town,
    postcode: row.postcode,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyContactRelationship: row.emergency_contact_relationship,
    supportNotes: row.support_notes,
    intakeStatus: row.intake_status,
    pack: row.pack ?? {},
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrolment(row: ApprenticeProgrammeRow): AdminApprenticeEnrolment {
  const apprentice = firstJoined(row.apprentices);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    apprenticeId: row.apprentice_id,
    displayName: apprentice?.display_name ?? "",
    email: apprentice?.email ?? "",
    phone: apprentice?.phone ?? "",
    dateOfBirth: apprentice?.date_of_birth ?? "",
    uln: apprentice?.uln ?? "",
    programmeName: row.programme_name,
    standardCode: row.standard_code,
    cohortId: row.cohort_id,
    teachingGroupId: row.teaching_group_id ?? null,
    employerId: row.employer_id,
    employerName: row.employer_name,
    workplaceContact: row.workplace_contact,
    mentorName: row.mentor_name,
    tutorName: row.tutor_name,
    startDate: row.start_date,
    originalPlannedEndDate: row.original_planned_end_date,
    programmeYear: (() => {
      const liveWeek = row.start_date
        ? calculateProgrammeWeek(row.start_date)
        : null;
      const liveYear = calculateProgrammeYear(liveWeek);
      if (liveYear === 1 || liveYear === 2 || liveYear === 3) return liveYear;
      return row.programme_year === 1 ||
        row.programme_year === 2 ||
        row.programme_year === 3
        ? row.programme_year
        : null;
    })(),
    programmeWeek: row.start_date
      ? calculateProgrammeWeek(row.start_date)
      : row.programme_week,
    attendancePercent: row.attendance_percent,
    actualProgressPercent: row.actual_progress_percent,
    collegeDays: row.college_days,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateApprenticeReference(): string {
  const year = new Date().getFullYear();
  const serial = String(Math.floor(Math.random() * 90000) + 10000);
  return `GTA-${year}-0${serial.slice(0, 4)}`;
}

async function requireAdminAccess() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const allowed =
    hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE) ||
    hasPermission(session, PERMISSIONS.RECORDS_PROXY_WRITE);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof NextResponse) return session;

  const supabase = createSupabaseAdminClient();
  const [
    { data: apprentices, error: apprenticesError },
    { data: enrolments, error: enrolmentsError },
    cohortsResult,
    teachingGroupsResult,
    changeLogsResult,
    employersResult,
    programmesResult,
  ] = await Promise.all([
    supabase.from("apprentices").select("*").order("display_name", { ascending: true }),
    supabase
      .from("apprentice_programmes")
      .select("*, apprentices(*)")
      .order("updated_at", { ascending: false }),
    supabase.from("cohorts").select("*").order("start_date", { ascending: false }),
    supabase
      .from("cohort_teaching_groups")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("cohort_change_log")
      .select("*")
      .order("created_at", { ascending: false }),
    loadEmployers(supabase),
    loadProgrammes(supabase),
  ]);

  const usersResult = await loadPortalUsers(supabase);
  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error }, { status: 500 });
  }

  if (apprenticesError || enrolmentsError) {
    return NextResponse.json(
      {
        error:
          apprenticesError?.message ??
          enrolmentsError?.message ??
          "Unable to load admin data",
      },
      { status: 500 },
    );
  }

  if (employersResult.error) {
    return NextResponse.json({ error: employersResult.error }, { status: 500 });
  }
  if (programmesResult.error) {
    return NextResponse.json(
      { error: programmesResult.error },
      { status: 500 },
    );
  }

  let cohorts: AdminCohortRecord[] = [];
  if (cohortsResult.error) {
    if (!isMissingSchemaError(cohortsResult.error.message)) {
      return NextResponse.json(
        { error: cohortsResult.error.message },
        { status: 500 },
      );
    }
  } else {
    cohorts = (cohortsResult.data ?? []).map((row) =>
      mapCohort(row as CohortRow),
    );
  }

  let teachingGroups: AdminTeachingGroupRecord[] = [];
  if (teachingGroupsResult.error) {
    if (!isMissingSchemaError(teachingGroupsResult.error.message)) {
      return NextResponse.json(
        { error: teachingGroupsResult.error.message },
        { status: 500 },
      );
    }
  } else {
    teachingGroups = (teachingGroupsResult.data ?? []).map((row) =>
      mapTeachingGroup(row as TeachingGroupRow),
    );
  }

  let cohortChangeLogs: AdminCohortChangeLogEntry[] = [];
  if (changeLogsResult.error) {
    if (!isMissingSchemaError(changeLogsResult.error.message)) {
      return NextResponse.json(
        { error: changeLogsResult.error.message },
        { status: 500 },
      );
    }
  } else {
    cohortChangeLogs = (changeLogsResult.data ?? []).map((row) =>
      mapCohortChangeLog(row as CohortChangeLogRow),
    );
  }

  return NextResponse.json({
    apprentices: (apprentices ?? []).map((row) => mapApprentice(row as ApprenticeRow)),
    enrolments: (enrolments ?? []).map((row) =>
      mapEnrolment(row as ApprenticeProgrammeRow),
    ),
    employers: employersResult.employers,
    programmes: programmesResult.programmes,
    cohorts,
    teachingGroups,
    cohortChangeLogs,
    users: usersResult.users,
  });
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof NextResponse) return session;

  const body = (await request.json()) as
    | { action: "createApprentice"; input: ApprenticeInput }
    | { action: "updateApprentice"; id: string; patch: Partial<ApprenticeInput> }
    | { action: "createEnrolment"; input: EnrolmentInput }
    | { action: "updateEnrolment"; id: string; patch: Partial<EnrolmentInput> }
    | { action: "createEmployer"; input: EmployerInput }
    | { action: "updateEmployer"; id: string; patch: Partial<EmployerInput> }
    | { action: "createProgramme"; input: ProgrammeInput }
    | { action: "updateProgramme"; id: string; patch: Partial<ProgrammeInput> }
    | { action: "createCohort"; input: CohortInput }
    | { action: "updateCohort"; id: string; patch: Partial<CohortInput> }
    | {
        action: "lockCohortSession";
        id: string;
        summary: string;
        details: string[];
        actorName?: string;
      }
    | { action: "createTeachingGroup"; input: TeachingGroupInput }
    | {
        action: "updateTeachingGroup";
        id: string;
        patch: Partial<TeachingGroupInput>;
      }
    | { action: "deleteTeachingGroup"; id: string }
    | { action: "createStaff"; input: UserInput & { password?: string } }
    | {
        action: "updateStaffProfile";
        id: string;
        patch: {
          role?: AdminPortalUser["role"];
          workspace?: string;
          jobTitles?: string[];
        };
      }
    | {
        action: "setPortalEnvironment";
        id: string;
        status: AdminPortalUser["status"];
        actorName: string;
      }
    | {
        action: "revealApprenticePassword";
        id: string;
        adminPassword: string;
      };

  const supabase = createSupabaseAdminClient();

  const actorFallback =
    session.account.name?.trim() ||
    session.account.email?.trim() ||
    "Administrator";

  if (
    body.action === "createEmployer" ||
    body.action === "updateEmployer" ||
    body.action === "createProgramme" ||
    body.action === "updateProgramme"
  ) {
    return handleCatalogueAction(supabase, body);
  }

  if (
    body.action === "createCohort" ||
    body.action === "updateCohort" ||
    body.action === "lockCohortSession" ||
    body.action === "createTeachingGroup" ||
    body.action === "updateTeachingGroup" ||
    body.action === "deleteTeachingGroup"
  ) {
    const handled = await handleCohortAction(supabase, body, actorFallback);
    if (handled) return handled;
  }

  if (
    body.action === "createStaff" ||
    body.action === "updateStaffProfile" ||
    body.action === "setPortalEnvironment" ||
    body.action === "revealApprenticePassword"
  ) {
    const handled = await handleStaffAction(supabase, body, session);
    if (handled) return handled;
  }

  if (body.action === "createApprentice") {
    const input = body.input;
    const { data, error } = await supabase
      .from("apprentices")
      .insert({
        display_name: input.displayName.trim(),
        apprentice_reference: input.apprenticeReference.trim() || generateApprenticeReference(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        date_of_birth: input.dateOfBirth || null,
        uln: input.uln.trim(),
        address_line1: input.addressLine1.trim(),
        address_line2: input.addressLine2.trim(),
        town: input.town.trim(),
        postcode: input.postcode.trim().toUpperCase(),
        emergency_contact_name: input.emergencyContactName.trim(),
        emergency_contact_phone: input.emergencyContactPhone.trim(),
        emergency_contact_relationship: input.emergencyContactRelationship.trim(),
        support_notes: input.supportNotes.trim(),
        intake_status: input.intakeStatus,
        pack: {},
        notes: input.notes.trim(),
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to create apprentice" }, { status: 500 });
    }

    return NextResponse.json({ apprentice: mapApprentice(data as ApprenticeRow) });
  }

  if (body.action === "updateApprentice") {
    const patch = body.patch;
    const update: Record<string, unknown> = {};
    if (patch.displayName != null) update.display_name = patch.displayName.trim();
    if (patch.apprenticeReference != null) {
      update.apprentice_reference = patch.apprenticeReference.trim();
    }
    if (patch.email != null) update.email = patch.email.trim();
    if (patch.phone != null) update.phone = patch.phone.trim();
    if (patch.dateOfBirth != null) update.date_of_birth = patch.dateOfBirth || null;
    if (patch.uln != null) update.uln = patch.uln.trim();
    if (patch.addressLine1 != null) update.address_line1 = patch.addressLine1.trim();
    if (patch.addressLine2 != null) update.address_line2 = patch.addressLine2.trim();
    if (patch.town != null) update.town = patch.town.trim();
    if (patch.postcode != null) update.postcode = patch.postcode.trim().toUpperCase();
    if (patch.emergencyContactName != null) {
      update.emergency_contact_name = patch.emergencyContactName.trim();
    }
    if (patch.emergencyContactPhone != null) {
      update.emergency_contact_phone = patch.emergencyContactPhone.trim();
    }
    if (patch.emergencyContactRelationship != null) {
      update.emergency_contact_relationship = patch.emergencyContactRelationship.trim();
    }
    if (patch.supportNotes != null) update.support_notes = patch.supportNotes.trim();
    if (patch.intakeStatus != null) update.intake_status = patch.intakeStatus;
    if (patch.notes != null) update.notes = patch.notes.trim();

    const { data, error } = await supabase
      .from("apprentices")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to update apprentice" }, { status: 500 });
    }

    return NextResponse.json({ apprentice: mapApprentice(data as ApprenticeRow) });
  }

  if (body.action === "createEnrolment") {
    const input = body.input;
    const { data, error } = await supabase
      .from("apprentice_programmes")
      .insert({
        kind: input.kind,
        status: input.status ?? (input.kind === "new_starter" ? "pending_start" : "active"),
        apprentice_id: input.apprenticeId,
        programme_name: input.programmeName,
        standard_code: input.standardCode,
        cohort_id: input.cohortId,
        teaching_group_id: input.teachingGroupId ?? null,
        employer_id: input.employerId,
        employer_name: input.employerName,
        workplace_contact: input.workplaceContact.trim(),
        mentor_name: input.mentorName.trim(),
        tutor_name: input.tutorName.trim(),
        start_date: input.startDate,
        original_planned_end_date: input.originalPlannedEndDate,
        programme_year: input.programmeYear,
        programme_week: input.programmeWeek,
        attendance_percent: input.attendancePercent,
        actual_progress_percent: input.actualProgressPercent,
        college_days: input.collegeDays.trim(),
        notes: input.notes.trim(),
      })
      .select("*, apprentices(*)")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to create enrolment" }, { status: 500 });
    }

    return NextResponse.json({ enrolment: mapEnrolment(data as ApprenticeProgrammeRow) });
  }

  if (body.action !== "updateEnrolment") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const patch = body.patch;
  const update: Record<string, unknown> = {};
  if (patch.kind != null) update.kind = patch.kind;
  if (patch.status != null) update.status = patch.status;
  if (patch.apprenticeId !== undefined) update.apprentice_id = patch.apprenticeId;
  if (patch.programmeName != null) update.programme_name = patch.programmeName;
  if (patch.standardCode != null) update.standard_code = patch.standardCode;
  if (patch.cohortId !== undefined) update.cohort_id = patch.cohortId;
  if (patch.teachingGroupId !== undefined) {
    update.teaching_group_id = patch.teachingGroupId;
  }
  if (patch.employerId != null) update.employer_id = patch.employerId;
  if (patch.employerName != null) update.employer_name = patch.employerName;
  if (patch.workplaceContact != null) update.workplace_contact = patch.workplaceContact.trim();
  if (patch.mentorName != null) update.mentor_name = patch.mentorName.trim();
  if (patch.tutorName != null) update.tutor_name = patch.tutorName.trim();
  if (patch.startDate != null) update.start_date = patch.startDate;
  if (patch.originalPlannedEndDate != null) {
    update.original_planned_end_date = patch.originalPlannedEndDate;
  }
  if (patch.programmeYear !== undefined) update.programme_year = patch.programmeYear;
  if (patch.programmeWeek !== undefined) update.programme_week = patch.programmeWeek;
  if (patch.attendancePercent !== undefined) update.attendance_percent = patch.attendancePercent;
  if (patch.actualProgressPercent !== undefined) {
    update.actual_progress_percent = patch.actualProgressPercent;
  }
  if (patch.collegeDays != null) update.college_days = patch.collegeDays.trim();
  if (patch.notes != null) update.notes = patch.notes.trim();

  const { data, error } = await supabase
    .from("apprentice_programmes")
    .update(update)
    .eq("id", body.id)
    .select("*, apprentices(*)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to update enrolment" }, { status: 500 });
  }

  return NextResponse.json({ enrolment: mapEnrolment(data as ApprenticeProgrammeRow) });
}
