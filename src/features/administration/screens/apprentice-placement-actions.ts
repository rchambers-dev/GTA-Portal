"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canManageApprenticeProgramme } from "../domain/apprentice-programme";
import {
  changeApprenticePlacement,
  endApprenticePlacement,
  startApprenticePlacement,
} from "../domain/apprentice-placement-repository";
import {
  PLACEMENT_PERMISSION_ERROR,
  type PlacementActionResult,
} from "../domain/apprentice-placement";

const SIGN_IN_ERROR = "Sign in again to change a placement.";

async function authorised(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; formError: string }
> {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false, formError: SIGN_IN_ERROR };
  if (!canManageApprenticeProgramme(session)) {
    return { ok: false, formError: PLACEMENT_PERMISSION_ERROR };
  }
  return { ok: true, supabase: await createSupabaseServerClient() };
}

export async function endApprenticePlacementAction(input: {
  employmentId: string;
  endDate: string;
  endReason: string;
}): Promise<PlacementActionResult> {
  const access = await authorised();
  if (!access.ok) return access;
  return endApprenticePlacement(access.supabase, input);
}

export async function startApprenticePlacementAction(input: {
  gtaId: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
}): Promise<PlacementActionResult> {
  const access = await authorised();
  if (!access.ok) return access;
  return startApprenticePlacement(access.supabase, input);
}

export async function changeApprenticePlacementAction(input: {
  employmentId: string;
  endDate: string;
  endReason: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
}): Promise<PlacementActionResult> {
  const access = await authorised();
  if (!access.ok) return access;
  return changeApprenticePlacement(access.supabase, input);
}
