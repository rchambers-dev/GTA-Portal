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
import type {
  AdminCohortChangeLogEntry,
  AdminCohortRecord,
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
  cohort_id: string;
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
  return {
    id: row.id,
    cohortId: row.cohort_id,
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

async function fetchCohortLocked(
  supabase: SupabaseAdmin,
  cohortId: string,
): Promise<{ locked: boolean; cohort?: AdminCohortRecord } | { error: string }> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("*")
    .eq("id", cohortId)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Cohort not found" };
  }
  const cohort = mapCohort(data as CohortRow);
  return { locked: cohort.locked !== false, cohort };
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
    const lockState = await fetchCohortLocked(supabase, input.cohortId);
    if ("error" in lockState) {
      return NextResponse.json({ error: lockState.error }, { status: 404 });
    }
    if (lockState.locked) {
      return NextResponse.json({ error: COHORT_LOCKED_MESSAGE }, { status: 403 });
    }
    const tutorName = input.tutorName.trim();
    const collegeDays = input.collegeDays.trim();
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
      .select("id, name, tutor_name, college_days")
      .eq("cohort_id", input.cohortId);
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
        cohort_id: input.cohortId,
        tutor_name: tutorName,
        name: input.name.trim() || "Group",
        college_days: collegeDays,
        capacity: Math.max(1, input.capacity ?? DEFAULT_TEACHING_GROUP_CAPACITY),
        notes: (input.notes ?? "").trim(),
      })
      .select("*")
      .single();
    if (error || !data) {
      const message = error?.message ?? "Unable to create teaching group";
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
    const lockState = await fetchCohortLocked(supabase, existingMapped.cohortId);
    if ("error" in lockState) {
      return NextResponse.json({ error: lockState.error }, { status: 404 });
    }
    if (lockState.locked) {
      return NextResponse.json({ error: COHORT_LOCKED_MESSAGE }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (patch.tutorName != null) update.tutor_name = patch.tutorName.trim();
    if (patch.name != null) update.name = patch.name.trim() || "Group";
    if (patch.collegeDays != null) update.college_days = patch.collegeDays.trim();
    if (patch.capacity != null) {
      update.capacity = Math.max(1, Math.round(patch.capacity));
    }
    if (patch.notes != null) update.notes = patch.notes.trim();
    if (patch.cohortId != null) update.cohort_id = patch.cohortId;

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
      const mapped = mapTeachingGroup(existingGroup as TeachingGroupRow);
      const lockState = await fetchCohortLocked(supabase, mapped.cohortId);
      if ("error" in lockState) {
        return NextResponse.json({ error: lockState.error }, { status: 404 });
      }
      if (lockState.locked) {
        return NextResponse.json({ error: COHORT_LOCKED_MESSAGE }, { status: 403 });
      }
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
          error: "Move or remove apprentices from this group before deleting it.",
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
