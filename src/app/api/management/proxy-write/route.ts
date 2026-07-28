import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  calculateProgressFraming,
  formatProgressVariance,
} from "@/features/learner-lifecycle/domain/progress-framing";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";

type LearnerRow = {
  id: string;
  display_name: string;
  learner_reference: string;
  email: string;
};

type ProgrammeRow = {
  id: string;
  learner_id: string | null;
  programme_name: string;
  start_date: string;
  original_planned_end_date: string;
  status: string;
  actual_progress_percent: number | null;
  notes: string | null;
  learners: LearnerRow | LearnerRow[] | null;
};

function firstJoined<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function requireProxyAccess() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.RECORDS_PROXY_WRITE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export async function GET() {
  const session = await requireProxyAccess();
  if (session instanceof NextResponse) return session;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("learner_programmes")
    .select(
      "id, learner_id, programme_name, start_date, original_planned_end_date, status, actual_progress_percent, notes, learners(id, display_name, learner_reference, email)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as ProgrammeRow[]).map((row) => {
    const learner = firstJoined(row.learners);
    const framing = calculateProgressFraming({
      startDate: row.start_date,
      originalPlannedEndDate: row.original_planned_end_date,
      actualProgressPercent: row.actual_progress_percent,
    });
    return {
      enrolmentId: row.id,
      learnerId: row.learner_id,
      displayName: learner?.display_name ?? "Unknown learner",
      learnerReference: learner?.learner_reference ?? "",
      email: learner?.email ?? "",
      programmeName: row.programme_name,
      startDate: row.start_date,
      originalPlannedEndDate: row.original_planned_end_date,
      status: row.status,
      actualProgressPercent: row.actual_progress_percent,
      notes: row.notes ?? "",
      plannedProgressPercent: framing.plannedProgressPercent,
      variancePercent: framing.variancePercent,
      varianceLabel: formatProgressVariance(framing.variancePercent),
    };
  });

  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const session = await requireProxyAccess();
  if (session instanceof NextResponse) return session;

  const body = (await request.json()) as {
    enrolmentId: string;
    actualProgressPercent: number | null;
    notes?: string;
    summary?: string;
  };

  if (!body.enrolmentId) {
    return NextResponse.json({ error: "enrolmentId is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {
    actual_progress_percent: body.actualProgressPercent,
  };
  if (body.notes != null) update.notes = body.notes.trim();

  const { data, error } = await supabase
    .from("learner_programmes")
    .update(update)
    .eq("id", body.enrolmentId)
    .select(
      "id, learner_id, programme_name, start_date, original_planned_end_date, status, actual_progress_percent, notes, learners(id, display_name, learner_reference, email)",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to update learner programme" },
      { status: 500 },
    );
  }

  const row = data as ProgrammeRow;
  await supabase.from("proxy_write_audit").insert({
    actor_profile_id: session.account.id,
    learner_id: row.learner_id,
    action: "learner_programme.proxy_progress_write",
    summary:
      body.summary?.trim() ||
      `Proxy-updated actual progress to ${body.actualProgressPercent ?? "null"}%`,
    payload: {
      enrolmentId: body.enrolmentId,
      actualProgressPercent: body.actualProgressPercent,
      notes: body.notes ?? null,
    },
  });

  const learner = firstJoined(row.learners);
  const framing = calculateProgressFraming({
    startDate: row.start_date,
    originalPlannedEndDate: row.original_planned_end_date,
    actualProgressPercent: row.actual_progress_percent,
  });

  return NextResponse.json({
    row: {
      enrolmentId: row.id,
      learnerId: row.learner_id,
      displayName: learner?.display_name ?? "Unknown learner",
      learnerReference: learner?.learner_reference ?? "",
      email: learner?.email ?? "",
      programmeName: row.programme_name,
      startDate: row.start_date,
      originalPlannedEndDate: row.original_planned_end_date,
      status: row.status,
      actualProgressPercent: row.actual_progress_percent,
      notes: row.notes ?? "",
      plannedProgressPercent: framing.plannedProgressPercent,
      variancePercent: framing.variancePercent,
      varianceLabel: formatProgressVariance(framing.variancePercent),
    },
  });
}
