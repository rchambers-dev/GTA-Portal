/**
 * Session learning release — tutor grant that approved learner-facing
 * Session learning is available to an enrolment.
 *
 * Not attendance, Session completion, Task pass, competence, or OTJ.
 */

export const SESSION_LEARNING_RELEASE_SOURCES = [
  "teaching_group",
  "individual",
  "migrated_from_delivery",
] as const;

export type SessionLearningReleaseSource =
  (typeof SESSION_LEARNING_RELEASE_SOURCES)[number];

export type SessionLearningRelease = {
  id: string;
  programmeVersionId: string;
  sessionId: string;
  apprenticeId: string;
  apprenticeProgrammeId: string;
  spineItemId: string | null;
  teachingGroupId: string | null;
  source: SessionLearningReleaseSource;
  releasedAt: string;
  releasedBy: string | null;
  releasedByName: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function isSessionLearningReleaseSource(
  value: string,
): value is SessionLearningReleaseSource {
  return (SESSION_LEARNING_RELEASE_SOURCES as readonly string[]).includes(
    value,
  );
}
