import type { SupabaseClient } from "@supabase/supabase-js";
import { hasHeldReviewMaterials } from "./learner-session-materials";
import {
  eligibleReleaseRoster,
  planSessionLearningRelease,
} from "./teaching-group-delivery";
import {
  assertTutorCanDeliverGroup,
  getTeachingGroup,
  listTeachingGroupRoster,
} from "./teaching-group-delivery-repository";
import {
  insertSessionReviewReleases,
  listSessionReviewReleases,
} from "./session-review-release-repository";
import type { SessionReviewReleaseSource } from "./session-review-release";
import { listResourceAttachmentsForVersion } from "@/features/programme-definition/domain/programme-resources-repository";

export class SessionReviewReleaseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function releaseSessionReviewMaterials(
  supabase: SupabaseClient,
  input: {
    staffSession: import("@/lib/portal/types").EffectiveSession;
    teachingGroupId: string;
    sessionId: string;
    selectedEnrolmentIds: string[];
    source: SessionReviewReleaseSource;
    note?: string;
  },
) {
  const group = await getTeachingGroup(supabase, input.teachingGroupId);
  if (!group) {
    throw new SessionReviewReleaseError("Teaching group was not found.", 404);
  }
  try {
    assertTutorCanDeliverGroup({
      session: input.staffSession,
      group,
    });
  } catch (err) {
    throw new SessionReviewReleaseError(
      err instanceof Error
        ? err.message
        : "You are not authorised to deliver this teaching group.",
      403,
    );
  }

  const selected = [
    ...new Set(input.selectedEnrolmentIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (selected.length === 0) {
    throw new SessionReviewReleaseError(
      "Select at least one apprentice in this teaching group.",
      400,
    );
  }

  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    throw new SessionReviewReleaseError("sessionId is required.", 400);
  }

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("gta_programme_sessions")
    .select("id, programme_version_id, spine_item_id, session_key, title")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) throw new Error(sessionErr.message);
  if (!sessionRow) {
    throw new SessionReviewReleaseError("Session was not found.", 404);
  }

  const programmeVersionId = sessionRow.programme_version_id as string;
  const attachments = await listResourceAttachmentsForVersion(
    supabase,
    programmeVersionId,
    { sessionId },
  );
  if (!hasHeldReviewMaterials(attachments)) {
    throw new SessionReviewReleaseError(
      "This Session has no held review materials to release.",
      422,
    );
  }

  const roster = eligibleReleaseRoster(
    await listTeachingGroupRoster(supabase, group.id),
  ).filter((member) => member.programmeVersionId === programmeVersionId);

  const existing = await listSessionReviewReleases(supabase, {
    programmeVersionId,
    sessionId,
  });
  const alreadyReleasedEnrolmentIds = new Set(
    existing
      .filter((row) =>
        roster.some(
          (member) => member.apprenticeProgrammeId === row.apprenticeProgrammeId,
        ),
      )
      .map((row) => row.apprenticeProgrammeId),
  );

  const plan = planSessionLearningRelease({
    roster,
    alreadyReleasedEnrolmentIds,
    selectedEnrolmentIds: new Set(selected),
  });

  if (plan.ignoredUnknownIds.length > 0) {
    throw new SessionReviewReleaseError(
      "One or more selected apprentices are not in this teaching group. Future joiners do not inherit earlier releases.",
      400,
    );
  }

  if (
    input.source === "individual" &&
    plan.willReceiveAccess.length + plan.alreadyHaveAccess.filter((m) =>
      selected.includes(m.apprenticeProgrammeId),
    ).length !==
      1
  ) {
    throw new SessionReviewReleaseError(
      "Individual review release must target one apprentice in this teaching group.",
      400,
    );
  }

  const insertResult = await insertSessionReviewReleases(
    supabase,
    plan.willReceiveAccess.map((member) => ({
      programmeVersionId,
      sessionId,
      apprenticeId: member.apprenticeId,
      apprenticeProgrammeId: member.apprenticeProgrammeId,
      spineItemId: (sessionRow.spine_item_id as string) || null,
      teachingGroupId: group.id,
      source: input.source,
      releasedBy: input.staffSession.account.id || null,
      releasedByName: input.staffSession.account.name || "Tutor",
      note: input.note,
      metadata: {
        sessionKey: sessionRow.session_key,
        teachingGroupName: group.name,
      },
    })),
  );

  const after = await listSessionReviewReleases(supabase, {
    programmeVersionId,
    sessionId,
  });
  const grantedNowIds = new Set(
    plan.willReceiveAccess.map((member) => member.apprenticeProgrammeId),
  );
  const created =
    insertResult.created.length > 0
      ? insertResult.created
      : after.filter((row) => grantedNowIds.has(row.apprenticeProgrammeId));
  const releasedCount = after.filter((row) =>
    roster.some(
      (member) => member.apprenticeProgrammeId === row.apprenticeProgrammeId,
    ),
  ).length;
  const latest =
    created[created.length - 1] ||
    after
      .filter((row) =>
        roster.some(
          (member) => member.apprenticeProgrammeId === row.apprenticeProgrammeId,
        ),
      )
      .slice(-1)[0] ||
    null;

  return {
    group,
    session: {
      id: sessionRow.id as string,
      sessionKey: sessionRow.session_key as string,
      title: sessionRow.title as string,
      programmeVersionId,
    },
    plan: {
      alreadyHaveAccess: plan.alreadyHaveAccess.length,
      grantedNow: plan.willReceiveAccess.length,
      skippedDeselected: plan.skippedDeselected.length,
      eligibleCount: roster.length,
      releasedCount,
    },
    created,
    latestRelease: latest,
    notes: {
      attendance:
        "This grant does not record attendance, completion, Task results, competence, or OTJ.",
      futureJoiners:
        "Apprentices who join this teaching group later do not inherit this release.",
    },
  };
}
