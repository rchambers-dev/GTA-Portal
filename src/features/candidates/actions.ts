"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { CANDIDATES_PERMISSION_ERROR, canManageCandidates } from "./domain/access";
import { TABLES_MISSING, tablesMissing } from "./domain/missing";
import { applicantEntryError, programmeChoiceId } from "./domain/programme";
import { reviewDueOn } from "./domain/rules";
import { isoTodayLondon } from "./domain/format";
import { revalidateAnalytics } from "@/features/reviews/domain/revalidate-analytics";

function bounce(returnTo: string, message: string): never {
  const url = new URL(returnTo, "http://portal.local");
  url.searchParams.set("error", message);
  redirect(`${url.pathname}${url.search}`);
}

async function gate(returnTo: string) {
  const session = await getSupabaseEffectiveSession();
  if (!session) bounce(returnTo, "Sign in again to change applicants.");
  if (!canManageCandidates(session)) bounce(returnTo, CANDIDATES_PERMISSION_ERROR);
  await revalidateAnalytics();
  return { supabase: await createSupabaseServerClient(), userId: session.account.id };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Accepts an ISO date or a UK dd/mm/yyyy date. */
function isoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (!match) return value;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function explain(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (tablesMissing(error.message, error.code)) return TABLES_MISSING;
  return error.message;
}

export async function createCandidateAction(formData: FormData) {
  const returnTo = text(formData, "returnTo") || "/administration/onboarding/candidates/new";
  const { supabase, userId } = await gate(returnTo);
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const email = text(formData, "email");
  const phone = text(formData, "phone");
  const firstContact = isoDate(text(formData, "firstContact"));
  if (!firstName || !lastName || !email || !phone || !firstContact) {
    bounce(returnTo, "First name, last name, email, phone and the original first-contact date are required.");
  }
  const programmeId = programmeChoiceId(text(formData, "programmeId"));
  const centreId = programmeChoiceId(text(formData, "centreId"));
  const sourceId = programmeChoiceId(text(formData, "sourceId"));
  const entryError = applicantEntryError({
    firstName,
    lastName,
    email,
    phone,
    firstContact,
    programmeId,
    centreId,
    sourceId,
  });
  if (entryError || !programmeId || !centreId || !sourceId) bounce(returnTo, entryError || "Choose a programme.");
  const programme = await supabase.from("programmes").select("id").eq("id", programmeId).maybeSingle();
  if (programme.error || !programme.data) {
    bounce(returnTo, programme.error ? explain(programme.error) || programme.error.message : "Choose a programme from the list.");
  }
  const centre = await supabase.from("candidate_centres").select("id").eq("id", centreId).maybeSingle();
  if (centre.error || !centre.data) bounce(returnTo, explain(centre.error) || "Choose a centre from the list.");
  const source = await supabase.from("candidate_enquiry_sources").select("id, label").eq("id", sourceId).maybeSingle();
  if (source.error || !source.data) bounce(returnTo, explain(source.error) || "Choose a source from the list.");
  const idResult = await supabase.rpc("next_candidate_id");
  if (idResult.error || !idResult.data) bounce(returnTo, explain(idResult.error) || TABLES_MISSING);
  const candidateId = String(idResult.data);
  const employerId = text(formData, "employerId");
  if (employerId) {
    const employer = await supabase.from("employers").select("employer_id").eq("employer_id", employerId).maybeSingle();
    if (employer.error) bounce(returnTo, explain(employer.error) || employer.error.message);
    if (!employer.data) bounce(returnTo, "Choose an employer from the list. Employer IDs cannot be typed.");
  }
  const inserted = await supabase.from("candidates").insert({
    candidate_id: candidateId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    centre_id: centre.data.id,
    programme_id: programme.data.id,
    first_contact_on: firstContact,
    enquiry_source_id: source.data.id,
    enquiry_source_detail: text(formData, "sourceDetail") || null,
    employer_status: text(formData, "employerStatus") || "needed",
    employer_id: employerId || null,
    notes: text(formData, "notes") || null,
    responsiveness: "responsive",
    review_due_on: reviewDueOn(firstContact, "responsive"),
    status: "active",
    created_by: userId,
  });
  if (inserted.error) bounce(returnTo, explain(inserted.error) || inserted.error.message);
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "created",
    actual_on: firstContact,
    entered_by: userId,
    detail: { source: source.data.label },
  });
  const list = returnTo.replace(/\/new.*$/, "");
  redirect(`${list}/${encodeURIComponent(candidateId)}`);
}

export async function saveCheckAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("candidate_check_results").insert({
    candidate_id: text(formData, "candidateId"),
    definition_id: text(formData, "definitionId"),
    result: text(formData, "result") || "done",
    actual_on: text(formData, "actualOn") || isoTodayLondon(),
    entered_by: userId,
    correction_note: text(formData, "correctionNote") || null,
    supersedes_id: text(formData, "supersedesId") || null,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function bookResitAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const centre = await supabase.from("candidate_centres").select("id").eq("code", text(formData, "centre") || "doncaster").maybeSingle();
  if (centre.error || !centre.data) bounce(returnTo, explain(centre.error) || TABLES_MISSING);
  const session = await supabase
    .from("interview_sessions")
    .insert({
      session_on: text(formData, "resitOn"),
      centre_id: centre.data.id,
      kind: "resit",
      capacity: 1,
      created_by: userId,
    })
    .select("id")
    .single();
  if (session.error || !session.data) bounce(returnTo, explain(session.error) || TABLES_MISSING);
  const booked = await supabase.rpc("book_interview_attempt", {
    p_candidate_id: text(formData, "candidateId"),
    p_session_id: session.data.id,
    p_frees_on_cancel: text(formData, "freesPlace") === "yes",
  });
  if (booked.error) bounce(returnTo, explain(booked.error) || booked.error.message);
  redirect(returnTo);
}

export async function bookInterviewAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const booked = await supabase.rpc("book_interview_attempt", {
    p_candidate_id: text(formData, "candidateId"),
    p_session_id: text(formData, "sessionId"),
    p_frees_on_cancel: text(formData, "freesPlace") === "yes",
  });
  if (booked.error) bounce(returnTo, explain(booked.error) || booked.error.message);
  redirect(returnTo);
}

export async function recordInterviewAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase
    .from("interview_bookings")
    .update({
      attendance: text(formData, "attendance") || null,
      outcome: text(formData, "outcome") || "awaiting",
      frees_place: text(formData, "freesPlace") === "yes",
      actual_on: text(formData, "actualOn") || isoTodayLondon(),
      entered_at: new Date().toISOString(),
      entered_by: userId,
    })
    .eq("id", text(formData, "bookingId"));
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function approveStage2Action(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const current = await supabase.from("candidates").select("employer_status").eq("candidate_id", candidateId).maybeSingle();
  if (current.error || !current.data) bounce(returnTo, explain(current.error) || "This applicant could not be found.");
  const passed = await supabase.from("interview_bookings").select("id").eq("candidate_id", candidateId).eq("outcome", "passed").limit(1);
  if (passed.error) bounce(returnTo, explain(passed.error) || passed.error.message);
  if (current.data.employer_status !== "confirmed" || !(passed.data ?? []).length) {
    bounce(returnTo, "Stage 2 stays locked until the interview is passed and the employer is confirmed.");
  }
  const saved = await supabase
    .from("candidates")
    .update({ stage2_approved_at: new Date().toISOString(), stage2_approved_by: userId, updated_at: new Date().toISOString() })
    .eq("candidate_id", text(formData, "candidateId"));
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function allocateVacancyAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const saved = await supabase.rpc("allocate_vacancy_place", {
    p_vacancy_id: text(formData, "vacancyId"),
    p_candidate_id: text(formData, "candidateId"),
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function reofferDecisionAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("vacancy_reoffer_decisions").insert({
    allocation_id: text(formData, "allocationId"),
    vacancy_id: text(formData, "vacancyId"),
    decision: text(formData, "decision") || "pending",
    decided_on: text(formData, "decidedOn") || isoTodayLondon(),
    decided_by: userId,
    notes: text(formData, "notes") || null,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function addIntakeAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const deadline = text(formData, "deadline");
  const saved = await supabase.from("induction_intakes").insert({
    intake_on: text(formData, "intakeOn"),
    booking_deadline_on: deadline || null,
    notes: text(formData, "notes") || null,
    created_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function bookInductionAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("induction_bookings").insert({
    candidate_id: text(formData, "candidateId"),
    intake_id: text(formData, "intakeId"),
    entered_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function confirmInductionAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const saved = await supabase.rpc("confirm_induction_attendance", {
    p_booking_id: text(formData, "bookingId"),
    p_actual_on: text(formData, "actualOn") || isoTodayLondon(),
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function absenceOutcomeAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const outcome = text(formData, "outcome");
  const saved = await supabase
    .from("induction_bookings")
    .update({
      attendance: "absent",
      absence_outcome: outcome,
      actual_on: text(formData, "actualOn") || isoTodayLondon(),
      entered_at: new Date().toISOString(),
      entered_by: userId,
    })
    .eq("id", text(formData, "bookingId"));
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  if (outcome === "withdraw" || outcome === "pause") {
    await supabase
      .from("candidates")
      .update({
        status: outcome === "withdraw" ? "withdrawn_before_start" : "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", text(formData, "candidateId"));
  }
  redirect(returnTo);
}

export async function addCalendarEventAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("recruitment_calendar_events").insert({
    title: text(formData, "title"),
    audience: text(formData, "audience"),
    event_on: text(formData, "eventOn"),
    owner_id: userId,
    status: "planned",
    notes: text(formData, "notes") || null,
    created_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function addRecruitmentAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("recruitment_actions").insert({
    title: text(formData, "title"),
    owner_id: userId,
    deadline_on: text(formData, "deadline") || null,
    impact_check: text(formData, "impact") || null,
    status: "open",
    created_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function setResponsivenessAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const responsiveness = text(formData, "responsiveness") === "unresponsive" ? "unresponsive" : "responsive";
  const firstContact = isoDate(text(formData, "firstContact"));
  const saved = await supabase
    .from("candidates")
    .update({
      responsiveness,
      review_due_on: reviewDueOn(firstContact, responsiveness),
      updated_at: new Date().toISOString(),
    })
    .eq("candidate_id", text(formData, "candidateId"));
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function archiveCandidateAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const saved = await supabase
    .from("candidates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("candidate_id", text(formData, "candidateId"));
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function deleteCandidateAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase } = await gate(returnTo);
  const saved = await supabase.rpc("delete_candidate_personal_data", {
    p_candidate_id: text(formData, "candidateId"),
    p_confirmed_name: text(formData, "confirmedName"),
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function addVacancyAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const employerId = text(formData, "employerId");
  const employer = await supabase.from("employers").select("employer_id").eq("employer_id", employerId).maybeSingle();
  if (employer.error) bounce(returnTo, explain(employer.error) || employer.error.message);
  if (!employer.data) bounce(returnTo, "Choose an employer from the list. Employer IDs cannot be typed.");
  const saved = await supabase.from("employer_vacancies").insert({
    employer_id: employerId,
    title: text(formData, "title"),
    status: text(formData, "status") || "open",
    total_places: Number(text(formData, "places") || "1"),
    notes: text(formData, "notes") || null,
    created_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function logCandidateContactAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("candidate_events").insert({
    candidate_id: text(formData, "candidateId"),
    event_type: "contact",
    actual_on: text(formData, "actualOn") || isoTodayLondon(),
    entered_by: userId,
    detail: { type: text(formData, "activityType") || "Call", notes: text(formData, "notes") },
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function addEmployerActivityAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const named = await supabase.from("employers").select("employer_id").eq("company_name", text(formData, "employerName")).maybeSingle();
  if (named.error) bounce(returnTo, explain(named.error) || named.error.message);
  if (!named.data) bounce(returnTo, "That employer could not be found. Employer IDs cannot be typed.");
  const saved = await supabase.from("employer_activities").insert({
    employer_id: named.data.employer_id,
    activity_type: text(formData, "activityType") || "Call",
    actual_on: text(formData, "actualOn") || isoTodayLondon(),
    notes: text(formData, "notes") || null,
    entered_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function updateCandidateDetailsAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const firstName = text(formData, "firstName");
  const middleNames = text(formData, "middleNames");
  const lastName = text(formData, "lastName");
  const email = text(formData, "email");
  const phone = text(formData, "phone");
  const firstContact = isoDate(text(formData, "firstContact"));
  const programmeId = programmeChoiceId(text(formData, "programmeId"));
  const centreId = programmeChoiceId(text(formData, "centreId"));
  const sourceId = programmeChoiceId(text(formData, "sourceId"));
  const entryError = applicantEntryError({ firstName, lastName, email, phone, firstContact, programmeId, centreId, sourceId });
  if (entryError || !programmeId || !centreId || !sourceId) bounce(returnTo, entryError || "Choose a programme.");
  const current = await supabase.from("candidates").select("responsiveness").eq("candidate_id", candidateId).maybeSingle();
  if (current.error || !current.data) bounce(returnTo, explain(current.error) || "This applicant could not be found.");
  const responsiveness = current.data.responsiveness === "unresponsive" ? "unresponsive" : "responsive";
  const saved = await supabase.from("candidates").update({
    first_name: firstName,
    middle_names: middleNames || null,
    last_name: lastName,
    email,
    phone,
    centre_id: centreId,
    programme_id: programmeId,
    first_contact_on: firstContact,
    enquiry_source_id: sourceId,
    enquiry_source_detail: text(formData, "sourceDetail") || null,
    notes: text(formData, "notes") || null,
    review_due_on: reviewDueOn(firstContact, responsiveness),
    updated_at: new Date().toISOString(),
  }).eq("candidate_id", candidateId);
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "details_updated",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: { name: [firstName, middleNames, lastName].filter(Boolean).join(" "), email, phone },
  });
  redirect(returnTo);
}

export async function recordApplicantCheckAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const definitionId = text(formData, "definitionId");
  const result = text(formData, "result");
  const actualOn = isoDate(text(formData, "actualOn")) || isoTodayLondon();
  if (!["pass", "fail", "done", "booked"].includes(result)) bounce(returnTo, "Choose a result.");
  if (!definitionId || !/^\d{4}-\d{2}-\d{2}$/.test(actualOn)) bounce(returnTo, "Choose the date this was done.");
  const existing = await supabase
    .from("candidate_check_results")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("definition_id", definitionId)
    .is("superseded_at", null);
  if (existing.error) bounce(returnTo, explain(existing.error) || existing.error.message);
  const previous = (existing.data ?? []) as { id: string }[];
  const saved = await supabase.from("candidate_check_results").insert({
    candidate_id: candidateId,
    definition_id: definitionId,
    result,
    actual_on: actualOn,
    entered_by: userId,
    supersedes_id: previous[0]?.id ?? null,
    correction_note: previous.length ? "Updated result" : null,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  if (previous.length) {
    await supabase.from("candidate_check_results").update({
      superseded_at: new Date().toISOString(),
      superseded_by: userId,
    }).in("id", previous.map((row) => row.id));
  }
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "check_recorded",
    actual_on: actualOn,
    entered_by: userId,
    detail: { definition_id: definitionId, result },
  });
  redirect(returnTo);
}

export async function clearApplicantCheckAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const resultId = text(formData, "resultId");
  if (!resultId) bounce(returnTo, "There is no saved result to clear.");
  const current = await supabase.from("candidates").select("actual_start_on").eq("candidate_id", candidateId).maybeSingle();
  if (current.error || !current.data) bounce(returnTo, explain(current.error) || "This applicant could not be found.");
  if (current.data.actual_start_on) bounce(returnTo, "Checks stay as recorded once the applicant has started.");
  const saved = await supabase.from("candidate_check_results").update({
    superseded_at: new Date().toISOString(),
    superseded_by: userId,
  }).eq("id", resultId).eq("candidate_id", candidateId).is("superseded_at", null);
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "check_cleared",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: { result_id: resultId },
  });
  redirect(returnTo);
}

export async function undoStage2ApprovalAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const current = await supabase.from("candidates").select("actual_start_on, stage2_approved_at").eq("candidate_id", candidateId).maybeSingle();
  if (current.error || !current.data) bounce(returnTo, explain(current.error) || "This applicant could not be found.");
  if (current.data.actual_start_on) bounce(returnTo, "Stage 2 approval stays once the applicant has started.");
  if (!current.data.stage2_approved_at) bounce(returnTo, "Stage 2 has not been approved.");
  const saved = await supabase.from("candidates").update({
    stage2_approved_at: null,
    stage2_approved_by: null,
    updated_at: new Date().toISOString(),
  }).eq("candidate_id", candidateId);
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "stage2_approval_cleared",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: {},
  });
  redirect(returnTo);
}

export async function setIntendedIntakeAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const intakeId = text(formData, "intakeId");
  const saved = await supabase.from("candidates").update({
    intended_intake_id: intakeId || null,
    updated_at: new Date().toISOString(),
  }).eq("candidate_id", candidateId);
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "intended_intake",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: { intake_id: intakeId || null },
  });
  redirect(returnTo);
}

export async function linkCandidateEmployerAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const status = text(formData, "employerStatus");
  if (!["needed", "identified", "confirmed"].includes(status)) bounce(returnTo, "Choose an employer status.");
  const employerId = text(formData, "employerId");
  const siteId = text(formData, "employerSiteId");
  const managerId = text(formData, "employerManagerId");
  if (status === "needed") {
    const saved = await supabase.from("candidates").update({
      employer_status: "needed",
      employer_id: null,
      employer_site_id: null,
      employer_manager_id: null,
      updated_at: new Date().toISOString(),
    }).eq("candidate_id", candidateId);
    if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  } else {
    if (!employerId) bounce(returnTo, "Choose an employer from the list.");
    const employer = await supabase.from("employers").select("employer_id").eq("employer_id", employerId).maybeSingle();
    if (employer.error || !employer.data) bounce(returnTo, explain(employer.error) || "Choose an employer from the list.");
    if (siteId) {
      const site = await supabase.from("employer_sites").select("id").eq("id", siteId).eq("employer_id", employerId).maybeSingle();
      if (site.error || !site.data) bounce(returnTo, "Choose a site that belongs to that employer.");
    }
    if (managerId) {
      const manager = await supabase.from("employer_managers").select("id").eq("id", managerId).eq("employer_id", employerId).maybeSingle();
      if (manager.error || !manager.data) bounce(returnTo, "Choose a manager who belongs to that employer.");
    }
    const saved = await supabase.from("candidates").update({
      employer_status: status,
      employer_id: employerId,
      employer_site_id: siteId || null,
      employer_manager_id: managerId || null,
      updated_at: new Date().toISOString(),
    }).eq("candidate_id", candidateId);
    if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  }
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "employer_linked",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: { employer_status: status, employer_id: status === "needed" ? null : employerId },
  });
  redirect(returnTo);
}

export async function recordVacancyInterestAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const candidateId = text(formData, "candidateId");
  const vacancyId = text(formData, "vacancyId");
  const status = text(formData, "interestStatus");
  if (!["proposed", "applied", "offered", "declined", "withdrawn"].includes(status)) bounce(returnTo, "Choose a vacancy status.");
  if (!vacancyId) bounce(returnTo, "Choose a vacancy.");
  const probe = await supabase.from("candidate_vacancy_interests").select("id").limit(1);
  if (probe.error) {
    bounce(returnTo, tablesMissing(probe.error.message, probe.error.code)
      ? "Vacancy interests are not saved yet. The new table still needs to be applied."
      : explain(probe.error) || probe.error.message);
  }
  const saved = await supabase.from("candidate_vacancy_interests").upsert({
    candidate_id: candidateId,
    vacancy_id: vacancyId,
    status,
    noted_on: isoTodayLondon(),
    notes: text(formData, "notes") || null,
    entered_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "candidate_id,vacancy_id" });
  if (saved.error) {
    bounce(returnTo, tablesMissing(saved.error.message, saved.error.code)
      ? "Vacancy interests are not saved yet. The new table still needs to be applied."
      : explain(saved.error) || saved.error.message);
  }
  await supabase.from("candidate_events").insert({
    candidate_id: candidateId,
    event_type: "vacancy_interest",
    actual_on: isoTodayLondon(),
    entered_by: userId,
    detail: { vacancy_id: vacancyId, status },
  });
  redirect(returnTo);
}

export async function saveDeadlineSettingAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const raw = text(formData, "days");
  const saved = await supabase.from("candidate_settings").upsert({
    id: true,
    intake_booking_deadline_days: raw === "" ? null : Number(raw),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}
