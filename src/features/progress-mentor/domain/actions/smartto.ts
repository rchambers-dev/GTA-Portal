import type { ActionRecord, SmarttoAssessment, SmarttoDimension } from "./types";

const DIMENSIONS: SmarttoDimension[] = [
  "specific",
  "measurable",
  "achievable",
  "relevant",
  "timely",
  "trackable",
  "owned",
];

/**
 * Assess SMARTTO quality. Does not rewrite staff input — guidance only.
 */
export function assessSmartto(input: {
  title: string;
  description: string;
  successMeasure: string;
  dueDate: string;
  checkpointDate: string;
  owner: string;
  evidenceRequirement: string;
}): SmarttoAssessment {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const measure = input.successMeasure.toLowerCase();
  const guidance: string[] = [];

  const scores: Record<SmarttoDimension, boolean> = {
    specific: input.title.trim().length > 8 && !/do something|follow up|tbc/i.test(input.title),
    measurable: measure.length > 8 && !/tbc|n\/a|tba/i.test(measure),
    achievable: !/impossible|all modules immediately/i.test(text),
    relevant:
      /learn|progress|attend|evidence|skill|improve|recover|otj|ksb|epa/i.test(
        text + measure,
      ),
    timely: Boolean(input.dueDate),
    trackable: Boolean(input.checkpointDate) && Boolean(input.evidenceRequirement),
    owned: Boolean(input.owner?.trim()),
  };

  if (!scores.specific) {
    guidance.push(
      "This action describes an activity but may not state a clear, specific outcome.",
    );
  }
  if (!scores.measurable) {
    guidance.push("Add a success measure so completion can be verified.");
  }
  if (!scores.relevant) {
    guidance.push(
      "This action describes an activity but does not state the expected learning or improvement.",
    );
  }
  if (!scores.trackable) {
    guidance.push("Set a checkpoint date and evidence requirement so progress can be tracked.");
  }
  if (!scores.owned) {
    guidance.push("Assign a clear owner.");
  }

  const passed = DIMENSIONS.filter((d) => scores[d]).length;
  const quality = passed >= 6 ? "strong" : "needs_improvement";

  return { scores, quality, guidance };
}

export function smarttoQualityLabel(quality: SmarttoAssessment["quality"]): string {
  return quality === "strong" ? "Action quality: Strong" : "Action quality: Needs improvement";
}

const DIMENSION_META: Record<
  SmarttoDimension,
  { letter: string; label: string }
> = {
  specific: { letter: "S", label: "Specific" },
  measurable: { letter: "M", label: "Measurable" },
  achievable: { letter: "A", label: "Achievable" },
  relevant: { letter: "R", label: "Relevant" },
  timely: { letter: "T", label: "Timely" },
  trackable: { letter: "T", label: "Trackable" },
  owned: { letter: "O", label: "Owned" },
};

/**
 * Proof lines for each SMARTTO dimension — shown even when quality is strong.
 */
export function smarttoProofRows(action: ActionRecord): Array<{
  key: SmarttoDimension;
  letter: string;
  label: string;
  passed: boolean;
  proof: string;
}> {
  return DIMENSIONS.map((key) => {
    const meta = DIMENSION_META[key];
    const passed = action.smartto.scores[key];
    let proof = "";
    switch (key) {
      case "specific":
        proof = passed
          ? `Clear outcome in the title: “${action.title}”.`
          : "Title is too vague — state a concrete outcome.";
        break;
      case "measurable":
        proof = passed
          ? `Success measure: “${action.successMeasure}”.`
          : "No usable success measure to verify completion.";
        break;
      case "achievable":
        proof = passed
          ? `Challenge level “${action.challengeLevel}” with a scoped description.`
          : "Wording suggests the target may not be achievable as written.";
        break;
      case "relevant":
        proof = passed
          ? "Links to learning / OTJ / evidence / progress for the apprentice."
          : "Does not clearly state the learning or improvement expected.";
        break;
      case "timely":
        proof = passed
          ? `Due date set: ${action.dueDate}.`
          : "No due date — cannot judge timeliness.";
        break;
      case "trackable":
        proof = passed
          ? `Checkpoint ${action.checkpointDate}; evidence: ${action.evidenceRequirement}.`
          : "Missing checkpoint and/or evidence requirement.";
        break;
      case "owned":
        proof = passed
          ? `Owner: ${action.owner} (${action.ownerType}).`
          : "No clear owner assigned.";
        break;
    }
    return {
      key,
      letter: meta.letter,
      label: meta.label,
      passed,
      proof,
    };
  });
}

/** Operational sort: escalated → overdue → checkpoint due → due today → … */
export function actionSortRank(action: ActionRecord, today = "2026-07-17"): number {
  if (action.status === "escalated" || action.escalationStatus) return 0;
  if (action.status === "overdue") return 1;
  if (action.status === "checkpoint_due") return 2;
  if (action.dueDate === today) return 3;
  if (action.status === "awaiting_evidence") return 5;
  if (action.status === "completed" || action.status === "impact_confirmed") return 9;
  if (action.status === "closed" || action.status === "cancelled") return 10;
  return 4; // upcoming / in progress
}

export function shouldEscalate(action: ActionRecord): {
  escalate: boolean;
  reason: string | null;
  level: number;
} {
  if (action.status === "escalated") {
    return { escalate: true, reason: action.escalationStatus, level: action.escalationLevel ?? 1 };
  }
  if (action.missedTargetCount >= 2) {
    return {
      escalate: true,
      reason: "Apprentice has repeatedly missed targets",
      level: 2,
    };
  }
  if (action.status === "overdue" && action.ownerType === "employer") {
    return {
      escalate: true,
      reason: "Employer commitment remains overdue",
      level: 1,
    };
  }
  if (action.status === "overdue" && action.evidenceState === "required") {
    return {
      escalate: true,
      reason: "No evidence has been supplied and action is overdue",
      level: 1,
    };
  }
  if (action.status === "checkpoint_due") {
    return {
      escalate: true,
      reason: "Checkpoint missed",
      level: 1,
    };
  }
  return { escalate: false, reason: null, level: 0 };
}
