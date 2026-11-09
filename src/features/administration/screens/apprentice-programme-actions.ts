"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import {
  approveApprenticePlannedDateChange,
  recordApprenticeReturnCheck,
  rejectApprenticePlannedDateChange,
  requestApprenticePlannedDateChange,
  returnApprenticeFromBreak,
  saveApprenticeCourseDates,
  setApprenticeExtensionPaperwork,
  signOffApprenticeReturn,
  startApprenticeBreak,
} from "../domain/apprentice-programme-repository";
import {
  PROGRAMME_PERMISSION_ERROR,
  canManageApprenticeProgramme,
  validateBreakStart,
  validateCourseDateSubmission,
  validateDateChangeRequest,
  validateRecordId,
  type ProgrammeActionResult,
} from "../domain/apprentice-programme";
import { londonToday } from "../domain/apprentice-tutor";

const SIGN_IN_ERROR = "Sign in again to change the programme.";

async function authorisedClient(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; formError: string }
> {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false, formError: SIGN_IN_ERROR };
  if (!canManageApprenticeProgramme(session)) {
    return { ok: false, formError: PROGRAMME_PERMISSION_ERROR };
  }
  return { ok: true, supabase: await createSupabaseServerClient() };
}

export async function saveApprenticeCourseDatesAction(input: {
  gtaId: string;
  courseStart: string;
  actualCourseEnd: string;
  actualGateway1: string;
  actualGateway2: string;
  actualEpa: string;
  plannedCourseEnd?: string;
  plannedGateway1?: string;
  plannedGateway2?: string;
  plannedEpa?: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateCourseDateSubmission(input);
  if (!parsed.ok) return parsed;
  return saveApprenticeCourseDates(access.supabase, parsed.value);
}

export async function requestPlannedDateChangeAction(input: {
  gtaId: string;
  dateType: string;
  newDate: string;
  reasonId: string;
  explanation: string;
  extensionPaperwork: boolean;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateDateChangeRequest(input);
  if (!parsed.ok) return parsed;
  return requestApprenticePlannedDateChange(access.supabase, parsed.value);
}

export async function approvePlannedDateChangeAction(input: {
  changeId: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateRecordId(input.changeId, "That date change");
  if (!parsed.ok) return parsed;
  return approveApprenticePlannedDateChange(access.supabase, parsed.value);
}

export async function rejectPlannedDateChangeAction(input: {
  changeId: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateRecordId(input.changeId, "That date change");
  if (!parsed.ok) return parsed;
  return rejectApprenticePlannedDateChange(access.supabase, parsed.value);
}

export async function setExtensionPaperworkAction(input: {
  changeId: string;
  received: boolean;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateRecordId(input.changeId, "That date change");
  if (!parsed.ok) return parsed;
  return setApprenticeExtensionPaperwork(access.supabase, parsed.value, input.received === true);
}

export async function startBreakInLearningAction(input: {
  gtaId: string;
  reasonId: string;
  explanation: string;
  startDate: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateBreakStart(input);
  if (!parsed.ok) return parsed;
  return startApprenticeBreak(access.supabase, parsed.value);
}

export async function recordReturnCheckResultAction(input: {
  breakId: string;
  itemId: string;
  passed: boolean;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const breakId = validateRecordId(input.breakId, "That break");
  if (!breakId.ok) return breakId;
  const itemId = validateRecordId(input.itemId, "That checklist item");
  if (!itemId.ok) return itemId;
  return recordApprenticeReturnCheck(access.supabase, {
    breakId: breakId.value,
    itemId: itemId.value,
    passed: input.passed === true,
  });
}

export async function signOffReturnToLearningAction(input: {
  breakId: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateRecordId(input.breakId, "That break");
  if (!parsed.ok) return parsed;
  return signOffApprenticeReturn(access.supabase, parsed.value);
}

export async function returnFromBreakAction(input: {
  breakId: string;
}): Promise<ProgrammeActionResult> {
  const access = await authorisedClient();
  if (!access.ok) return access;
  const parsed = validateRecordId(input.breakId, "That break");
  if (!parsed.ok) return parsed;
  return returnApprenticeFromBreak(access.supabase, parsed.value, londonToday());
}
