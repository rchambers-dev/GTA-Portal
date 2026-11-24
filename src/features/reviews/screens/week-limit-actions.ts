"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";

export async function saveWeekLimitsAction(input: { max: number; earliestWeeks: number; latestWeeks: number }) {
  const session = await getSupabaseEffectiveSession();
  if (!canAddApprentice(session)) return { ok: false as const, formError: "You cannot change review settings." };
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("update_review_week_limits", {
    p_max: input.max,
    p_earliest: input.earliestWeeks,
    p_latest: input.latestWeeks,
  });
  if (result.error) return { ok: false as const, formError: result.error.message };
  return { ok: true as const };
}

export async function previewRebalanceAction() {
  const session = await getSupabaseEffectiveSession();
  if (!canAddApprentice(session)) return { ok: false as const, formError: "You cannot rebalance reviews." };
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("rebalance_review_weeks", { p_apply: false });
  if (result.error) return { ok: false as const, formError: result.error.message };
  return { ok: true as const, preview: result.data };
}

export async function applyRebalanceAction() {
  const session = await getSupabaseEffectiveSession();
  if (!canAddApprentice(session)) return { ok: false as const, formError: "You cannot rebalance reviews." };
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("rebalance_review_weeks", { p_apply: true });
  if (result.error) return { ok: false as const, formError: result.error.message };
  return { ok: true as const, preview: result.data };
}
