import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  createBlankCeaState,
  getGroupsPackById,
  type CeaApprenticeState,
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
  status: "ready_to_assess" | "returned";
  apprenticeNotes: string;
  readyAt: string | null;
  returnNote: string | null;
};

function requireStaff(session: EffectiveSession | null) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.account.workspace === "apprentice") {
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
  return {
    apprenticeId: row.apprentice_id,
    packId: row.pack_id,
    mandatoryByGroup: row.mandatory_by_group ?? {},
    progress: row.progress ?? {},
    milestoneReflections: row.milestone_reflections ?? {},
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

export async function GET() {
  const session = requireStaff(
    await getStandalonePorts().auth.getEffectiveSession(),
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

  const apprenticeIds = [
    ...new Set((rows ?? []).map((r) => (r as DbRow).apprentice_id)),
  ];
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

  for (const raw of rows ?? []) {
    const row = raw as DbRow;
    const pack = getGroupsPackById(row.pack_id);
    if (!pack) continue;
    const prog = programmeById.get(row.apprentice_id);
    const apprenticeName =
      nameById.get(row.apprentice_id) ?? "Unknown apprentice";

    for (const [taskId, progress] of Object.entries(row.progress ?? {})) {
      if (
        progress.status !== "ready_to_assess" &&
        progress.status !== "returned"
      ) {
        continue;
      }
      // Teacher queue = mandatory CEA tasks only (employer handles additional).
      if (progress.kind === "additional") continue;

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
        status: progress.status,
        apprenticeNotes: progress.apprenticeNotes ?? "",
        readyAt: progress.readyAt,
        returnNote: progress.returnNote,
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
  const session = requireStaff(
    await getStandalonePorts().auth.getEffectiveSession(),
  );
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as {
    apprenticeId?: string;
    packId?: string;
    taskId?: string;
    action?: "sign_off" | "return";
    returnNote?: string;
  } | null;

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
  if (action !== "sign_off" && action !== "return") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
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

  const prev = existing.progress[taskId];
  if (!prev) {
    return NextResponse.json(
      { error: "Task progress not found for this apprentice." },
      { status: 404 },
    );
  }
  if (prev.kind === "additional") {
    return NextResponse.json(
      { error: "Additional workplace tasks are signed off by the employer." },
      { status: 400 },
    );
  }

  const actorName = session.account.name || "Tutor";
  const now = new Date().toISOString();
  let nextProgress: CeaTaskProgress;

  if (action === "sign_off") {
    nextProgress = {
      ...prev,
      status: "signed_off",
      signedOffByRole: "teacher",
      signedOffByName: actorName,
      signedOffAt: now,
      returnNote: null,
    };
  } else {
    nextProgress = {
      ...prev,
      status: "returned",
      signedOffByRole: null,
      signedOffByName: null,
      signedOffAt: null,
      returnNote:
        body?.returnNote?.trim() ||
        "Returned — please update and mark ready again.",
      readyAt: null,
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
