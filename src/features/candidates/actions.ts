"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { CANDIDATES_PERMISSION_ERROR, canManageCandidates } from "./domain/access";
import { TABLES_MISSING, tablesMissing } from "./domain/missing";
import { reviewDueOn } from "./domain/rules";
import { isoTodayLondon } from "./domain/format";

function bounce(returnTo: string, message: string): never {
  const url = new URL(returnTo, "http://portal.local");
  url.searchParams.set("error", message);
  redirect(`${url.pathname}${url.search}`);
}

async function gate(returnTo: string) {
  const session = await getSupabaseEffectiveSession();
  if (!session) bounce(returnTo, "Sign in again to change candidates.");
  if (!canManageCandidates(session)) bounce(returnTo, CANDIDATES_PERMISSION_ERROR);
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
  const centre = await supabase.from("candidate_centres").select("id").eq("code", text(formData, "centre") || "doncaster").maybeSingle();
  const centreError = explain(centre.error);
  if (centreError) bounce(returnTo, centreError);
  const sourceLabel = text(formData, "source") || "Website";
  const source = await supabase.from("candidate_enquiry_sources").select("id, needs_detail").eq("label", sourceLabel).maybeSingle();
  if (explain(source.error)) bounce(returnTo, explain(source.error) as string);
  const programmeName = text(formData, "programme") || "Autocare";
  const programme = await supabase.from("programmes").select("id").eq("name", programmeName).maybeSingle();
  if (programme.error || !programme.data) {
    bounce(returnTo, programme.error ? explain(programme.error) || programme.error.message : `Programme “${programmeName}” was not found on the programmes table.`);
  }
  if (!centre.data || !source.data) bounce(returnTo, TABLES_MISSING);
  const idResult = await supabase.rpc("next_candidate_id");
  if (idResult.error || !idResult.data) bounce(returnTo, explain(idResult.error) || TABLES_MISSING);
  const candidateId = String(idResult.data);
  const inserted = await supabase.from("candidates").insert({
    candidate_id: candidateId,
    external_id: text(formData, "externalId") || null,
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
    employer_id: text(formData, "employerId") || null,
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
    detail: { source: sourceLabel },
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
  const saved = await supabase.from("employer_vacancies").insert({
    employer_id: text(formData, "employerId"),
    title: text(formData, "title"),
    status: text(formData, "status") || "open",
    total_places: Number(text(formData, "places") || "1"),
    notes: text(formData, "notes") || null,
    created_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
  redirect(returnTo);
}

export async function addEmployerActivityAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const { supabase, userId } = await gate(returnTo);
  const saved = await supabase.from("employer_activities").insert({
    employer_id: text(formData, "employerId"),
    activity_type: text(formData, "activityType") || "Call",
    actual_on: text(formData, "actualOn") || isoTodayLondon(),
    notes: text(formData, "notes") || null,
    entered_by: userId,
  });
  if (saved.error) bounce(returnTo, explain(saved.error) || saved.error.message);
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
