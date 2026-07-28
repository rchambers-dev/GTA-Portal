import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type {
  AdminLearnerEnrolment,
  AdminLearnerRecord,
  AdminPackItemStatus,
} from "@/features/administration/domain/types";
import type {
  EnrolmentInput,
  LearnerInput,
} from "@/features/administration/domain/store";

type LearnerRow = {
  id: string;
  display_name: string;
  learner_reference: string;
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
  intake_status: AdminLearnerRecord["intakeStatus"];
  pack: Record<string, AdminPackItemStatus> | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type LearnerProgrammeRow = {
  id: string;
  kind: AdminLearnerEnrolment["kind"];
  status: AdminLearnerEnrolment["status"];
  learner_id: string | null;
  programme_name: string;
  standard_code: string;
  cohort_id: string | null;
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
  learners: LearnerRow | LearnerRow[] | null;
};

function firstJoined<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapLearner(row: LearnerRow): AdminLearnerRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    learnerReference: row.learner_reference,
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

function mapEnrolment(row: LearnerProgrammeRow): AdminLearnerEnrolment {
  const learner = firstJoined(row.learners);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    learnerId: row.learner_id,
    displayName: learner?.display_name ?? "",
    email: learner?.email ?? "",
    phone: learner?.phone ?? "",
    dateOfBirth: learner?.date_of_birth ?? "",
    uln: learner?.uln ?? "",
    programmeName: row.programme_name,
    standardCode: row.standard_code,
    cohortId: row.cohort_id,
    employerId: row.employer_id,
    employerName: row.employer_name,
    workplaceContact: row.workplace_contact,
    mentorName: row.mentor_name,
    tutorName: row.tutor_name,
    startDate: row.start_date,
    originalPlannedEndDate: row.original_planned_end_date,
    programmeYear:
      row.programme_year === 1 || row.programme_year === 2 || row.programme_year === 3
        ? row.programme_year
        : null,
    programmeWeek: row.programme_week,
    attendancePercent: row.attendance_percent,
    actualProgressPercent: row.actual_progress_percent,
    collegeDays: row.college_days,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateLearnerReference(): string {
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
  const [{ data: learners, error: learnersError }, { data: enrolments, error: enrolmentsError }] =
    await Promise.all([
      supabase
        .from("learners")
        .select("*")
        .order("display_name", { ascending: true }),
      supabase
        .from("learner_programmes")
        .select("*, learners(*)")
        .order("updated_at", { ascending: false }),
    ]);

  if (learnersError || enrolmentsError) {
    return NextResponse.json(
      { error: learnersError?.message ?? enrolmentsError?.message ?? "Unable to load admin data" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    learners: (learners ?? []).map((row) => mapLearner(row as LearnerRow)),
    enrolments: (enrolments ?? []).map((row) => mapEnrolment(row as LearnerProgrammeRow)),
  });
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof NextResponse) return session;

  const body = (await request.json()) as
    | { action: "createLearner"; input: LearnerInput }
    | { action: "updateLearner"; id: string; patch: Partial<LearnerInput> }
    | { action: "createEnrolment"; input: EnrolmentInput }
    | { action: "updateEnrolment"; id: string; patch: Partial<EnrolmentInput> };

  const supabase = createSupabaseAdminClient();

  if (body.action === "createLearner") {
    const input = body.input;
    const { data, error } = await supabase
      .from("learners")
      .insert({
        display_name: input.displayName.trim(),
        learner_reference: input.learnerReference.trim() || generateLearnerReference(),
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
      return NextResponse.json({ error: error?.message ?? "Unable to create learner" }, { status: 500 });
    }

    return NextResponse.json({ learner: mapLearner(data as LearnerRow) });
  }

  if (body.action === "updateLearner") {
    const patch = body.patch;
    const update: Record<string, unknown> = {};
    if (patch.displayName != null) update.display_name = patch.displayName.trim();
    if (patch.learnerReference != null) update.learner_reference = patch.learnerReference.trim();
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
      .from("learners")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to update learner" }, { status: 500 });
    }

    return NextResponse.json({ learner: mapLearner(data as LearnerRow) });
  }

  if (body.action === "createEnrolment") {
    const input = body.input;
    const { data, error } = await supabase
      .from("learner_programmes")
      .insert({
        kind: input.kind,
        status: input.status ?? (input.kind === "new_starter" ? "pending_start" : "active"),
        learner_id: input.learnerId,
        programme_name: input.programmeName,
        standard_code: input.standardCode,
        cohort_id: input.cohortId,
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
      .select("*, learners(*)")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to create enrolment" }, { status: 500 });
    }

    return NextResponse.json({ enrolment: mapEnrolment(data as LearnerProgrammeRow) });
  }

  const patch = body.patch;
  const update: Record<string, unknown> = {};
  if (patch.kind != null) update.kind = patch.kind;
  if (patch.status != null) update.status = patch.status;
  if (patch.learnerId !== undefined) update.learner_id = patch.learnerId;
  if (patch.programmeName != null) update.programme_name = patch.programmeName;
  if (patch.standardCode != null) update.standard_code = patch.standardCode;
  if (patch.cohortId !== undefined) update.cohort_id = patch.cohortId;
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
    .from("learner_programmes")
    .update(update)
    .eq("id", body.id)
    .select("*, learners(*)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to update enrolment" }, { status: 500 });
  }

  return NextResponse.json({ enrolment: mapEnrolment(data as LearnerProgrammeRow) });
}
