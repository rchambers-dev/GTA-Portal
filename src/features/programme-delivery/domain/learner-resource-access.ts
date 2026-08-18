/**
 * Server-side apprentice access to Session learning resources.
 * Audience + Session release + Block window are the authority.
 * File extension is not.
 */

import {
  isSafeDemoTaggedResource,
  isSecurityTestFixtureResource,
  LEARNER_SESSION_LOCKED_ERROR,
} from "@/features/programme-definition/domain/learner-facing-content";
import type { ProgrammeResourceAttachmentRecord } from "@/features/programme-definition/domain/programme-resources";
import {
  resolveApprenticeSessionAccess,
  type ApprenticeLearningBlock,
} from "./apprentice-learning";
import { includesTutorLessonPlan } from "./learner-session-view";

export const LEARNER_TUTOR_ONLY_RESOURCE_ERROR =
  "This resource is not available to learners.";

export type ApprenticeResourceAccess =
  | { ok: true; sessionId: string }
  | { ok: false; status: 403 | 404; error: string };

export function decideApprenticeResourceAccess(input: {
  resourceId: string;
  resource: { id: string; title: string; filename: string } | null;
  attachments: ProgrammeResourceAttachmentRecord[];
  blocks: ApprenticeLearningBlock[];
  isTest: boolean;
  reviewReleasedSessionIds?: ReadonlySet<string>;
}): ApprenticeResourceAccess {
  const resourceId = input.resourceId.trim();
  if (!resourceId || !input.resource) {
    return { ok: false, status: 404, error: "Resource not found." };
  }
  if (isSecurityTestFixtureResource(input.resource)) {
    return {
      ok: false,
      status: 404,
      error: "Resource not found on your learning journey.",
    };
  }
  if (isSafeDemoTaggedResource(input.resource) && !input.isTest) {
    return {
      ok: false,
      status: 404,
      error: "Resource not found on your learning journey.",
    };
  }

  const forResource = input.attachments.filter(
    (a) => a.resourceId === resourceId,
  );
  const learnerAtts = forResource.filter(
    (a) => a.audience === "LEARNER_VISIBLE" && Boolean(a.sessionId),
  );
  const tutorOnlyAtts = forResource.filter((a) => a.audience === "TUTOR_ONLY");

  if (learnerAtts.length === 0) {
    if (tutorOnlyAtts.length > 0) {
      return {
        ok: false,
        status: 403,
        error: LEARNER_TUTOR_ONLY_RESOURCE_ERROR,
      };
    }
    return {
      ok: false,
      status: 404,
      error: "Resource not found on your learning journey.",
    };
  }

  if (includesTutorLessonPlan([input.resource])) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  let sawLocked = false;
  for (const att of learnerAtts) {
    const sessionId = att.sessionId?.trim();
    if (!sessionId) continue;
    const access = resolveApprenticeSessionAccess(input.blocks, sessionId);
    if (access.status === "open") {
      if (
        att.learnerReleaseTiming === "REVIEW_LATER" &&
        !input.reviewReleasedSessionIds?.has(sessionId)
      ) {
        continue;
      }
      return { ok: true, sessionId };
    }
    if (access.status === "locked") {
      sawLocked = true;
    }
  }

  if (sawLocked) {
    return {
      ok: false,
      status: 403,
      error: LEARNER_SESSION_LOCKED_ERROR,
    };
  }
  return {
    ok: false,
    status: 404,
    error: "Resource not found on your learning journey.",
  };
}
