/**
 * Session delivery records — tutor sign-off that a planned Session was delivered.
 * Not competence, Task pass, OTJ, or attendance.
 */

export type SessionDeliveryStatus = "delivered";

export type SessionDeliveryRecord = {
  id: string;
  programmeVersionId: string;
  sessionId: string;
  apprenticeId: string;
  apprenticeProgrammeId: string;
  spineItemId: string | null;
  status: SessionDeliveryStatus;
  deliveredAt: string;
  signedOffBy: string | null;
  signedOffByName: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type { SessionLaneStatus as SessionLearningLaneStatus } from "./session-lane";
export { labelSessionLaneStatus as labelSessionLearningStatus } from "./session-lane";
