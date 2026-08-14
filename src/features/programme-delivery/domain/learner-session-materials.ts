/**
 * Learner-facing Session materials must never include tutor-only attachments.
 */

import type {
  ProgrammeResourceAttachmentRecord,
  ProgrammeResourceRecord,
} from "@/features/programme-definition/domain/programme-resources";

export function filterLearnerVisibleAttachments(
  attachments: ProgrammeResourceAttachmentRecord[],
): ProgrammeResourceAttachmentRecord[] {
  return attachments.filter((a) => a.audience === "LEARNER_VISIBLE");
}

export function assertNoTutorOnlyLeak(
  attachments: ProgrammeResourceAttachmentRecord[],
): { ok: boolean; leaked: string[] } {
  const leaked = attachments
    .filter((a) => a.audience === "TUTOR_ONLY")
    .map((a) => a.id);
  return { ok: leaked.length === 0, leaked };
}

export function learnerVisibleResourcesForSession(input: {
  attachments: ProgrammeResourceAttachmentRecord[];
  resources: ProgrammeResourceRecord[];
  sessionId: string;
}): ProgrammeResourceRecord[] {
  const ids = new Set(
    filterLearnerVisibleAttachments(input.attachments)
      .filter((a) => a.sessionId === input.sessionId)
      .map((a) => a.resourceId),
  );
  return input.resources.filter((r) => ids.has(r.id));
}

/** Tutor-delivery materials for a Session — never mix into learner views. */
export function tutorDeliveryResourcesForSession(input: {
  attachments: ProgrammeResourceAttachmentRecord[];
  resources: ProgrammeResourceRecord[];
  sessionId: string;
}): ProgrammeResourceRecord[] {
  const ids = new Set(
    input.attachments
      .filter((a) => a.sessionId === input.sessionId)
      .filter(
        (a) => a.audience === "TUTOR_ONLY" || a.role === "TUTOR_DELIVERY",
      )
      .map((a) => a.resourceId),
  );
  return input.resources.filter((r) => ids.has(r.id));
}
