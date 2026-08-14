import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { listProgrammeSessionsForVersion } from "@/features/programme-definition/domain/programme-sessions-repository";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { listSessionDeliveryRecords } from "@/features/programme-delivery/domain/session-delivery-repository";
import {
  assertNoTutorOnlyLeak,
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
  tutorDeliveryResourcesForSession,
} from "@/features/programme-delivery/domain/learner-session-materials";
import { isSecurityTestFixtureResource } from "@/features/programme-definition/domain/learner-facing-content";
import {
  assignSessionLaneStatuses,
  labelSessionLaneStatus,
  nextSessionAfterCurrent,
} from "@/features/programme-delivery/domain/session-lane";
import {
  deliveryWeekRange,
  requireTutorDeliveryAccess,
} from "@/features/programme-delivery/domain/staff-delivery-access";

export const runtime = "nodejs";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";

/**
 * Block 1 tutor/learner delivery bundle for a pinned enrolment.
 * GET ?apprenticeProgrammeId=  (or programmeVersionId + apprenticeId)
 */
export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const blockNumber = Number(url.searchParams.get("block") || "1");
    const weeks = deliveryWeekRange(blockNumber);
    if (!weeks) {
      return NextResponse.json(
        { ok: false, error: "Only Block 1 and Block 2 delivery are available in this pilot." },
        { status: 400 },
      );
    }
    const apprenticeProgrammeId =
      url.searchParams.get("apprenticeProgrammeId")?.trim() || "";
    const audience =
      url.searchParams.get("audience")?.trim() === "learner"
        ? "learner"
        : "tutor";

    const supabase = createSupabaseAdminClient();

    let enrolmentId = apprenticeProgrammeId;
    let programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    let apprenticeId = url.searchParams.get("apprenticeId")?.trim() || "";
    let programmeWeek = 1;
    let displayName = "";
    let apprenticeReference = "";

    if (enrolmentId) {
      const { data: enr, error } = await supabase
        .from("apprentice_programmes")
        .select(
          "id, apprentice_id, gta_programme_version_id, programme_week, programme_name",
        )
        .eq("id", enrolmentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!enr) {
        return NextResponse.json(
          { ok: false, error: "Enrolment not found." },
          { status: 404 },
        );
      }
      apprenticeId = enr.apprentice_id;
      programmeVersionId = enr.gta_programme_version_id || programmeVersionId;
      programmeWeek = Number(enr.programme_week) || 1;
    }

    if (!programmeVersionId || !apprenticeId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "apprenticeProgrammeId (preferred) or programmeVersionId+apprenticeId required.",
        },
        { status: 400 },
      );
    }

    const { data: apprentice } = await supabase
      .from("apprentices")
      .select("id, display_name, apprentice_reference, pack, notes")
      .eq("id", apprenticeId)
      .maybeSingle();
    displayName = apprentice?.display_name || "";
    apprenticeReference = apprentice?.apprentice_reference || "";

    if (!enrolmentId) {
      const { data: enr } = await supabase
        .from("apprentice_programmes")
        .select("id, programme_week")
        .eq("apprentice_id", apprenticeId)
        .eq("gta_programme_version_id", programmeVersionId)
        .maybeSingle();
      enrolmentId = enr?.id || "";
      if (enr?.programme_week != null) {
        programmeWeek = Number(enr.programme_week) || 1;
      }
    }

    const { data: version } = await supabase
      .from("gta_programme_versions")
      .select("id, parameters")
      .eq("id", programmeVersionId)
      .maybeSingle();
    const params = (version?.parameters || {}) as Record<string, unknown>;

    const allSessions = await listProgrammeSessionsForVersion(
      supabase,
      programmeVersionId,
    );
    const blockSessions = allSessions.filter(
      (s) => s.calendarWeek >= weeks.weekStart && s.calendarWeek <= weeks.weekEnd,
    );
    const spineItemId = blockSessions[0]?.spineItemId || null;

    const [resources, attachments, deliveries] = await Promise.all([
      listProgrammeResourcesForVersion(supabase, programmeVersionId),
      listResourceAttachmentsForVersion(supabase, programmeVersionId, {
        spineItemId: spineItemId || undefined,
      }),
      listSessionDeliveryRecords(supabase, {
        programmeVersionId,
        apprenticeProgrammeId: enrolmentId || undefined,
        apprenticeId,
      }),
    ]);

    const deliveredBySession = new Map(
      deliveries.map((d) => [d.sessionId, d]),
    );
    const assigned = assignSessionLaneStatuses(
      blockSessions,
      new Set(deliveries.map((d) => d.sessionId)),
    );
    const nextSession = nextSessionAfterCurrent(assigned);

    const lane = assigned.map((row) => {
      const s = row.session;
      const delivery = deliveredBySession.get(s.id) || null;
      const learningStatus = row.status;

      const sessionAtt = attachments.filter((a) => a.sessionId === s.id);
      const tutorMaterials = sessionAtt.filter(
        (a) => a.audience === "TUTOR_ONLY" || a.role === "TUTOR_DELIVERY",
      );
      const learnerMaterials = filterLearnerVisibleAttachments(sessionAtt);
      const learnerLeakCheck = assertNoTutorOnlyLeak(learnerMaterials);
      const visibleResources = learnerVisibleResourcesForSession({
        attachments,
        resources,
        sessionId: s.id,
      });
      const learnerVisibleResources =
        audience === "learner"
          ? visibleResources.filter((r) => !isSecurityTestFixtureResource(r))
          : visibleResources;
      const tutorDeliveryResources =
        audience === "tutor"
          ? tutorDeliveryResourcesForSession({
              attachments,
              resources,
              sessionId: s.id,
            }).map((r) => ({
              id: r.id,
              title: r.title,
              filename: r.filename,
            }))
          : [];

      return {
        session: s,
        learningStatus,
        learningStatusLabel: labelSessionLaneStatus(learningStatus),
        delivery,
        tutorMaterialAttachments:
          audience === "tutor" ? tutorMaterials : [],
        tutorDeliveryResources,
        learnerMaterialAttachments: learnerMaterials,
        learnerVisibleResources,
        visibilityOk: learnerLeakCheck.ok,
      };
    });

    const proofKey = blockNumber === 2 ? "W011" : "W001";
    const proofRow = lane.find((l) => l.session.sessionKey === proofKey);
    const visibilityProof = proofRow
      ? {
          sessionKey: proofKey,
          resourceTitles: proofRow.learnerVisibleResources.map((r) => r.title),
          includesTutorLessonPlan: proofRow.learnerVisibleResources.some(
            (r) =>
              /lesson plan/i.test(r.title) ||
              /Lesson_Plan/i.test(r.filename),
          ),
          tutorOnlyCount: attachments.filter(
            (a) =>
              a.sessionId === proofRow.session.id && a.audience === "TUTOR_ONLY",
          ).length,
        }
      : null;

    return NextResponse.json({
      ok: true,
      controlTag: params.controlTag ?? null,
      expectedControlTag: CONTROL_TAG,
      apprentice: {
        id: apprenticeId,
        displayName,
        apprenticeReference,
        isTest:
          String(apprenticeReference).startsWith("TEST-") ||
          /TEST|DEMO/i.test(displayName),
      },
      enrolment: {
        id: enrolmentId,
        programmeVersionId,
        programmeWeek,
      },
      audience,
      blockNumber,
      block: {
        title:
          blockNumber === 2
            ? "Block 2"
            : "Motor Vehicle Foundation Skills - Shared Controlled Programme",
        weekStart: weeks.weekStart,
        weekEnd: weeks.weekEnd,
        plannedOtjHours: 45,
      },
      sessions: lane,
      nextSession: nextSession
        ? {
            id: nextSession.id,
            sessionKey: nextSession.sessionKey,
            title: nextSession.title,
            calendarWeek: nextSession.calendarWeek,
          }
        : null,
      deliveryRecords: deliveries,
      visibilityProof,
      notes: {
        s4:
          "Block unlock is calendar/sequence by default. Authorised per-enrolment override only. Task 5 / Session completion does not auto-unlock the next Block.",
        otj:
          "Session sign-off does not log OTJ, alter 611.5, attendance, or RPL.",
        correction:
          "Normal tutor UI cannot undo a delivered sign-off. Authorised amendment is a future requirement.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load Block 1 delivery.",
      },
      { status: 500 },
    );
  }
}
