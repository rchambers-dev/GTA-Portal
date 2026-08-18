/**
 * Cohort / teaching-group handlers for /api/admin/store.
 * Permanent Supabase tables: cohorts, cohort_teaching_groups, cohort_change_log.
 */

import { NextResponse } from "next/server";
import type { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  formatCohortTeachers,
  parseCohortTeachers,
} from "@/features/administration/domain/cohort-teachers";
import {
  collegeDaysOverlap,
  formatCollegeDaysShort,
  parseCollegeDays,
} from "@/features/administration/domain/college-days";
import {
  COHORT_LOCKED_MESSAGE,
  COHORT_VERSION_FROZEN_MESSAGE,
  isCohortStarted,
} from "@/features/administration/domain/cohort-lifecycle";
import { normalizeDeliverySpine } from "@/features/administration/domain/cohort-products";
import { DEFAULT_TEACHING_GROUP_CAPACITY } from "@/features/administration/domain/cohort-ops";
import {
  PIN_GROUP_MISMATCH_MESSAGE,
  pinCompatibilityError,
  type AdminGtaProgrammeVersionOption,
} from "@/features/administration/domain/gta-programme-version-options";
import {
  currentMembershipForEnrolment,
  GROUP_VERSION_MEMBER_MISMATCH_MESSAGE,
  notesWithTutorIdentity,
  planTeachingGroupMembershipChange,
} from "@/features/administration/domain/teaching-group-placement";
import type {
  AdminCohortChangeLogEntry,
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminTeachingGroupMembership,
  AdminTeachingGroupRecord,
} from "@/features/administration/domain/types";
import type {
  CohortInput,
  TeachingGroupInput,
} from "@/features/administration/domain/store";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

export type CohortRow = {
  id: string;
  name: string;
  programme_id: string | null;
  programme_name: string;
  standard_code: string;
  standard_version: string;
  delivery_spine: string | null;
  enrolment_opens_date: string | null;
  start_date: string;
  expected_end_date: string | null;
  teaching_group: string;
  college_days: string;
  tutor_name: string;
  status: AdminCohortRecord["status"];
  notes: string;
  locked: boolean | null;
  created_at: string;
  updated_at: string;
};

export type TeachingGroupRow = {
  id: string;
  cohort_id: string | null;
  gta_programme_version_id?: string | null;
  version_review_required?: boolean | null;
  status?: string | null;
  tutor_name: string;
  name: string;
  college_days: string;
  capacity: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CohortChangeLogRow = {
  id: string;
  cohort_id: string;
  created_at: string;
  summary: string;
  details: unknown;
  actor_name: string | null;
};

export function isMissingSchemaError(
  message: string | undefined | null,
): boolean {
  if (!message) return false;
  return /does not exist|could not find|schema cache|relation .* not found|column .* does not exist/i.test(
    message,
  );
}

export function mapCohort(row: CohortRow): AdminCohortRecord {
  const teacherNames = parseCohortTeachers(row.tutor_name);
  return {
    id: row.id,
    name: row.name,
    programmeId: row.programme_id ?? "",
    programmeName: row.programme_name,
    standardCode: row.standard_code,
    standardVersion: row.standard_version,
    deliverySpine: normalizeDeliverySpine(row.delivery_spine),
    enrolmentOpensDate: row.enrolment_opens_date ?? "",
    startDate: row.start_date,
    expectedEndDate: row.expected_end_date ?? "",
    teachingGroup: row.teaching_group,
    collegeDays: row.college_days,
    teacherNames,
    tutorName: formatCohortTeachers(teacherNames),
    status: row.status,
    notes: row.notes,
    locked: row.locked !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTeachingGroup(row: TeachingGroupRow): AdminTeachingGroupRecord {
  const status = row.status === "inactive" ? "inactive" : "active";
  return {
    id: row.id,
    cohortId: row.cohort_id ?? null,
    gtaProgrammeVersionId: row.gta_programme_version_id ?? null,
    versionReviewRequired: Boolean(row.version_review_required),
    status,
    tutorName: row.tutor_name,
    name: row.name,
    collegeDays: row.college_days,
    capacity:
      Number.isFinite(row.capacity) && row.capacity >= 1
        ? row.capacity
        : DEFAULT_TEACHING_GROUP_CAPACITY,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCohortChangeLog(
  row: CohortChangeLogRow,
): AdminCohortChangeLogEntry {
  const details = Array.isArray(row.details)
    ? row.details.map((item) => String(item))
    : [];
  return {
    id: row.id,
    cohortId: row.cohort_id,
    createdAt: row.created_at,
    summary: row.summary ?? "",
    details,
    actorName: row.actor_name ?? "",
  };
}

async function fetchCohortById(
  supabase: SupabaseAdmin,
  cohortId: string,
): Promise<AdminCohortRecord | { error: string }> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("*")
    .eq("id", cohortId)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Cohort not found" };
  }
  return mapCohort(data as CohortRow);
}

export async function handleCohortAction(
  supabase: SupabaseAdmin,
  body:
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
    | { action: "deleteTeachingGroup"; id: string },
  actorFallback = "Administrator",
): Promise<NextResponse | null> {
  if (body.action === "createCohort") {
    const input = body.input;
    const teacherNames = parseCohortTeachers(
      formatCohortTeachers(
        input.teacherNames ?? parseCohortTeachers(input.tutorName),
      ),
    );
    const { data, error } = await supabase
      .from("cohorts")
      .insert({
        name: input.name.trim(),
        programme_id: asUuidOrNull(input.programmeId),
        programme_name: input.programmeName.trim(),
        standard_code: input.standardCode.trim().toUpperCase(),
        standard_version: input.standardVersion.trim().replace(/^v/i, ""),
        delivery_spine: normalizeDeliverySpine(input.deliverySpine),
        enrolment_opens_date: input.enrolmentOpensDate || null,
        start_date: input.startDate,
        expected_end_date: input.expectedEndDate || null,
        teaching_group: input.teachingGroup.trim(),
        college_days: input.collegeDays.trim(),
        tutor_name: formatCohortTeachers(teacherNames),
        status: input.status,
        notes: input.notes.trim(),
        locked: true,
      })
      .select("*")
      .single();
    if (error || !data) {
      const message = error?.message ?? "Unable to create cohort";
      if (isMissingSchemaError(message)) {
        return NextResponse.json(
          {
            error:
              "Cohorts tables missing. Run supabase/migrations/002_cohorts_and_teaching_groups.sql.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({
      cohort: mapCohort({ ...(data as CohortRow), locked: true }),
    });
  }

  if (body.action === "updateCohort") {
    const patch = body.patch as Partial<CohortInput> & { locked?: boolean };
    const { data: existingRow, error: existingError } = await supabase
      .from("cohorts")
      .select("*")
      .eq("id", body.id)
      .single();
    if (existingError || !existingRow) {
      return NextResponse.json(
        { error: existingError?.message ?? "Cohort not found" },
        { status: 404 },
      );
    }
    const existing = mapCohort(existingRow as CohortRow);
    const patchKeys = Object.keys(patch).filter(
      (key) => patch[key as keyof typeof patch] !== undefined,
    );
    const unlockOnly = patchKeys.length === 1 && patch.locked === false;
    if (existing.locked && !unlockOnly) {
      return NextResponse.json({ error: COHORT_LOCKED_MESSAGE }, { status: 403 });
    }

    if (patch.standardVersion != null) {
      const nextVersion = patch.standardVersion.trim().replace(/^v/i, "");
      if (nextVersion !== existing.standardVersion && isCohortStarted(existing)) {
        return NextResponse.json(
          { error: COHORT_VERSION_FROZEN_MESSAGE },
          { status: 403 },
        );
      }
    }
    if (patch.deliverySpine != null) {
      const nextSpine = normalizeDeliverySpine(patch.deliverySpine);
      if (nextSpine !== existing.deliverySpine && isCohortStarted(existing)) {
        return NextResponse.json(
          { error: COHORT_VERSION_FROZEN_MESSAGE },
          { status: 403 },
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (patch.name != null) update.name = patch.name.trim();
    if (patch.programmeId != null) {
      update.programme_id = asUuidOrNull(patch.programmeId);
    }
    if (patch.programmeName != null) {
      update.programme_name = patch.programmeName.trim();
    }
    if (patch.standardCode != null) {
      update.standard_code = patch.standardCode.trim().toUpperCase();
    }
    if (patch.standardVersion != null) {
      update.standard_version = patch.standardVersion.trim().replace(/^v/i, "");
    }
    if (patch.deliverySpine != null) {
      update.delivery_spine = normalizeDeliverySpine(patch.deliverySpine);
    }
    if (patch.enrolmentOpensDate != null) {
      update.enrolment_opens_date = patch.enrolmentOpensDate || null;
    }
    if (patch.startDate != null) update.start_date = patch.startDate;
    if (patch.expectedEndDate != null) {
      update.expected_end_date = patch.expectedEndDate || null;
    }
    if (patch.teachingGroup != null) {
      update.teaching_group = patch.teachingGroup.trim();
    }
    if (patch.collegeDays != null) update.college_days = patch.collegeDays.trim();
    if (patch.teacherNames != null || patch.tutorName != null) {
      const teacherNames = parseCohortTeachers(
        formatCohortTeachers(
          patch.teacherNames ?? parseCohortTeachers(patch.tutorName),
        ),
      );
      update.tutor_name = formatCohortTeachers(teacherNames);
    }
    if (patch.status != null) update.status = patch.status;
    if (patch.notes != null) update.notes = patch.notes.trim();
    if (patch.locked != null) update.locked = patch.locked;

    const { data, error } = await supabase
      .from("cohorts")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update cohort" },
        { status: 500 },
      );
    }
    return NextResponse.json({ cohort: mapCohort(data as CohortRow) });
  }

  if (body.action === "lockCohortSession") {
    const details = (body.details ?? [])
      .map((line) => String(line).trim())
      .filter(Boolean);
    const actorName = (body.actorName ?? "").trim() || actorFallback;
    const summary =
      (body.summary ?? "").trim() ||
      (details.length
        ? `${actorName} saved ${details.length} change${details.length === 1 ? "" : "s"}`
        : `${actorName} locked with no structural changes`);

    const { data: existingRow, error: existingError } = await supabase
      .from("cohorts")
      .select("*")
      .eq("id", body.id)
      .single();
    if (existingError || !existingRow) {
      return NextResponse.json(
        { error: existingError?.message ?? "Cohort not found" },
        { status: 404 },
      );
    }

    const { data: logRow, error: logError } = await supabase
      .from("cohort_change_log")
      .insert({
        cohort_id: body.id,
        summary,
        details,
        actor_name: actorName,
      })
      .select("*")
      .single();
    if (logError || !logRow) {
      const message = logError?.message ?? "Unable to write change log";
      if (isMissingSchemaError(message)) {
        return NextResponse.json(
          {
            error:
              "Change log missing. Run supabase/migrations/002_cohorts_and_teaching_groups.sql.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("cohorts")
      .update({ locked: true })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to lock cohort" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      cohort: mapCohort(data as CohortRow),
      entry: mapCohortChangeLog(logRow as CohortChangeLogRow),
    });
  }

  if (body.action === "createTeachingGroup") {
    const input = body.input;
    const tutorName = input.tutorName.trim();
    const collegeDays = input.collegeDays.trim();
    const gtaProgrammeVersionId = (input.gtaProgrammeVersionId ?? "").trim();
    if (!gtaProgrammeVersionId) {
      return NextResponse.json(
        { error: "Choose the GTA Programme Version this group delivers." },
        { status: 400 },
      );
    }
    if (!tutorName) {
      return NextResponse.json(
        { error: "Choose a tutor who owns this group." },
        { status: 400 },
      );
    }
    if (!collegeDays || parseCollegeDays(collegeDays).length === 0) {
      return NextResponse.json(
        { error: "Choose the college day this group attends." },
        { status: 400 },
      );
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("cohort_teaching_groups")
      .select("id, name, tutor_name, college_days, status")
      .eq("status", "active");
    if (existingError && !isMissingSchemaError(existingError.message)) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    const clash = (existingRows ?? []).find(
      (row) =>
        String(row.tutor_name ?? "").toLowerCase() === tutorName.toLowerCase() &&
        collegeDaysOverlap(String(row.college_days ?? ""), collegeDays),
    );
    if (clash) {
      return NextResponse.json(
        {
          error: `${tutorName} already has “${clash.name}” on ${formatCollegeDaysShort(String(clash.college_days ?? ""))}. Pick a free day.`,
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("cohort_teaching_groups")
      .insert({
        cohort_id: null,
        gta_programme_version_id: gtaProgrammeVersionId,
        version_review_required: false,
        status: input.status ?? "active",
        tutor_name: tutorName,
        name: input.name.trim() || "Group",
        college_days: collegeDays,
        capacity: Math.max(1, input.capacity ?? DEFAULT_TEACHING_GROUP_CAPACITY),
        notes: notesWithTutorIdentity(input.notes ?? "", {
          id: input.tutorUserId,
          email: input.tutorEmail,
        }),
      })
      .select("*")
      .single();
    if (error || !data) {
      const message = error?.message ?? "Unable to create teaching group";
      if (isMissingSchemaError(message)) {
        return NextResponse.json(
          {
            error:
              "Teaching groups missing. Run supabase/migrations/002_cohorts_and_teaching_groups.sql and 034_independent_teaching_groups.sql.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({
      teachingGroup: mapTeachingGroup(data as TeachingGroupRow),
    });
  }

  if (body.action === "updateTeachingGroup") {
    const patch = body.patch;
    const { data: existingGroup, error: existingGroupError } = await supabase
      .from("cohort_teaching_groups")
      .select("*")
      .eq("id", body.id)
      .single();
    if (existingGroupError || !existingGroup) {
      return NextResponse.json(
        {
          error: existingGroupError?.message ?? "Teaching group not found",
        },
        {
          status:
            existingGroupError && isMissingSchemaError(existingGroupError.message)
              ? 500
              : 404,
        },
      );
    }
    const existingMapped = mapTeachingGroup(existingGroup as TeachingGroupRow);

    const nextTutor = (patch.tutorName ?? existingMapped.tutorName).trim();
    const nextDays = (patch.collegeDays ?? existingMapped.collegeDays).trim();
    if (patch.tutorName != null || patch.collegeDays != null) {
      if (!nextTutor) {
        return NextResponse.json(
          { error: "Choose a tutor who owns this group." },
          { status: 400 },
        );
      }
      if (!nextDays || parseCollegeDays(nextDays).length === 0) {
        return NextResponse.json(
          { error: "Choose the college day this group attends." },
          { status: 400 },
        );
      }
      const { data: existingRows } = await supabase
        .from("cohort_teaching_groups")
        .select("id, name, tutor_name, college_days, status")
        .eq("status", "active")
        .neq("id", body.id);
      const clash = (existingRows ?? []).find(
        (row) =>
          String(row.tutor_name ?? "").toLowerCase() === nextTutor.toLowerCase() &&
          collegeDaysOverlap(String(row.college_days ?? ""), nextDays),
      );
      if (clash) {
        return NextResponse.json(
          {
            error: `${nextTutor} already has “${clash.name}” on ${formatCollegeDaysShort(String(clash.college_days ?? ""))}. Pick a free day.`,
          },
          { status: 409 },
        );
      }
    }

    if (patch.gtaProgrammeVersionId !== undefined) {
      const nextVersion = patch.gtaProgrammeVersionId.trim();
      if (!nextVersion) {
        return NextResponse.json(
          { error: "Choose the GTA Programme Version this group delivers." },
          { status: 400 },
        );
      }
      const { data: members } = await supabase
        .from("apprentice_programmes")
        .select("id, gta_programme_version_id")
        .eq("teaching_group_id", body.id);
      const mismatched = (members ?? []).some(
        (row) =>
          String(row.gta_programme_version_id ?? "").trim() !== nextVersion,
      );
      if (mismatched) {
        return NextResponse.json(
          { error: GROUP_VERSION_MEMBER_MISMATCH_MESSAGE },
          { status: 400 },
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (patch.tutorName != null) update.tutor_name = patch.tutorName.trim();
    if (patch.name != null) update.name = patch.name.trim() || "Group";
    if (patch.collegeDays != null) update.college_days = patch.collegeDays.trim();
    if (patch.capacity != null) {
      update.capacity = Math.max(1, Math.round(patch.capacity));
    }
    if (patch.notes != null || patch.tutorUserId != null || patch.tutorEmail != null) {
      update.notes = notesWithTutorIdentity(patch.notes ?? existingMapped.notes, {
        id: patch.tutorUserId,
        email: patch.tutorEmail,
      });
    }
    if (patch.gtaProgrammeVersionId != null) {
      update.gta_programme_version_id = patch.gtaProgrammeVersionId.trim();
      update.version_review_required = false;
    }
    if (patch.status != null) update.status = patch.status;

    const { data, error } = await supabase
      .from("cohort_teaching_groups")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update teaching group" },
        { status: 500 },
      );
    }

    const teachingGroup = mapTeachingGroup(data as TeachingGroupRow);
    if (patch.tutorName != null || patch.collegeDays != null) {
      const enrolmentUpdate: Record<string, unknown> = {};
      if (patch.tutorName != null) {
        enrolmentUpdate.tutor_name = teachingGroup.tutorName;
      }
      if (patch.collegeDays != null) {
        enrolmentUpdate.college_days = teachingGroup.collegeDays;
      }
      const { error: syncError } = await supabase
        .from("apprentice_programmes")
        .update(enrolmentUpdate)
        .eq("teaching_group_id", body.id);
      if (syncError) {
        return NextResponse.json(
          {
            error: `Teaching group updated, but enrolments could not be synced: ${syncError.message}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ teachingGroup });
  }

  if (body.action === "deleteTeachingGroup") {
    const { data: existingGroup, error: existingGroupError } = await supabase
      .from("cohort_teaching_groups")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (existingGroupError && !isMissingSchemaError(existingGroupError.message)) {
      return NextResponse.json(
        { error: existingGroupError.message },
        { status: 500 },
      );
    }
    if (existingGroup) {
      // Groups are independent of cohort lock.
    }

    const { count, error: countError } = await supabase
      .from("apprentice_programmes")
      .select("id", { count: "exact", head: true })
      .eq("teaching_group_id", body.id);
    if (countError) {
      if (!isMissingSchemaError(countError.message)) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }
    } else if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Move or remove apprentices from this group before deleting it. Historic groups should be set inactive instead.",
        },
        { status: 400 },
      );
    }

    const { count: membershipCount, error: membershipCountError } = await supabase
      .from("teaching_group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("teaching_group_id", body.id);
    if (membershipCountError) {
      if (!isMissingSchemaError(membershipCountError.message)) {
        return NextResponse.json(
          { error: membershipCountError.message },
          { status: 500 },
        );
      }
    } else if ((membershipCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This teaching group has membership history. Set it inactive instead of deleting it.",
        },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("cohort_teaching_groups")
      .delete()
      .eq("id", body.id);
    if (error) {
      const message = error.message;
      if (isMissingSchemaError(message)) {
        return NextResponse.json(
          {
            error:
              "Teaching groups missing. Run supabase/migrations/002_cohorts_and_teaching_groups.sql.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return null;
}

export type TeachingGroupMembershipRow = {
  id: string;
  apprentice_programme_id: string;
  teaching_group_id: string;
  joined_at: string | null;
  left_at: string | null;
  is_current: boolean;
  source: string;
  recorded_at: string;
  actor_name: string | null;
  notes: string | null;
};

export function mapTeachingGroupMembership(
  row: TeachingGroupMembershipRow,
): AdminTeachingGroupMembership {
  return {
    id: row.id,
    enrolmentId: row.apprentice_programme_id,
    teachingGroupId: row.teaching_group_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    isCurrent: Boolean(row.is_current),
    source: row.source === "legacy_backfill" ? "legacy_backfill" : "staff",
    recordedAt: row.recorded_at,
    actorName: row.actor_name ?? "",
    notes: row.notes ?? "",
  };
}

export async function loadTeachingGroupMemberships(
  supabase: SupabaseAdmin,
): Promise<{
  memberships: AdminTeachingGroupMembership[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("teaching_group_memberships")
    .select("*")
    .order("recorded_at", { ascending: false });
  if (error) {
    if (isMissingSchemaError(error.message)) {
      return { memberships: [] };
    }
    return { memberships: [], error: error.message };
  }
  return {
    memberships: (data ?? []).map((row) =>
      mapTeachingGroupMembership(row as TeachingGroupMembershipRow),
    ),
  };
}

function firstNested<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadGtaProgrammeVersions(
  supabase: SupabaseAdmin,
): Promise<{
  versions: AdminGtaProgrammeVersionOption[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("gta_programme_versions")
    .select(
      "id, programme_id, internal_version, status, gta_programmes(title, se_standards(standard_code)), se_standard_versions(external_version), gta_spines(title)",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingSchemaError(error.message)) {
      return { versions: [] };
    }
    return { versions: [], error: error.message };
  }

  const versions: AdminGtaProgrammeVersionOption[] = (data ?? []).map((row) => {
    const programme = firstNested(
      row.gta_programmes as
        | { title?: string; se_standards?: { standard_code?: string } | { standard_code?: string }[] }
        | { title?: string; se_standards?: { standard_code?: string } | { standard_code?: string }[] }[]
        | null,
    );
    const seStandard = firstNested(
      programme?.se_standards as
        | { standard_code?: string }
        | { standard_code?: string }[]
        | null,
    );
    const seVersion = firstNested(
      row.se_standard_versions as
        | { external_version?: string }
        | { external_version?: string }[]
        | null,
    );
    const spines = Array.isArray(row.gta_spines)
      ? row.gta_spines
          .map((spine) => String((spine as { title?: string }).title ?? "").trim())
          .filter(Boolean)
      : [];
    return {
      id: String(row.id),
      programmeId: String(row.programme_id ?? ""),
      programmeTitle: String(programme?.title ?? "GTA programme"),
      standardCode: String(seStandard?.standard_code ?? ""),
      skillsEnglandVersion: String(seVersion?.external_version ?? ""),
      internalVersion: String(row.internal_version ?? "1"),
      status: (row.status as AdminGtaProgrammeVersionOption["status"]) ?? "draft",
      deliverySpine: spines.join(" / "),
    };
  });
  return { versions };
}

async function loadMembershipsForEnrolment(
  supabase: SupabaseAdmin,
  enrolmentId: string,
): Promise<AdminTeachingGroupMembership[]> {
  const { data, error } = await supabase
    .from("teaching_group_memberships")
    .select("*")
    .eq("apprentice_programme_id", enrolmentId)
    .order("recorded_at", { ascending: false });
  if (error) {
    if (isMissingSchemaError(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) =>
    mapTeachingGroupMembership(row as TeachingGroupMembershipRow),
  );
}

export async function applyLiveTeachingGroupPlacement(args: {
  supabase: SupabaseAdmin;
  enrolment: Pick<
    AdminApprenticeEnrolment,
    | "id"
    | "gtaProgrammeVersionId"
    | "teachingGroupId"
    | "tutorName"
    | "collegeDays"
  >;
  teachingGroupId: string | null;
  allowOverCapacity?: boolean;
  actorName?: string;
}): Promise<{ error: string; status: number } | { ok: true }> {
  const { supabase } = args;
  let group: AdminTeachingGroupRecord | null = null;
  if (args.teachingGroupId) {
    const { data, error } = await supabase
      .from("cohort_teaching_groups")
      .select("*")
      .eq("id", args.teachingGroupId)
      .maybeSingle();
    if (error && !isMissingSchemaError(error.message)) {
      return { error: error.message, status: 500 };
    }
    group = data ? mapTeachingGroup(data as TeachingGroupRow) : null;
  }

  const { data: enrolmentRows, error: enrolmentError } = await supabase
    .from("apprentice_programmes")
    .select("id, teaching_group_id");
  if (enrolmentError) {
    return { error: enrolmentError.message, status: 500 };
  }

  let memberships: AdminTeachingGroupMembership[] = [];
  try {
    memberships = await loadMembershipsForEnrolment(supabase, args.enrolment.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unable to load memberships",
      status: 500,
    };
  }

  const planned = planTeachingGroupMembershipChange({
    enrolment: args.enrolment,
    group,
    currentMembership: currentMembershipForEnrolment(
      memberships,
      args.enrolment.id,
    ),
    enrolments: (enrolmentRows ?? []).map((row) => ({
      id: String(row.id),
      teachingGroupId: (row.teaching_group_id as string | null) ?? null,
    })),
    allowOverCapacity: args.allowOverCapacity,
    actorName: args.actorName,
  });
  if ("error" in planned) {
    return { error: planned.error, status: 400 };
  }

  const { error: enrolmentUpdateError } = await supabase
    .from("apprentice_programmes")
    .update({
      teaching_group_id: planned.enrolmentPatch.teachingGroupId,
      tutor_name: planned.enrolmentPatch.tutorName,
      college_days: planned.enrolmentPatch.collegeDays,
    })
    .eq("id", args.enrolment.id);
  if (enrolmentUpdateError) {
    return { error: enrolmentUpdateError.message, status: 500 };
  }

  if (planned.closeMembershipId) {
    const { error: closeError } = await supabase
      .from("teaching_group_memberships")
      .update({
        is_current: false,
        left_at: planned.newMembership?.recordedAt ?? new Date().toISOString(),
      })
      .eq("id", planned.closeMembershipId);
    if (closeError && !isMissingSchemaError(closeError.message)) {
      return { error: closeError.message, status: 500 };
    }
  }

  if (planned.newMembership) {
    const { error: insertError } = await supabase
      .from("teaching_group_memberships")
      .insert({
        apprentice_programme_id: planned.newMembership.enrolmentId,
        teaching_group_id: planned.newMembership.teachingGroupId,
        joined_at: planned.newMembership.joinedAt,
        left_at: planned.newMembership.leftAt,
        is_current: planned.newMembership.isCurrent,
        source: planned.newMembership.source,
        recorded_at: planned.newMembership.recordedAt,
        actor_name: planned.newMembership.actorName,
        notes: planned.newMembership.notes,
      });
    if (insertError && !isMissingSchemaError(insertError.message)) {
      return { error: insertError.message, status: 500 };
    }
  }

  return { ok: true };
}

export async function assertLivePinCohortAndGroup(args: {
  supabase: SupabaseAdmin;
  pinId: string | null | undefined;
  cohortId: string | null | undefined;
  teachingGroupId?: string | null;
  versions: AdminGtaProgrammeVersionOption[];
}): Promise<{ error: string; status: number } | { ok: true }> {
  let cohort: AdminCohortRecord | null = null;
  if (args.cohortId) {
    const loaded = await fetchCohortById(args.supabase, args.cohortId);
    if ("error" in loaded) {
      return { error: loaded.error, status: 404 };
    }
    cohort = loaded;
  }
  const pinId = args.pinId?.trim() || "";
  const pin = pinId
    ? (args.versions.find((row) => row.id === pinId) ?? null)
    : null;
  const pinError = pinCompatibilityError({ pinId, pin, cohort });
  if (pinError) return { error: pinError, status: 400 };

  const groupId = args.teachingGroupId?.trim() || "";
  if (pinId && groupId) {
    const { data } = await args.supabase
      .from("cohort_teaching_groups")
      .select("gta_programme_version_id")
      .eq("id", groupId)
      .maybeSingle();
    const groupPin = String(data?.gta_programme_version_id ?? "").trim();
    if (groupPin && groupPin !== pinId) {
      return { error: PIN_GROUP_MISMATCH_MESSAGE, status: 400 };
    }
  }
  return { ok: true };
}
