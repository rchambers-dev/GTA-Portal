/**
 * Session review-material release — tutor grant that held learner-visible
 * review materials are available to an enrolment after teaching.
 *
 * Separate from Session learning release, attendance, completion, Tasks, OTJ,
 * or competence.
 */
export const SESSION_REVIEW_RELEASE_SOURCES = [
  "teaching_group",
  "individual",
] as const;

export type SessionReviewReleaseSource =
  (typeof SESSION_REVIEW_RELEASE_SOURCES)[number];

export type SessionReviewRelease = {
  id: string;
  programmeVersionId: string;
  sessionId: string;
  apprenticeId: string;
  apprenticeProgrammeId: string;
  spineItemId: string | null;
  teachingGroupId: string | null;
  source: SessionReviewReleaseSource;
  releasedAt: string;
  releasedBy: string | null;
  releasedByName: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function isSessionReviewReleaseSource(
  value: string,
): value is SessionReviewReleaseSource {
  return (SESSION_REVIEW_RELEASE_SOURCES as readonly string[]).includes(value);
}
