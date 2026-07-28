/**
 * Demo task progress for Alex — halfway through Autocare (Block 6 current).
 * Blocks 1–5 verified with sample answers; Block 6 partly done; 7–12 not started.
 */

import type { TaskSubmission } from "./task-submission-store";

const ALEX_ID = "alex-morgan";

function sampleFields(blockId: number, taskNumber: number): Record<string, string> {
  if (taskNumber === 1) {
    return {
      testDate: "2025-08-12",
      scorePercent: "82",
      result: "Pass",
      trainerFeedback: "Solid knowledge for this block. Revise tyre load ratings.",
      apprenticeSign: "signed",
      trainerSign: "signed",
    };
  }
  if (taskNumber === 2) {
    return {
      employerGarage: "Riverside Autocare",
      mentorName: "Reiss Chambers",
      dateCompleted: "2025-08-15",
      make: "Ford",
      model: "Focus",
      regNo: "AB74 GTA",
      jobTitle: `Block ${blockId} service / inspection job`,
      customerComplaint: "Customer reported uneven tyre wear and a slight pull to the left.",
      diagnosisRepair:
        "Checked tyre pressures and tread, inspected steering/suspension joints, recorded findings and agreed corrective work with mentor.",
      withinTimescale: "Yes",
      anyDelays: "No",
      apprenticeSign: "signed",
      mentorSign: "signed",
      assessorDecision: "Accepted",
    };
  }
  if (taskNumber === 5) {
    return {
      whatWentWell: `I felt more confident completing Block ${blockId} practicals independently and explaining findings to my mentor.`,
      whatToImprove: "I still need to slow down on documentation so measurements are clearer first time.",
      evidenceExamples: "Job card, practical assessment record, and mentor feedback from college day.",
      mentorComments: "Alex is progressing well and asks sensible questions before starting work.",
      trainerComments: "Reflection is honest and linked to real workshop examples. Progress verified.",
      apprenticeSign: "signed",
      mentorSign: "signed",
      trainerSign: "signed",
      trainerDecision: "Progress verified",
    };
  }
  // Practicals 3 / 4
  return {
    vehicleMake: "Vauxhall",
    vehicleModel: "Corsa",
    vehicleReg: "CD25 GTA",
    mileage: "48210",
    workDescription: `Completed Block ${blockId} Task ${taskNumber} practical under assessor observation. Recorded measurements and recommendations.`,
    ppeWorn: "Safety boots, overalls, gloves, eye protection as required.",
    apprenticeSign: "signed",
    assessorSign: "signed",
    assessmentDecision: "Pass",
    assessorFeedback: "Safe working and clear recording. Keep practising customer explanation.",
    kq1: "Follow manufacturer data and workplace procedures.",
    kq2: "Isolate risks, use correct PPE, and report concerns.",
    difficulty: "3 — About right",
  };
}

function verifiedTask(
  taskId: string,
  blockId: number,
  taskNumber: number,
  completedAtIso: string,
): TaskSubmission {
  return {
    taskId,
    learnerId: ALEX_ID,
    method: "portal_form",
    status: "verified",
    fields: sampleFields(blockId, taskNumber),
    uploadedPdfNames: [],
    difficulty: "3 — About right",
    difficultyComment: "",
    apprenticeSignedAt: completedAtIso,
    mentorSignedAt: completedAtIso,
    mentorSignedBy: "Reiss Chambers",
    trainerSignedAt: completedAtIso,
    trainerSignedBy: "Daniel Turner",
    trainerDecision: "Progress verified",
    returnNote: null,
    updatedAt: completedAtIso,
  };
}

function inProgressTask(taskId: string, updatedAtIso: string): TaskSubmission {
  return {
    taskId,
    learnerId: ALEX_ID,
    method: "portal_form",
    status: "in_progress",
    fields: {
      vehicleMake: "Toyota",
      vehicleModel: "Yaris",
      vehicleReg: "EF26 GTA",
      workDescription: "Started practical — measurements still being recorded.",
    },
    uploadedPdfNames: [],
    difficulty: null,
    difficultyComment: "",
    apprenticeSignedAt: null,
    mentorSignedAt: null,
    mentorSignedBy: null,
    trainerSignedAt: null,
    trainerSignedBy: null,
    trainerDecision: null,
    returnNote: null,
    updatedAt: updatedAtIso,
  };
}

function awaitingTrainerTask(
  taskId: string,
  updatedAtIso: string,
): TaskSubmission {
  return {
    ...inProgressTask(taskId, updatedAtIso),
    status: "awaiting_trainer",
    apprenticeSignedAt: updatedAtIso,
    fields: {
      vehicleMake: "Toyota",
      vehicleModel: "Yaris",
      vehicleReg: "EF26 GTA",
      mileage: "31900",
      workDescription:
        "Completed checks and recorded findings. Waiting for trainer verification.",
      ppeWorn: "Boots, overalls, gloves.",
      apprenticeSign: "signed",
      kq1: "Use calibrated equipment and record readings clearly.",
    },
  };
}

/**
 * Mid-course demo: programme week ~56 (Block 6), start 2025-07-08.
 */
export function buildAlexHalfwayTaskSeed(): Record<string, TaskSubmission> {
  const out: Record<string, TaskSubmission> = {};

  const stamps: Array<{ blockId: number; at: string }> = [
    { blockId: 1, at: "2025-08-20T12:00:00.000Z" },
    { blockId: 2, at: "2025-10-22T12:00:00.000Z" },
    { blockId: 3, at: "2026-01-14T12:00:00.000Z" },
    { blockId: 4, at: "2026-03-18T12:00:00.000Z" },
    { blockId: 5, at: "2026-05-27T12:00:00.000Z" },
  ];

  for (const { blockId, at } of stamps) {
    for (let n = 1; n <= 5; n += 1) {
      const id = `block-${blockId}-task-${n}`;
      out[id] = verifiedTask(id, blockId, n, at);
    }
  }

  const b6 = "2026-07-20T12:00:00.000Z";
  out["block-6-task-1"] = verifiedTask("block-6-task-1", 6, 1, b6);
  out["block-6-task-2"] = verifiedTask("block-6-task-2", 6, 2, b6);
  out["block-6-task-3"] = awaitingTrainerTask("block-6-task-3", b6);
  out["block-6-task-4"] = inProgressTask("block-6-task-4", b6);

  return out;
}
