import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";
import type { ReviewState } from "./state-store";
import { reviewAssistantAccess } from "./access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOCKED = new Set(["apprentice", "employer", "Apprentice", "Employer"]);

export type ReviewDirectoryPerson = { id: string; name: string };

export function portalScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function person(id: unknown, name: unknown): ReviewDirectoryPerson | null {
  const textId = String(id || "");
  const textName = String(name || "").trim();
  if (!UUID.test(textId) || !textName) return null;
  return { id: textId, name: textName };
}

export async function loadReviewStaff(session: EffectiveSession): Promise<ReviewDirectoryPerson[]> {
  const access = reviewAssistantAccess(session);
  if (access === "denied") return [];
  if (access === "tutor") {
    const self = person(session.account.id, session.account.name);
    return self ? [self] : [];
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, base_role, workspace")
      .order("display_name", { ascending: true });
    if (error || !data) return [];
    return data.flatMap((row) => {
      if (BLOCKED.has(String(row.workspace || "")) || BLOCKED.has(String(row.base_role || ""))) return [];
      const item = person(row.id, row.display_name);
      return item ? [item] : [];
    });
  } catch {
    return [];
  }
}

/** An assignment counts only while it is active and its end date has not passed. */
export function assignmentGrantsCaseload(
  row: { active?: boolean | null; ended_at?: string | null },
  now = new Date(),
) {
  if (row.active !== true) return false;
  if (row.ended_at == null || row.ended_at === "") return true;
  const ended = new Date(row.ended_at);
  return !Number.isNaN(ended.getTime()) && ended.getTime() > now.getTime();
}

export async function loadReviewApprentices(session: EffectiveSession): Promise<ReviewDirectoryPerson[]> {
  const access = reviewAssistantAccess(session);
  if (access === "denied") return [];
  try {
    const supabase = createSupabaseAdminClient();
    if (access === "office" && hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE)) {
      const { data, error } = await supabase
        .from("apprentices")
        .select("id, display_name")
        .order("display_name", { ascending: true });
      if (error || !data) return [];
      return data.flatMap((row) => {
        const item = person(row.id, row.display_name);
        return item ? [item] : [];
      });
    }
    const assignments = await supabase
      .from("staff_assignments")
      .select("apprentice_programme_id, active, ended_at")
      .eq("profile_id", session.account.id)
      .eq("role", "tutor");
    if (assignments.error || !assignments.data?.length) return [];
    const now = new Date();
    const programmeIds = assignments.data
      .filter((row) => assignmentGrantsCaseload(row, now))
      .map((row) => row.apprentice_programme_id)
      .filter(Boolean);
    const programmes = await supabase
      .from("apprentice_programmes")
      .select("apprentice_id")
      .in("id", programmeIds);
    if (programmes.error || !programmes.data?.length) return [];
    const apprenticeIds = programmes.data.map((row) => row.apprentice_id).filter(Boolean);
    const apprentices = await supabase
      .from("apprentices")
      .select("id, display_name")
      .in("id", apprenticeIds);
    if (apprentices.error || !apprentices.data) return [];
    return apprentices.data.flatMap((row) => {
      const item = person(row.id, row.display_name);
      return item ? [item] : [];
    });
  } catch {
    return [];
  }
}

function idsIn(state: ReviewState) {
  const ids = new Set<string>();
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const item of list || []) {
      if (item?.id) ids.add(String(item.id));
    }
  }
  for (const review of state.savedReviews || []) {
    if (review?.learnerId) ids.add(String(review.learnerId));
  }
  return [...ids];
}

export function learnerIdsOutside(allowedIds: string[], state: ReviewState) {
  const allowed = new Set(allowedIds);
  const unknown = idsIn(state).filter((id) => !allowed.has(id));
  if (!unknown.length) return null;
  if (!allowed.size) return "No Portal apprentices are available to review.";
  return "Choose a Portal apprentice. This screen does not create one.";
}

/** Review rows may only use apprentice ids the server already allows. */
export async function reviewLearnerIdError(session: EffectiveSession, state: ReviewState) {
  return learnerIdsOutside((await loadReviewApprentices(session)).map((item) => item.id), state);
}
