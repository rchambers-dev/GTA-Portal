import { addDays } from "./plan-due";

export const REVIEW_INTERVAL_WEEKS = 10;
export const TARGET_OWNERS = ["Apprentice", "Employer", "Tutor"] as const;

export const PROGRESS_ROWS = [
  { id: "overall_progress", label: "Overall progress" },
  { id: "knowledge_theory", label: "Knowledge / theory" },
  { id: "practical_skills", label: "Practical skills" },
  { id: "behaviours_attendance", label: "Behaviours and attendance" },
  {
    id: "english_maths",
    label: "English and maths",
    naComment:
      "English and maths are not applicable to this apprentice at this review. Functional skills are not part of this apprenticeship standard, so no extra English or maths work is required this cycle. I am marking this not applicable unless the standard or funding rules change before the next review. No catch-up plan is needed from me at this visit.",
  },
  { id: "off_the_job", label: "Off-the-job training" },
  {
    id: "epa_gateway",
    label: "EPA / gateway",
    naComment:
      "The apprentice is not yet close to EPA or gateway, so this is not applicable at this review. Portfolio evidence is still being gathered, there is no planned gateway date this cycle, and signed-off work is only just starting to build. Keep collecting workplace evidence and review how close they are again at the next visit. No EPA booking is needed yet.",
  },
] as const;

export type ProgressArea = (typeof PROGRESS_ROWS)[number]["id"];
export type TargetStatus = "open" | "met" | "partly" | "not-met" | "carry-forward";
export type Rag = "" | "red" | "amber" | "green" | "blue" | "na";

export type TargetDraft = {
  id: string | null;
  slot: number;
  action: string;
  owner: string;
  measure: string;
  targetDate: string;
  status: TargetStatus;
  carriedFromId: string | null;
};

export type ProgressDraft = {
  area: ProgressArea;
  evidence: string;
  actionRef: string;
  rag: Rag;
  targetHours: string;
  currentHours: string;
};

export type TutorFormDraft = {
  previousSummary: string;
  tutorComment: string;
  previousTargets: TargetDraft[];
  newTargets: TargetDraft[];
  progress: ProgressDraft[];
};

export function countWords(value: string): number {
  const text = value.trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function clipWords(value: string, words: number): string {
  const text = String(value ?? "");
  if (countWords(text) <= words) return text;
  return text.trim().split(/\s+/).slice(0, words).join(" ");
}

export function tutorTargetDateError(value: string, today: string, weeks = REVIEW_INTERVAL_WEEKS): string {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Choose a target date.";
  if (date < today) return "Target dates cannot be in the past.";
  const max = addDays(today, weeks * 7);
  if (date > max) return `Target dates must be within the next ${weeks} weeks.`;
  return "";
}

function targetStarted(target: TargetDraft): boolean {
  return Boolean(target.action.trim() || target.owner.trim() || target.measure.trim() || target.targetDate.trim());
}

export type FormGap = { anchor: string; message: string };

/** Same order and messages as the Review Assistant firstTutorFormGap. */
export function firstTutorFormGap(form: TutorFormDraft, today: string, weeks = REVIEW_INTERVAL_WEEKS): FormGap | null {
  if (!form.previousSummary.trim()) {
    return { anchor: "summary", message: "Write the tutor summary of the previous review." };
  }
  const started = form.newTargets.filter(targetStarted);
  if (!started.length) {
    return { anchor: "target-1", message: "Add at least one current target." };
  }
  for (let index = 0; index < started.length; index += 1) {
    const target = started[index];
    const label = started.length > 1 ? ` for target ${index + 1}` : "";
    const anchor = `target-${target.slot}`;
    if (!target.action.trim()) return { anchor, message: `Write the action / target${label}.` };
    if (!target.owner.trim()) return { anchor, message: `Choose who owns the target${label}.` };
    if (!target.measure.trim()) return { anchor, message: `Write the success measure${label}.` };
    const dateError = tutorTargetDateError(target.targetDate, today, weeks);
    if (dateError) {
      return {
        anchor,
        message: started.length > 1 ? dateError.replace("Target dates", `Target ${index + 1} date`) : dateError,
      };
    }
  }
  if (form.previousTargets.some((target) => target.action.trim() && target.status === "open")) {
    return {
      anchor: "previous-1",
      message: "Mark each previous target as met, partly met, not met or carry forward.",
    };
  }
  for (const row of PROGRESS_ROWS) {
    const progress = form.progress.find((item) => item.area === row.id);
    const anchor = `progress-${row.id}`;
    if (!progress?.evidence.trim()) {
      return { anchor, message: `Write evidence for ${row.label}.` };
    }
    if (row.id === "off_the_job") {
      const target = progress.targetHours.trim() === "" ? null : Number(progress.targetHours);
      const current = progress.currentHours.trim() === "" ? null : Number(progress.currentHours);
      if (target == null || !Number.isFinite(target)) {
        return { anchor, message: "Enter the target off-the-job hours." };
      }
      if (target === 0) return { anchor, message: "Target off-the-job hours must be more than 0." };
      if (current == null || !Number.isFinite(current)) {
        return { anchor, message: "Enter the current off-the-job hours." };
      }
      continue;
    }
    if (!["red", "amber", "green"].includes(progress.rag)) {
      return { anchor, message: `Mark ${row.label} as red, amber or green.` };
    }
  }
  if (!form.tutorComment.trim()) {
    return { anchor: "comment", message: "Write the GTA tutor contribution." };
  }
  return null;
}

export function otjTrack(targetHours: string, currentHours: string): { rag: Rag; label: string; detail: string } {
  const target = targetHours.trim() === "" ? null : Number(targetHours);
  const current = currentHours.trim() === "" ? null : Number(currentHours);
  if (target == null || current == null || !Number.isFinite(target) || !Number.isFinite(current)) {
    return { rag: "", label: "Waiting for hours", detail: "Add the target and what they are at now." };
  }
  if (target === 0) return { rag: "", label: "Target needed", detail: "Target hours must be more than 0." };
  const ratio = current / target;
  const percent = Math.round(ratio * 100);
  const detail = `${current} of ${target} hours · ${percent}%`;
  if (ratio < 0.8) return { rag: "red", label: "Behind track", detail };
  if (ratio < 0.95) return { rag: "amber", label: "Slightly behind", detail };
  if (ratio < 1.2) return { rag: "green", label: "On track", detail };
  return { rag: "blue", label: "Well ahead", detail };
}

export function emptyTutorForm(): TutorFormDraft {
  return {
    previousSummary: "",
    tutorComment: "",
    previousTargets: [1, 2, 3].map((slot) => ({
      id: null,
      slot,
      action: "",
      owner: "",
      measure: "",
      targetDate: "",
      status: "open" as const,
      carriedFromId: null,
    })),
    newTargets: [1, 2, 3].map((slot) => ({
      id: null,
      slot,
      action: "",
      owner: "",
      measure: "",
      targetDate: "",
      status: "open" as const,
      carriedFromId: null,
    })),
    progress: PROGRESS_ROWS.map((row) => ({
      area: row.id,
      evidence: "",
      actionRef: "",
      rag: "" as Rag,
      targetHours: "",
      currentHours: "",
    })),
  };
}

export function formPayload(form: TutorFormDraft) {
  return {
    form: {
      previous_summary: form.previousSummary,
      tutor_comment: form.tutorComment,
    },
    progress: form.progress.map((row) => ({
      area: row.area,
      evidence: row.evidence,
      action_ref: row.actionRef,
      rag: row.area === "off_the_job" ? otjTrack(row.targetHours, row.currentHours).rag || null : row.rag || null,
      target_hours: row.area === "off_the_job" ? row.targetHours : null,
      current_hours: row.area === "off_the_job" ? row.currentHours : null,
    })),
    targets: [
      ...form.previousTargets
        .filter((target) => target.action.trim())
        .map((target) => ({ kind: "previous", slot: target.slot, status: target.status })),
      ...form.newTargets.map((target) => ({
        kind: "new",
        slot: target.slot,
        action: target.action,
        owner: target.owner,
        measure: target.measure,
        target_date: target.targetDate,
        carried_from_id: target.carriedFromId,
      })),
    ],
  };
}

/** Same checks as the Review Assistant tutorReviewFillProgress. `remaining` is the percent still to fill. */
export function tutorFill(form: TutorFormDraft, today: string, weeks = REVIEW_INTERVAL_WEEKS, sent = false) {
  if (sent) return { started: true, remaining: 0, sent: true, percent: 100 };
  const startedTargets = form.newTargets.filter(
    (target) => target.action.trim() || target.owner.trim() || target.measure.trim() || target.targetDate.trim(),
  );
  const checks: boolean[] = [Boolean(form.previousSummary.trim()), Boolean(form.tutorComment.trim())];
  if (!startedTargets.length) checks.push(false);
  else {
    startedTargets.forEach((target) => {
      checks.push(
        Boolean(
          target.action.trim() &&
            target.owner.trim() &&
            target.measure.trim() &&
            !tutorTargetDateError(target.targetDate, today, weeks),
        ),
      );
    });
  }
  form.progress.forEach((row) => {
    if (row.area === "off_the_job") {
      checks.push(Boolean(row.evidence.trim() && otjTrack(row.targetHours, row.currentHours).rag));
    } else {
      checks.push(Boolean(row.evidence.trim() && ["red", "amber", "green"].includes(row.rag)));
    }
  });
  form.previousTargets
    .filter((target) => target.action.trim())
    .forEach((target) => checks.push(target.status !== "open"));
  const done = checks.filter(Boolean).length;
  const remaining = checks.length ? Math.round(((checks.length - done) / checks.length) * 100) : 100;
  return { started: done > 0 || startedTargets.length > 0, remaining, sent: false, percent: 100 - remaining };
}

export function tidyTutorText(value: string, wordLimit: number): string {
  let text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text
    .replace(/\bappr\b/gi, "apprentice")
    .replace(/\bwkbk\b/gi, "workbook")
    .replace(/\botj\b/gi, "off-the-job")
    .replace(/\bepa\b/gi, "EPA");
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const ended = /[.!?]$/.test(part) ? part : `${part}.`;
      return ended.charAt(0).toUpperCase() + ended.slice(1);
    });
  return clipWords(parts.join(" "), wordLimit);
}
