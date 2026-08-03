import { MENTOR_NAME } from "../../data/mentor-caseload";
import { assessSmartto } from "../actions/smartto";
import { addAction } from "../actions/mock-store";
import type { ActionRecord } from "../actions/types";
import type { FormalReview } from "../reviews/types";

/**
 * Create a real Action Centre record from an agreed review action.
 * Preserves the review as source — never stores actions only as review text.
 */
export function createActionFromReviewAgreement(input: {
  review: FormalReview;
  title: string;
  description: string;
  owner: string;
  ownerType: ActionRecord["ownerType"];
  dueDate: string;
  checkpointDate: string;
  successMeasure: string;
  evidenceRequirement: string;
}): ActionRecord {
  const smartto = assessSmartto({
    title: input.title,
    description: input.description,
    successMeasure: input.successMeasure,
    dueDate: input.dueDate,
    checkpointDate: input.checkpointDate,
    owner: input.owner,
    evidenceRequirement: input.evidenceRequirement,
  });

  const record: ActionRecord = {
    actionId: `act-from-${input.review.reviewId}-${Date.now().toString(36)}`,
    title: input.title,
    description: input.description,
    apprenticeId: input.review.apprenticeId,
    apprenticeName: input.review.apprenticeName,
    employerId: input.review.employerId,
    employerName: input.review.employerName,
    owner: input.owner,
    ownerType: input.ownerType,
    createdBy: MENTOR_NAME,
    sourceType: "review",
    sourceId: input.review.reviewId,
    sourceLabel: `${input.review.reviewType} · ${input.review.reviewDate} · ${input.review.apprenticeName}`,
    createdAt: new Date().toISOString().slice(0, 10),
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: input.dueDate,
    checkpointDate: input.checkpointDate,
    successMeasure: input.successMeasure,
    evidenceRequirement: input.evidenceRequirement,
    evidenceState: "required",
    challengeLevel: "standard",
    status: "agreed",
    progressUpdate: null,
    completionEvidence: null,
    impact: null,
    escalationStatus: null,
    escalationLevel: null,
    closedDate: null,
    closureReason: null,
    lastUpdate: new Date().toISOString().slice(0, 10),
    assignedToMe: input.ownerType === "mentor",
    assignedByMe: true,
    smartto,
    missedTargetCount: 0,
    priority: "medium",
    evidencePackId: null,
    signedOffBy: null,
    signedOffAt: null,
    signOffNote: null,
  };

  addAction(record);
  return record;
}
