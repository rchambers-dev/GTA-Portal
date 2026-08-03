import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  createBlankCeaState,
  getGroupsPackById,
  normalizeCeaTaskProgress,
  normalizeLoadedCeaState,
  type CeaApprenticeState,
  type CeaFieldReviewStatus,
  type CeaReviewComment,
  type CeaSignOffRole,
  type CeaTaskProgress,
} from "@/features/apprentice-portal/domain/cea";
import { calculateGroupsProgress } from "@/features/programme-delivery/domain/groups-progression";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";

type DbRow = {
  apprentice_id: string;
  pack_id: string;
  mandatory_by_group: Record<string, string[]>;
  progress: Record<string, CeaTaskProgress>;
  milestone_reflections: CeaApprenticeState["milestoneReflections"];
  updated_at: string;
};

export type CeaSignOffQueueItem = {
  apprenticeId: string;
  apprenticeName: string;
  programmeName: string;
  standardCode: string;
  packId: string;
  packTitle: string;
  groupId: string;
  groupNumber: number;
  groupTitle: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  status: "ready_to_assess" | "awaiting_tutor_verify" | "returned";
  kind: "mandatory" | "additional";
  isResubmission: boolean;
  submissionCount: number;
  apprenticeNotes: string;
  readyAt: string | null;
  returnNote: string | null;
  tutorReview: string | null;
  employerSignedByName: string | null;
  employerSignedAt: string | null;
};

function requireReviewer(
  session: EffectiveSession | null,
  audience: "teacher" | "employer",
) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (audience === "employer") {
    if (session.account.workspace !== "employer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return session;
  }
  if (session.account.workspace === "apprentice") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.account.workspace === "employer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !hasPermission(session, PERMISSIONS.MODULES_DELIVER) &&
    !hasPermission(session, PERMISSIONS.STAFF_WORKSPACE_VIEW) &&
    !hasPermission(session, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
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

function closeLatestVersion(
  progress: CeaTaskProgress,
  outcome: "returned" | "signed_off" | "employer_approved",
  reviewNote: string | null,
): CeaTaskProgress["versions"] {
  if (progress.versions.length === 0) return progress.versions;
  const versions = [...progress.versions];
  const last = versions[versions.length - 1]!;
  versions[versions.length - 1] = {
    ...last,
    outcome,
    reviewNote,
  };
  return versions;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const audience =
    url.searchParams.get("audience") === "employer" ? "employer" : "teacher";
  const session = requireReviewer(
    await getStandalonePorts().auth.getEffectiveSession(),
    audience,
  );
  if (session instanceof NextResponse) return session;

  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("cea_apprentice_states")
    .select(
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let apprenticeIds = [
    ...new Set((rows ?? []).map((r) => (r as DbRow).apprentice_id)),
  ];

  // Employers only see linked apprentices (same linkedApprenticeId pattern for now).
  if (audience === "employer") {
    const linked = session.account.linkedApprenticeId;
    if (!linked) {
      return NextResponse.json({ queue: [] });
    }
    apprenticeIds = apprenticeIds.filter((id) => id === linked);
  }

  const nameById = new Map<string, string>();
  const programmeById = new Map<
    string,
    { programmeName: string; standardCode: string }
  >();

  if (apprenticeIds.length > 0) {
    const { data: apprentices } = await supabase
      .from("apprentices")
      .select("id, display_name")
      .in("id", apprenticeIds);
    for (const a of apprentices ?? []) {
      nameById.set(a.id, a.display_name ?? "Apprentice");
    }

    const { data: programmes } = await supabase
      .from("apprentice_programmes")
      .select("apprentice_id, programme_name, standard_code, created_at")
      .in("apprentice_id", apprenticeIds)
      .order("created_at", { ascending: false });
    for (const p of programmes ?? []) {
      if (!p.apprentice_id || programmeById.has(p.apprentice_id)) continue;
      programmeById.set(p.apprentice_id, {
        programmeName: p.programme_name ?? "Programme",
        standardCode: p.standard_code ?? "",
      });
    }
  }

  const queue: CeaSignOffQueueItem[] = [];
  const idSet = new Set(apprenticeIds);

  for (const raw of rows ?? []) {
    const row = raw as DbRow;
    if (!idSet.has(row.apprentice_id)) continue;
    const pack = getGroupsPackById(row.pack_id);
    if (!pack) continue;
    const prog = programmeById.get(row.apprentice_id);
    const apprenticeName =
      nameById.get(row.apprentice_id) ?? "Unknown apprentice";

    for (const [taskId, progressRaw] of Object.entries(row.progress ?? {})) {
      const progress = normalizeCeaTaskProgress(taskId, progressRaw);

      if (audience === "employer") {
        if (
          progress.kind !== "additional" ||
          !progress.additionalEnabled ||
          progress.status !== "ready_to_assess"
        ) {
          continue;
        }
      } else {
        // Tutor: mandatory submissions + workplace tasks after employer approval.
        const tutorMandatory =
          progress.kind === "mandatory" &&
          progress.status === "ready_to_assess";
        const tutorVerifyWorkplace =
          progress.kind === "additional" &&
          progress.additionalEnabled &&
          progress.status === "awaiting_tutor_verify";
        if (!tutorMandatory && !tutorVerifyWorkplace) continue;
      }

      const group = pack.groups.find((g) =>
        g.tasks.some((t) => t.id === taskId),
      );
      const task = group?.tasks.find((t) => t.id === taskId);
      if (!group || !task) continue;

      queue.push({
        apprenticeId: row.apprentice_id,
        apprenticeName,
        programmeName: prog?.programmeName ?? pack.standardLabel,
        standardCode: prog?.standardCode || pack.standardCode,
        packId: row.pack_id,
        packTitle: pack.title,
        groupId: group.id,
        groupNumber: group.number,
        groupTitle: group.title,
        taskId: task.id,
        taskNumber: task.number,
        taskTitle: task.title,
        status: progress.status as CeaSignOffQueueItem["status"],
        kind: progress.kind,
        isResubmission: progress.isResubmission,
        submissionCount: progress.submissionCount,
        apprenticeNotes: progress.apprenticeNotes ?? "",
        readyAt: progress.readyAt,
        returnNote: progress.returnNote,
        tutorReview: progress.tutorReview,
        employerSignedByName: progress.employerSignedByName,
        employerSignedAt: progress.employerSignedAt,
      });
    }
  }

  queue.sort((a, b) => {
    const aReady = a.readyAt ?? "";
    const bReady = b.readyAt ?? "";
    if (aReady !== bReady) return aReady < bReady ? -1 : 1;
    return a.apprenticeName.localeCompare(b.apprenticeName);
  });

  return NextResponse.json({ queue });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    apprenticeId?: string;
    packId?: string;
    taskId?: string;
    action?: "sign_off" | "return" | "save_review";
    audience?: "teacher" | "employer";
    returnNote?: string;
    tutorReview?: string;
    fieldReviews?: Record<string, CeaFieldReviewStatus>;
    addComment?: { fieldKey?: string | null; text: string };
    comments?: CeaReviewComment[];
  } | null;

  const audience =
    body?.audience === "employer" ? "employer" : "teacher";
  const session = requireReviewer(
    await getStandalonePorts().auth.getEffectiveSession(),
    audience,
  );
  if (session instanceof NextResponse) return session;

  const apprenticeId = body?.apprenticeId?.trim() ?? "";
  const packId = body?.packId?.trim() ?? "";
  const taskId = body?.taskId?.trim() ?? "";
  const action = body?.action;
  if (!apprenticeId || !packId || !taskId || !action) {
    return NextResponse.json(
      { error: "apprenticeId, packId, taskId and action are required." },
      { status: 400 },
    );
  }
  if (
    action !== "sign_off" &&
    action !== "return" &&
    action !== "save_review"
  ) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (
    audience === "employer" &&
    session.account.linkedApprenticeId &&
    session.account.linkedApprenticeId !== apprenticeId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pack = getGroupsPackById(packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack." }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingRow, error: loadError } = await supabase
    .from("cea_apprentice_states")
    .select(
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections, updated_at",
    )
    .eq("apprentice_id", apprenticeId)
    .eq("pack_id", packId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const blank = createBlankCeaState(apprenticeId, pack);
  const existing = existingRow
    ? {
        ...blank,
        ...rowToState(existingRow as DbRow),
        mandatoryByGroup: {
          ...blank.mandatoryByGroup,
          ...(existingRow as DbRow).mandatory_by_group,
        },
      }
    : blank;

  const prev = normalizeCeaTaskProgress(taskId, existing.progress[taskId]);
  if (!existing.progress[taskId]) {
    return NextResponse.json(
      { error: "Task progress not found for this apprentice." },
      { status: 404 },
    );
  }

  if (audience === "employer" && prev.kind !== "additional") {
    return NextResponse.json(
      { error: "Employers only review additional workplace tasks." },
      { status: 400 },
    );
  }
  if (
    audience === "teacher" &&
    prev.kind === "additional" &&
    prev.status !== "awaiting_tutor_verify" &&
    action !== "save_review"
  ) {
    if (prev.status === "ready_to_assess") {
      return NextResponse.json(
        {
          error:
            "Workplace tasks must be approved by the employer before tutor verification.",
        },
        { status: 400 },
      );
    }
  }
  if (
    audience === "employer" &&
    prev.status !== "ready_to_assess" &&
    action !== "save_review"
  ) {
    return NextResponse.json(
      {
        error:
          prev.status === "awaiting_tutor_verify"
            ? "Already employer-approved — waiting for tutor verification."
            : "Only newly submitted workplace work can be reviewed by the employer.",
      },
      { status: 400 },
    );
  }

  const actorName = session.account.name || (audience === "employer" ? "Employer" : "Tutor");
  const role: CeaSignOffRole =
    audience === "employer" ? "employer" : "teacher";
  const now = new Date().toISOString();

  let fieldReviews = { ...prev.fieldReviews };
  if (body.fieldReviews && typeof body.fieldReviews === "object") {
    for (const [key, value] of Object.entries(body.fieldReviews)) {
      if (
        value === "open" ||
        value === "approved" ||
        value === "needs_amendment"
      ) {
        fieldReviews[key] = value;
      }
    }
  }

  let comments = Array.isArray(body.comments)
    ? body.comments
    : [...prev.comments];
  if (body.addComment?.text?.trim()) {
    comments = [
      ...comments,
      {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: now,
        by: actorName,
        byRole: role,
        text: body.addComment.text.trim(),
        fieldKey: body.addComment.fieldKey ?? null,
        resolved: false,
      },
    ];
  }

  const tutorReview =
    body.tutorReview !== undefined
      ? body.tutorReview.trim() || null
      : prev.tutorReview;

  let nextProgress: CeaTaskProgress;

  if (action === "save_review") {
    nextProgress = {
      ...prev,
      fieldReviews,
      comments,
      tutorReview,
    };
  } else if (action === "sign_off") {
    const canEmployerApprove =
      audience === "employer" &&
      prev.kind === "additional" &&
      prev.status === "ready_to_assess";
    const canTutorFinalise =
      audience === "teacher" &&
      ((prev.kind === "mandatory" && prev.status === "ready_to_assess") ||
        (prev.kind === "additional" &&
          prev.status === "awaiting_tutor_verify"));

    if (!canEmployerApprove && !canTutorFinalise) {
      return NextResponse.json(
        { error: "This work is not waiting for your sign-off." },
        { status: 400 },
      );
    }

    // Approve any remaining open fields when signing the whole document.
    for (const key of Object.keys(prev.fields)) {
      if ((fieldReviews[key] ?? "open") !== "needs_amendment") {
        fieldReviews[key] = "approved";
      }
    }
    const blocked = Object.values(fieldReviews).some(
      (v) => v === "needs_amendment",
    );
    if (blocked) {
      return NextResponse.json(
        {
          error:
            "Some parts need amendment. Return those parts instead of signing off.",
        },
        { status: 400 },
      );
    }

    if (canEmployerApprove) {
      // Stage 1 — employer approved; tutor must still verify.
      nextProgress = {
        ...prev,
        status: "awaiting_tutor_verify",
        employerSignedByName: actorName,
        employerSignedAt: now,
        signedOffByRole: null,
        signedOffByName: null,
        signedOffAt: null,
        returnNote: null,
        tutorReview,
        fieldReviews,
        comments,
        versions: closeLatestVersion(prev, "employer_approved", tutorReview),
      };
    } else {
      // Stage 2 (workplace) or sole tutor sign-off (mandatory).
      nextProgress = {
        ...prev,
        status: "signed_off",
        signedOffByRole: "teacher",
        signedOffByName: actorName,
        signedOffAt: now,
        returnNote: null,
        tutorReview,
        fieldReviews,
        comments,
        versions: closeLatestVersion(prev, "signed_off", tutorReview),
      };
    }
  } else {
    const canReturn =
      (audience === "employer" && prev.status === "ready_to_assess") ||
      (audience === "teacher" &&
        (prev.status === "ready_to_assess" ||
          prev.status === "awaiting_tutor_verify"));
    if (!canReturn) {
      return NextResponse.json(
        { error: "This work is not waiting for your review." },
        { status: 400 },
      );
    }
    const needsAmend = Object.values(fieldReviews).some(
      (v) => v === "needs_amendment",
    );
    const note =
      body?.returnNote?.trim() ||
      tutorReview ||
      "Returned — please update the marked parts and resubmit.";
    if (!needsAmend && !body?.returnNote?.trim() && !tutorReview) {
      return NextResponse.json(
        {
          error:
            "Mark at least one part as needs amendment, or leave a review note.",
        },
        { status: 400 },
      );
    }
    nextProgress = {
      ...prev,
      status: "returned",
      signedOffByRole: null,
      signedOffByName: null,
      signedOffAt: null,
      employerSignedByName: null,
      employerSignedAt: null,
      returnNote: note,
      readyAt: null,
      tutorReview,
      fieldReviews,
      comments,
      versions: closeLatestVersion(prev, "returned", note),
    };
  }

  const nextState: CeaApprenticeState = {
    ...existing,
    progress: {
      ...existing.progress,
      [taskId]: nextProgress,
    },
  };

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
      "apprentice_id, pack_id, mandatory_by_group, progress, milestone_reflections, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const saved = rowToState(data as DbRow);
  try {
    await syncActualProgressPercent(apprenticeId, saved);
  } catch {
    // best-effort
  }

  return NextResponse.json({
    state: saved,
    task: nextProgress,
    action,
  });
}
