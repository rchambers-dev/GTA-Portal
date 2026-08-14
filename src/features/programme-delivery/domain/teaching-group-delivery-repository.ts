/**
 * Teaching-group roster + group Session delivery bundle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveSession } from "@/lib/portal/types";
import { listProgrammeSessionsForVersion } from "@/features/programme-definition/domain/programme-sessions-repository";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { approvedLearnerCopy } from "@/features/programme-definition/domain/learner-facing-content";
import { listResourceBinariesForVersion } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import {
  currentPreviewResourceIds,
  listResourcePreviewsForVersion,
} from "@/features/programme-definition/domain/programme-resource-previews-repository";
import { resourceExtractAvailable } from "@/features/programme-definition/domain/programme-resource-binaries";
import { describeResourceOpen } from "@/features/programme-definition/domain/programme-resource-previews";
import {
  classifyLearnerMaterialKind,
  labelResourceRole,
} from "@/features/programme-definition/domain/programme-resources";
import {
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
  tutorDeliveryResourcesForSession,
} from "./learner-session-materials";
import { nextUnreleasedSession } from "./session-lane";
import { listSessionLearningReleases } from "./session-learning-release-repository";
import {
  classifyTutorResource,
  eligibleReleaseRoster,
  tutorOwnsTeachingGroup,
  type TeachingGroupRecord,
  type TeachingGroupRosterMember,
} from "./teaching-group-delivery";
import { deliveryWeekRange } from "./staff-delivery-access";
import type { SessionLearningRelease } from "./session-learning-release";

type TeachingGroupRow = {
  id: string;
  cohort_id: string;
  name: string;
  tutor_name: string;
  college_days: string;
  notes: string;
};

function mapGroup(row: TeachingGroupRow): TeachingGroupRecord {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    name: row.name || "Teaching group",
    tutorName: row.tutor_name || "",
    collegeDays: row.college_days || "",
    notes: row.notes || "",
  };
}

export async function getTeachingGroup(
  supabase: SupabaseClient,
  teachingGroupId: string,
): Promise<TeachingGroupRecord | null> {
  const id = teachingGroupId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("cohort_teaching_groups")
    .select("id, cohort_id, name, tutor_name, college_days, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapGroup(data as TeachingGroupRow) : null;
}

export async function listTeachingGroupsForSession(
  supabase: SupabaseClient,
  session: EffectiveSession,
): Promise<TeachingGroupRecord[]> {
  const { data, error } = await supabase
    .from("cohort_teaching_groups")
    .select("id, cohort_id, name, tutor_name, college_days, notes")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TeachingGroupRow[])
    .map(mapGroup)
    .filter((group) => tutorOwnsTeachingGroup({ session, group }));
}

export async function listTeachingGroupRoster(
  supabase: SupabaseClient,
  teachingGroupId: string,
): Promise<TeachingGroupRosterMember[]> {
  const { data: enrolments, error } = await supabase
    .from("apprentice_programmes")
    .select(
      "id, apprentice_id, status, gta_programme_version_id, programme_week",
    )
    .eq("teaching_group_id", teachingGroupId);
  if (error) throw new Error(error.message);
  const rows = enrolments ?? [];
  if (rows.length === 0) return [];

  const apprenticeIds = [
    ...new Set(rows.map((row) => row.apprentice_id as string)),
  ];
  const { data: apprentices, error: apErr } = await supabase
    .from("apprentices")
    .select("id, display_name, apprentice_reference")
    .in("id", apprenticeIds);
  if (apErr) throw new Error(apErr.message);
  const byId = new Map(
    (apprentices ?? []).map((row) => [row.id as string, row]),
  );

  return rows.map((row) => {
    const apprentice = byId.get(row.apprentice_id as string);
    return {
      apprenticeProgrammeId: row.id as string,
      apprenticeId: row.apprentice_id as string,
      displayName: (apprentice?.display_name as string) || "Apprentice",
      apprenticeReference: (apprentice?.apprentice_reference as string) || "",
      status: (row.status as string) || "active",
      programmeVersionId: (row.gta_programme_version_id as string) || null,
      programmeWeek: Number(row.programme_week) || 1,
    };
  });
}

export function assertTutorCanDeliverGroup(input: {
  session: EffectiveSession;
  group: TeachingGroupRecord;
}): void {
  if (!tutorOwnsTeachingGroup(input)) {
    throw new Error("You are not authorised to deliver this teaching group.");
  }
}

export type GroupSessionAccessSummary = {
  releasedCount: number;
  eligibleCount: number;
  latestRelease: SessionLearningRelease | null;
};

export async function loadTeachingGroupBlockBundle(
  supabase: SupabaseClient,
  input: {
    teachingGroupId: string;
    blockNumber: number;
    staffSession: EffectiveSession;
  },
) {
  const weeks = deliveryWeekRange(input.blockNumber);
  if (!weeks) {
    throw new Error(
      "Only Block 1 and Block 2 delivery are available in this pilot.",
    );
  }

  const group = await getTeachingGroup(supabase, input.teachingGroupId);
  if (!group) throw new Error("Teaching group was not found.");
  assertTutorCanDeliverGroup({
    session: input.staffSession,
    group,
  });

  const roster = eligibleReleaseRoster(
    await listTeachingGroupRoster(supabase, group.id),
  );
  const programmeVersionId =
    roster.find((row) => row.programmeVersionId)?.programmeVersionId || "";
  if (!programmeVersionId) {
    return {
      group,
      roster,
      programmeVersionId: "",
      blockNumber: input.blockNumber,
      block: {
        title: input.blockNumber === 2 ? "Block 2" : "Block 1",
        weekStart: weeks.weekStart,
        weekEnd: weeks.weekEnd,
        plannedOtjHours: 45,
      },
      sessions: [],
      nextToTeach: null,
    };
  }

  const versionRoster = roster.filter(
    (row) => row.programmeVersionId === programmeVersionId,
  );

  const allSessions = await listProgrammeSessionsForVersion(
    supabase,
    programmeVersionId,
  );
  const blockSessions = allSessions.filter(
    (session) =>
      session.calendarWeek >= weeks.weekStart &&
      session.calendarWeek <= weeks.weekEnd,
  );
  const spineItemId = blockSessions[0]?.spineItemId || null;

  const [resources, attachments, releases, binaries, previews] = await Promise.all([
    listProgrammeResourcesForVersion(supabase, programmeVersionId),
    listResourceAttachmentsForVersion(supabase, programmeVersionId, {
      spineItemId: spineItemId || undefined,
    }),
    listSessionLearningReleases(supabase, { programmeVersionId }),
    listResourceBinariesForVersion(supabase, programmeVersionId),
    listResourcePreviewsForVersion(supabase, programmeVersionId),
  ]);
  const binaryResourceIds = new Set(binaries.map((b) => b.resourceId));
  const previewResourceIds = currentPreviewResourceIds(
    previews,
    new Map(binaries.map((b) => [b.resourceId, b.sha256])),
  );

  const enrolmentIds = new Set(
    versionRoster.map((row) => row.apprenticeProgrammeId),
  );
  const currentMemberReleases = releases.filter((row) =>
    enrolmentIds.has(row.apprenticeProgrammeId),
  );

  const nextToTeach = nextUnreleasedSession(
    blockSessions.map((session) => {
      const releasedFor = currentMemberReleases.filter(
        (row) => row.sessionId === session.id,
      );
      const allReleased =
        versionRoster.length > 0 &&
        versionRoster.every((member) =>
          releasedFor.some(
            (row) => row.apprenticeProgrammeId === member.apprenticeProgrammeId,
          ),
        );
      return {
        session,
        status: allReleased ? ("available" as const) : ("coming_up" as const),
      };
    }),
  );

  const sessions = blockSessions.map((session) => {
    const sessionReleases = currentMemberReleases.filter(
      (row) => row.sessionId === session.id,
    );
    const releasedEnrolmentIds = new Set(
      sessionReleases.map((row) => row.apprenticeProgrammeId),
    );
    const releasedCount = versionRoster.filter((member) =>
      releasedEnrolmentIds.has(member.apprenticeProgrammeId),
    ).length;
    const latestRelease =
      sessionReleases.slice().sort((a, b) =>
        a.releasedAt.localeCompare(b.releasedAt),
      )[sessionReleases.length - 1] ?? null;

    const sessionAtt = attachments.filter((a) => a.sessionId === session.id);
    const tutorMaterials = sessionAtt.filter(
      (a) => a.audience === "TUTOR_ONLY" || a.role === "TUTOR_DELIVERY",
    );
    const learnerMaterials = filterLearnerVisibleAttachments(sessionAtt);
    const tutorDeliveryResources = tutorDeliveryResourcesForSession({
      attachments,
      resources,
      sessionId: session.id,
    });
    const learnerVisibleResources = learnerVisibleResourcesForSession({
      attachments,
      resources,
      sessionId: session.id,
    });
    const approved = approvedLearnerCopy(session.learnerFacingContent);

    const tutorByKind = {
      lessonPlans: [] as Array<
        ReturnType<typeof describeResourceOpen> & {
          id: string;
          title: string;
          filename: string;
        }
      >,
      powerpoints: [] as Array<
        ReturnType<typeof describeResourceOpen> & {
          id: string;
          title: string;
          filename: string;
        }
      >,
      other: [] as Array<
        ReturnType<typeof describeResourceOpen> & {
          id: string;
          title: string;
          filename: string;
        }
      >,
    };
    for (const resource of tutorDeliveryResources) {
      const attachment = tutorMaterials.find(
        (a) => a.resourceId === resource.id,
      );
      const kind = classifyTutorResource({
        title: resource.title,
        filename: resource.filename,
        role: attachment?.role || "TUTOR_DELIVERY",
      });
      const open = describeResourceOpen({
        filename: resource.filename,
        binaryAvailable: binaryResourceIds.has(resource.id),
        previewAvailable: previewResourceIds.has(resource.id),
        extractAvailable: resourceExtractAvailable(resource),
      });
      const item = {
        id: resource.id,
        title: resource.title,
        filename: resource.filename,
        ...open,
      };
      if (kind === "lesson_plan") tutorByKind.lessonPlans.push(item);
      else if (kind === "powerpoint") tutorByKind.powerpoints.push(item);
      else tutorByKind.other.push(item);
    }

    const allReleased =
      versionRoster.length > 0 && releasedCount === versionRoster.length;
    const learningStatus = allReleased ? "available" : "coming_up";

    return {
      session,
      learningStatus,
      learningStatusLabel: allReleased ? "Released" : "Not released",
      isNextToTeach: nextToTeach?.id === session.id,
      access: {
        releasedCount,
        eligibleCount: versionRoster.length,
        latestRelease,
        releasedEnrolmentIds: [...releasedEnrolmentIds],
      } satisfies GroupSessionAccessSummary & {
        releasedEnrolmentIds: string[];
      },
      tutorMaterials: tutorByKind,
      learnerVisibleResources: learnerVisibleResources.map((r) => {
        const attachment = learnerMaterials.find(
          (a) => a.resourceId === r.id,
        );
        const kind = classifyLearnerMaterialKind({
          filename: r.filename,
          title: r.title,
          role: attachment?.role,
        });
        const open = describeResourceOpen({
          filename: r.filename,
          binaryAvailable: binaryResourceIds.has(r.id),
          previewAvailable: previewResourceIds.has(r.id),
          extractAvailable: resourceExtractAvailable(r),
        });
        return {
          id: r.id,
          title: r.title,
          filename: r.filename,
          kindLabel: kind.kindLabel,
          openLabel: open.openLabel,
          roleLabel: labelResourceRole(attachment?.role || "LEARNER_LEARNING"),
          binaryAvailable: open.binaryAvailable,
          extractAvailable: open.extractAvailable,
          previewAvailable: open.previewAvailable,
          extractLabel: open.extractLabel,
          downloadLabel: open.downloadLabel,
          unavailableNote: open.unavailableNote,
          previewUnavailableNote: open.previewUnavailableNote,
          viewerKind: open.viewerKind,
          openMode: open.openMode,
        };
      }),
      approvedLearnerContent: approved
        ? {
            summary: approved.summary,
            learningContent: approved.learningContent,
            activityPractice: approved.activityPractice,
          }
        : null,
      hasApprovedLearnerPackage: Boolean(
        approved?.learningContent ||
          approved?.activityPractice ||
          learnerMaterials.length > 0,
      ),
    };
  });

  return {
    group,
    roster: versionRoster,
    programmeVersionId,
    blockNumber: input.blockNumber,
    block: {
      title:
        input.blockNumber === 2
          ? "Block 2"
          : "Motor Vehicle Foundation Skills - Shared Controlled Programme",
      weekStart: weeks.weekStart,
      weekEnd: weeks.weekEnd,
      plannedOtjHours: 45,
    },
    sessions,
    nextToTeach: nextToTeach
      ? {
          id: nextToTeach.id,
          sessionKey: nextToTeach.sessionKey,
          title: nextToTeach.title,
          calendarWeek: nextToTeach.calendarWeek,
        }
      : null,
  };
}
