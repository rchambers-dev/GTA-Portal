"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice, formatApprenticeName } from "@/features/administration/domain/apprentice-record";
import { questionnaireLock, validateQuestionnaire, type Questionnaire } from "../domain/questionnaire";
import { hashReviewToken, newReviewToken } from "../domain/rules";

const DENIED = "You do not have permission to change tutor reviews. Administrator and Management can.";

async function writer() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, error: "Sign in again to change tutor reviews." };
  if (!canAddApprentice(session)) return { ok: false as const, error: DENIED };
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

export async function setTutorReviewRoundAction(input: { roundId: string; status: "open" | "closed" }) {
  const access = await writer();
  if (!access.ok) return access;
  const patch = input.status === "closed"
    ? { status: "closed", closed_early_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { status: "open", closed_early_at: null, updated_at: new Date().toISOString() };
  const { error } = await access.supabase.from("tutor_review_rounds").update(patch).eq("id", input.roundId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function generateTutorReviewInvitesAction(roundId: string): Promise<
  { ok: false; error: string } | { ok: true; links: { name: string; email: string; path: string }[] }
> {
  const access = await writer();
  if (!access.ok) return access;
  const [peopleResult, tutorsResult, invitesResult] = await Promise.all([
    access.supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name, email"),
    access.supabase.from("apprentice_tutors").select("apprentice_id, tutor_id, start_date").is("end_date", null),
    access.supabase.from("tutor_review_invites").select("id, apprentice_id, used_at").eq("round_id", roundId),
  ]);
  const failure = peopleResult.error || tutorsResult.error || invitesResult.error;
  if (failure) return { ok: false, error: failure.message };
  const current = new Map<string, { tutorId: string; start: string }>();
  for (const row of (tutorsResult.data ?? []) as { apprentice_id: string; tutor_id: string; start_date: string }[]) {
    const existing = current.get(row.apprentice_id);
    if (!existing || row.start_date > existing.start) current.set(row.apprentice_id, { tutorId: row.tutor_id, start: row.start_date });
  }
  const invites = new Map(((invitesResult.data ?? []) as { id: string; apprentice_id: string; used_at: string | null }[]).map((row) => [row.apprentice_id, row]));
  const links: { name: string; email: string; path: string }[] = [];
  for (const person of (peopleResult.data ?? []) as { gta_id: string; first_name: string; middle_names: string | null; last_name: string; email: string | null }[]) {
    const tutor = current.get(person.gta_id);
    if (!tutor) continue;
    const existing = invites.get(person.gta_id);
    if (existing?.used_at) continue;
    const token = newReviewToken();
    const token_hash = hashReviewToken(token);
    const saved = existing
      ? await access.supabase.from("tutor_review_invites").update({ token_hash, tutor_id: tutor.tutorId }).eq("id", existing.id)
      : await access.supabase.from("tutor_review_invites").insert({ round_id: roundId, apprentice_id: person.gta_id, tutor_id: tutor.tutorId, token_hash });
    if (saved.error) return { ok: false, error: saved.error.message };
    links.push({
      name: formatApprenticeName({
        firstName: person.first_name,
        middleNames: person.middle_names,
        lastName: person.last_name,
      }),
      email: person.email || "No email",
      path: `/tutor-review/${token}`,
    });
  }
  return { ok: true, links };
}

export async function saveTutorReviewQuestionnaireAction(roundId: string, questionnaire: Questionnaire) {
  const access = await writer();
  if (!access.ok) return access;
  const parsed = validateQuestionnaire(questionnaire);
  if (!parsed.ok) return parsed;
  const [invites, responses] = await Promise.all([
    access.supabase.from("tutor_review_invites").select("id", { count: "exact", head: true }).eq("round_id", roundId),
    access.supabase.from("tutor_review_responses").select("id", { count: "exact", head: true }).eq("round_id", roundId),
  ]);
  const failure = invites.error || responses.error;
  if (failure) return { ok: false as const, error: failure.message };
  const lock = questionnaireLock({ inviteCount: invites.count ?? 0, responseCount: responses.count ?? 0 });
  if (lock.locked) return { ok: false as const, error: lock.reason || "Questions are locked." };
  const { error } = await access.supabase.rpc("save_tutor_review_questionnaire", {
    p_round_id: roundId,
    p_title: parsed.value.title,
    p_intro: parsed.value.intro,
    p_rating_help: parsed.value.ratingHelp,
    p_scale: parsed.value.scale,
    p_page_headings: parsed.value.pageHeadings,
    p_questions: parsed.value.questions,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function submitTutorReviewAction(
  token: string,
  answers: { code: string; rating?: number | null; text?: string | null }[],
): Promise<{ state: "unavailable" | "submitted" | "closed" | "not_open" | "invalid" }> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("submit_tutor_review", { p_token: token, p_answers: answers });
  if (result.error) return { state: "unavailable" };
  const state = (result.data as { state?: string } | null)?.state;
  if (state === "submitted" || state === "closed" || state === "not_open" || state === "invalid") return { state };
  return { state: "unavailable" };
}
