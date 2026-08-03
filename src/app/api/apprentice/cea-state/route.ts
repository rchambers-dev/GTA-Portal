import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  createBlankCeaState,
  emptyCeaTaskProgress,
  getGroupsPackById,
  normalizeCeaTaskProgress,
  normalizeLoadedCeaState,
  type CeaApprenticeState,
  type CeaFieldReviewStatus,
  type CeaTaskProgress,
} from "@/features/apprentice-portal/domain/cea";
import { calculateGroupsProgress } from "@/features/programme-delivery/domain/groups-progression";
import type { EffectiveSession } from "@/lib/portal/types";

type DbRow = {
  apprentice_id: string;
  pack_id: string;
  mandatory_by_group: Record<string, string[]>;
  progress: Record<string, CeaTaskProgress>;
  milestone_reflections: CeaApprenticeState["milestoneReflections"];
};

function canAccessApprentice(
  session: EffectiveSession,
  apprenticeId: string,
): boolean {
  if (session.account.workspace === "apprentice") {
    return session.account.linkedApprenticeId === apprenticeId;
  }
  if (session.account.workspace === "employer") {
    return session.account.linkedApprenticeId === apprenticeId;
  }
  return true;
}

function rowToState(row: DbRow): CeaApprenticeState {
  return normalizeLoadedCeaState({
    apprenticeId: row.apprentice_id,
    packId: row.pack_id,
    mandatoryByGroup: row.mandatory_by_group ?? {},
    progress: row.progress ?? {},
    milestoneReflections: row.milestone_reflections ?? {},
  });
}

function mergeWithBlank(
  blank: CeaApprenticeState,
  loaded: CeaApprenticeState | null,
): CeaApprenticeState {
  if (!loaded) return blank;
  return normalizeLoadedCeaState({
    apprenticeId: blank.apprenticeId,
    packId: blank.packId,
    mandatoryByGroup: {
      ...blank.mandatoryByGroup,
      ...loaded.mandatoryByGroup,
    },
    progress: { ...loaded.progress },
    milestoneReflections: { ...loaded.milestoneReflections },
  });
}

function mergeApprenticeFields(
  prev: CeaTaskProgress,
  nextFields: Record<string, string> | undefined,
): Record<string, string> {
  if (!nextFields || typeof nextFields !== "object") return prev.fields;
  const merged = { ...prev.fields };
  for (const [key, value] of Object.entries(nextFields)) {
    if (typeof value !== "string") continue;
    if (prev.status === "returned") {
      const review: CeaFieldReviewStatus =
        prev.fieldReviews[key] ?? "open";
      if (review === "approved") continue;
    }
    if (
      prev.status === "ready_to_assess" ||
      prev.status === "awaiting_tutor_verify" ||
      prev.status === "signed_off"
    ) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

/** Apprentices may save drafts / submit; staff/employer write via their APIs. */
function sanitizeApprenticePatch(
  blank: CeaApprenticeState,
  existing: CeaApprenticeState,
  incoming: CeaApprenticeState,
): CeaApprenticeState {
  const progress: Record<string, CeaTaskProgress> = { ...existing.progress };

  for (const [taskId, nextRaw] of Object.entries(incoming.progress ?? {})) {
    const prev = normalizeCeaTaskProgress(
      taskId,
      existing.progress[taskId],
      nextRaw.kind ?? "mandatory",
    );
    const next = nextRaw;
    const base =
      existing.progress[taskId] != null
        ? prev
        : emptyCeaTaskProgress(taskId, next.kind ?? "mandatory");

    let status = base.status;
    let readyAt = base.readyAt;
    let submittedAt = base.submittedAt;
    let apprenticeDeclaredAt = base.apprenticeDeclaredAt;
    let submissionCount = base.submissionCount;
    let isResubmission = base.isResubmission;
    let versions = base.versions;
    let fieldReviews = base.fieldReviews;
    let comments = base.comments;
      let returnNote = base.returnNote;
    let tutorReview = base.tutorReview;
    let employerSignedByName = base.employerSignedByName;
    let employerSignedAt = base.employerSignedAt;

    const fields = mergeApprenticeFields(base, next.fields);

    if (
      next.status === "in_progress" &&
      (base.status === "not_started" || base.status === "returned")
    ) {
      status = "in_progress";
    }

    if (
      next.status === "ready_to_assess" &&
      (base.status === "not_started" ||
        base.status === "in_progress" ||
        base.status === "returned")
    ) {
      const now = next.readyAt ?? new Date().toISOString();
      const declared =
        next.apprenticeDeclaredAt ?? new Date().toISOString();
      const wasReturn = base.status === "returned";
      submissionCount = base.submissionCount + 1;
      isResubmission = wasReturn || base.submissionCount > 0;
      const versionEntry = {
        version: submissionCount,
        submittedAt: now,
        isResubmission,
        declaredAt: declared,
        fields: { ...fields },
        reviewNote: null,
        outcome: "pending" as const,
      };
      versions = [...base.versions, versionEntry];
      // Keep approved ticks; re-open anything that needed amendment.
      const nextReviews: Record<string, CeaFieldReviewStatus> = {
        ...base.fieldReviews,
      };
      for (const [key, review] of Object.entries(nextReviews)) {
        if (review === "needs_amendment") nextReviews[key] = "open";
      }
      fieldReviews = nextReviews;
      comments = base.comments.map((c) =>
        c.fieldKey && nextReviews[c.fieldKey] === "open" && wasReturn
          ? { ...c, resolved: true }
          : c,
      );
      status = "ready_to_assess";
      readyAt = now;
      submittedAt = now;
      apprenticeDeclaredAt = declared;
      returnNote = null;
      tutorReview = null;
      employerSignedByName = null;
      employerSignedAt = null;
    }

    progress[taskId] = {
      ...base,
      fields,
      apprenticeNotes: next.apprenticeNotes ?? base.apprenticeNotes,
      status,
      readyAt,
      submittedAt,
      apprenticeDeclaredAt,
      submissionCount,
      isResubmission,
      versions,
      fieldReviews,
      comments,
      returnNote,
      tutorReview,
      employerSignedByName,
      employerSignedAt,
      kind: base.kind,
      additionalEnabled: base.additionalEnabled,
      signedOffByRole: base.signedOffByRole,
      signedOffByName: base.signedOffByName,
      signedOffAt: base.signedOffAt,
    };
  }

  const milestoneReflections = { ...existing.milestoneReflections };
  for (const [milestoneId, next] of Object.entries(
    incoming.milestoneReflections ?? {},
  )) {
    const prev = existing.milestoneReflections[milestoneId];
    if (prev?.status === "accepted") {
      milestoneReflections[milestoneId] = prev;
      continue;
    }
    const status =
      next.status === "submitted" || next.status === "draft"
        ? next.status
        : (prev?.status ?? "draft");
    milestoneReflections[milestoneId] = {
      text: next.text ?? prev?.text ?? "",
      status,
    };
  }

  return {
    apprenticeId: blank.apprenticeId,
    packId: blank.packId,
    mandatoryByGroup: existing.mandatoryByGroup,
    progress,
    milestoneReflections,
  };
}

async function syncActualProgressPercent(
  apprenticeId: string,
  state: CeaApprenticeState,
) {
  const pack = getGroupsPackById(state.packId);
  if (!pack) return;

  const supabase = createSupabaseAdminClient();
  const { data: programme } = await supabase
    .from("apprentice_programmes")
    .select("id, start_date")
    .eq("apprentice_id", apprenticeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!programme?.start_date) return;

  const { actualPercent } = calculateGroupsProgress({
    pack,
    state,
    programmeStartIso: programme.start_date,
  });

  await supabase
    .from("apprentice_programmes")
    .update({ actual_progress_percent: actualPercent })
    .eq("id", programme.id);
}

export async function GET(request: Request) {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const apprenticeId = url.searchParams.get("apprenticeId")?.trim() ?? "";
  const packId = url.searchParams.get("packId")?.trim() ?? "";

  if (!apprenticeId || !packId) {
    return NextResponse.json(
      { error: "apprenticeId and packId are required." },
      { status: 400 },
    );
  }

  if (!canAccessApprentice(session, apprenticeId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pack = getGroupsPackById(packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack." }, { status: 404 });
  }

  const blank = createBlankCeaState(apprenticeId, pack);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cea_apprentice_states")
    .select(
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections",
    )
    .eq("apprentice_id", apprenticeId)
    .eq("pack_id", packId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const state = mergeWithBlank(
    blank,
    data ? rowToState(data as DbRow) : null,
  );

  return NextResponse.json({ state, exists: Boolean(data) });
}

export async function PUT(request: Request) {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    apprenticeId?: string;
    packId?: string;
    state?: CeaApprenticeState;
  } | null;

  const apprenticeId = body?.apprenticeId?.trim() ?? "";
  const packId = body?.packId?.trim() ?? body?.state?.packId?.trim() ?? "";
  if (!apprenticeId || !packId || !body?.state) {
    return NextResponse.json(
      { error: "apprenticeId, packId and state are required." },
      { status: 400 },
    );
  }

  if (!canAccessApprentice(session, apprenticeId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pack = getGroupsPackById(packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack." }, { status: 404 });
  }

  const blank = createBlankCeaState(apprenticeId, pack);
  const supabase = createSupabaseAdminClient();
  const { data: existingRow, error: loadError } = await supabase
    .from("cea_apprentice_states")
    .select(
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections",
    )
    .eq("apprentice_id", apprenticeId)
    .eq("pack_id", packId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const existing = mergeWithBlank(
    blank,
    existingRow ? rowToState(existingRow as DbRow) : null,
  );

  // Only GTA staff may write unrestricted state. Employers use /api/staff/cea-sign-offs.
  const nextState =
    session.account.workspace !== "apprentice" &&
    session.account.workspace !== "employer"
      ? normalizeLoadedCeaState({
          apprenticeId,
          packId,
          mandatoryByGroup:
            body.state.mandatoryByGroup ?? existing.mandatoryByGroup,
          progress: body.state.progress ?? existing.progress,
          milestoneReflections:
            body.state.milestoneReflections ?? existing.milestoneReflections,
        })
      : sanitizeApprenticePatch(blank, existing, body.state);

  const { data, error } = await supabase
    .from("cea_apprentice_states")
    .upsert(
      {
        apprentice_id: apprenticeId,
        pack_id: packId,
        mandatory_by_group: nextState.mandatoryByGroup,
        progress: nextState.progress,
        milestone_reflections: nextState.milestoneReflections,
      },
      { onConflict: "apprentice_id,pack_id" },
    )
    .select(
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const saved = rowToState(data as DbRow);
  try {
    await syncActualProgressPercent(apprenticeId, saved);
  } catch {
    // Progress % sync is best-effort; state save already succeeded.
  }

  return NextResponse.json({ state: saved });
}
