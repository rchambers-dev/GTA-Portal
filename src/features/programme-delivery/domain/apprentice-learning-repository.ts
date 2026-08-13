import type { SupabaseClient } from "@supabase/supabase-js";
import { listProgrammeSessionsForVersion } from "@/features/programme-definition/domain/programme-sessions-repository";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { listCourseTasksForVersion } from "./gta-course-tasks-repository";
import { listSessionDeliveryRecords } from "./session-delivery-repository";
import { listEnrolmentBlockUnlocks } from "./block-unlock-overrides-repository";
import {
  assertNoTutorOnlyLeak,
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
} from "./learner-session-materials";
import { assignSessionLaneStatuses } from "./session-lane";
import {
  includesTutorLessonPlan,
  toLearnerSessionView,
} from "./learner-session-view";
import { isDeliveryBlockUnlocked } from "./delivery-unlock";
import type { DeliveryBlockView } from "./published-delivery-catalogue";
import { learnerFacingBlockTitle } from "@/features/programme-definition/domain/learner-facing-content";
import {
  CONTROLLED_TASK_AVAILABILITY_LABEL,
  isRetiredCeaGroupTaskKey,
  type ApprenticeLearningBlock,
  type ApprenticeLearningJourney,
  type ApprenticeLearningTaskRow,
} from "./apprentice-learning";

function metaNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const v = metadata?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export async function loadApprenticeLearningJourney(
  supabase: SupabaseClient,
  apprenticeId: string,
): Promise<ApprenticeLearningJourney> {
  const id = apprenticeId.trim();
  if (!id) throw new Error("apprenticeId is required.");

  const { data: apprentice, error: apErr } = await supabase
    .from("apprentices")
    .select("id, display_name, apprentice_reference, pack, notes")
    .eq("id", id)
    .maybeSingle();
  if (apErr) throw new Error(apErr.message);
  if (!apprentice) throw new Error("Apprentice record not found.");

  const { data: enrolment, error: enrErr } = await supabase
    .from("apprentice_programmes")
    .select(
      "id, gta_programme_version_id, programme_week, programme_name",
    )
    .eq("apprentice_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (enrErr) throw new Error(enrErr.message);
  if (!enrolment?.gta_programme_version_id) {
    throw new Error(
      "No GTA programme version is pinned to this enrolment.",
    );
  }

  const programmeVersionId = enrolment.gta_programme_version_id as string;
  const programmeWeek = Number(enrolment.programme_week) || 1;
  const enrolmentId = enrolment.id as string;

  const { data: version } = await supabase
    .from("gta_programme_versions")
    .select("id, programme_id")
    .eq("id", programmeVersionId)
    .maybeSingle();
  const { data: programme } = version?.programme_id
    ? await supabase
        .from("gta_programmes")
        .select("title")
        .eq("id", version.programme_id)
        .maybeSingle()
    : { data: null };

  const { data: spine, error: spineErr } = await supabase
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", programmeVersionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (spineErr) throw new Error(spineErr.message);

  const { data: spineRows, error: itemsErr } = spine?.id
    ? await supabase
        .from("gta_spine_items")
        .select("id, title, sequence, item_type, planned_otj_hours, metadata")
        .eq("spine_id", spine.id)
        .eq("item_type", "block")
        .order("sequence", { ascending: true })
    : { data: [], error: null };
  if (itemsErr) throw new Error(itemsErr.message);

  const blocks: DeliveryBlockView[] = (spineRows ?? []).map((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    const displayOrdinal =
      metaNumber(metadata, "blockNumber") ?? Math.max(1, Number(row.sequence) || 1);
    return {
      spineItemId: row.id as string,
      title: (row.title as string) || `Block ${displayOrdinal}`,
      sequence: Number(row.sequence) || 0,
      displayOrdinal,
      plannedOtjHours: Number(row.planned_otj_hours) || 0,
      weekStart: metaNumber(metadata, "weekStart"),
      weekEnd: metaNumber(metadata, "weekEnd"),
    };
  });

  const [sessions, resources, attachments, deliveries, unlocks, courseTasks] =
    await Promise.all([
      listProgrammeSessionsForVersion(supabase, programmeVersionId),
      listProgrammeResourcesForVersion(supabase, programmeVersionId),
      listResourceAttachmentsForVersion(supabase, programmeVersionId),
      listSessionDeliveryRecords(supabase, {
        programmeVersionId,
        apprenticeProgrammeId: enrolmentId,
        apprenticeId: id,
      }),
      listEnrolmentBlockUnlocks(supabase, enrolmentId),
      listCourseTasksForVersion(supabase, programmeVersionId),
    ]);

  const deliveredIds = new Set(deliveries.map((d) => d.sessionId));
  const deliveryBySession = new Map(deliveries.map((d) => [d.sessionId, d]));
  const unlockedIds = unlocks.map((u) => u.spineItemId);

  const orderedSessions = sessions.slice().sort(
    (a, b) =>
      a.calendarWeek - b.calendarWeek ||
      a.sessionIndexInWeek - b.sessionIndexInWeek ||
      a.sequence - b.sequence,
  );
  const laneBySessionId = new Map(
    assignSessionLaneStatuses(orderedSessions, deliveredIds).map((row) => [
      row.session.id,
      row.status,
    ]),
  );

  const journeyBlocks: ApprenticeLearningBlock[] = blocks.map((block) => {
    const blockSessions = orderedSessions.filter(
      (s) => s.spineItemId === block.spineItemId,
    );
    const sessionViews = blockSessions.map((session) => {
      const sessionAtt = attachments.filter((a) => a.sessionId === session.id);
      const learnerAtt = filterLearnerVisibleAttachments(sessionAtt);
      const leak = assertNoTutorOnlyLeak(learnerAtt);
      if (!leak.ok) {
        throw new Error("Tutor-only materials leaked into learner attachments.");
      }
      const learnerResources = learnerVisibleResourcesForSession({
        attachments,
        resources,
        sessionId: session.id,
      });
      const resourceRolesById = new Map(
        learnerAtt.map((a) => [a.resourceId, a.role]),
      );
      return toLearnerSessionView({
        session,
        status: laneBySessionId.get(session.id) ?? "upcoming",
        delivery: deliveryBySession.get(session.id) ?? null,
        learnerResources,
        resourceRolesById,
      });
    });

    const tasks: ApprenticeLearningTaskRow[] = courseTasks
      .filter(
        (t) =>
          t.spineItemId === block.spineItemId &&
          !isRetiredCeaGroupTaskKey(t.taskKey),
      )
      .slice()
      .sort((a, b) => a.taskNumber - b.taskNumber)
      .map((t) => ({
        id: t.id,
        taskKey: t.taskKey,
        spineItemId: t.spineItemId,
        blockOrdinal: t.blockOrdinal,
        taskNumber: t.taskNumber,
        kind: t.kind,
        title: t.title,
        availabilityLabel: CONTROLLED_TASK_AVAILABILITY_LABEL,
        openable: false,
      }));

    return {
      spineItemId: block.spineItemId,
      title: block.title,
      displayTitle: learnerFacingBlockTitle(block.displayOrdinal, block.title),
      displayOrdinal: block.displayOrdinal,
      weekStart: block.weekStart,
      weekEnd: block.weekEnd,
      plannedOtjHours: block.plannedOtjHours,
      unlocked: isDeliveryBlockUnlocked({
        block,
        blocks,
        programmeWeek,
        manuallyUnlockedBlockIds: unlockedIds,
      }),
      sessions: sessionViews,
      tasks,
    };
  });

  const w001 = journeyBlocks
    .flatMap((b) => b.sessions)
    .find((s) => s.sessionKey === "W001");
  const w001Session = sessions.find((s) => s.sessionKey === "W001");
  const w001TutorOnly = w001Session
    ? attachments.filter(
        (a) => a.sessionId === w001Session.id && a.audience === "TUTOR_ONLY",
      ).length
    : 0;

  const displayName = apprentice.display_name || "";
  const apprenticeReference = apprentice.apprentice_reference || "";

  return {
    apprenticeId: id,
    displayName,
    apprenticeReference,
    isTest:
      String(apprenticeReference).startsWith("TEST-") ||
      /TEST|DEMO/i.test(displayName),
    enrolmentId,
    programmeVersionId,
    programmeTitle:
      (programme?.title as string) ||
      (enrolment.programme_name as string) ||
      "Programme",
    programmeWeek,
    blocks: journeyBlocks,
    visibilityProof: w001
      ? {
          sessionKey: "W001",
          resourceTitles: w001.materials.map((m) => m.title),
          includesTutorLessonPlan: includesTutorLessonPlan(w001.materials),
          tutorOnlyCount: w001TutorOnly,
        }
      : null,
  };
}
