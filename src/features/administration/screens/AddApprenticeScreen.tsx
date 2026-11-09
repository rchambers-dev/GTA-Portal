import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { loadAddApprenticePage } from "../domain/apprentice-repository";
import { canAddApprentice } from "../domain/apprentice-record";
import { AddApprenticeForm } from "./AddApprenticeForm";

/**
 * Onboarding → Add apprentice.
 * Loads and saves through the signed-in Supabase session so RLS applies.
 */
export async function AddApprenticeScreen() {
  const [session, page] = await Promise.all([
    getSupabaseEffectiveSession(),
    loadAddApprenticePage(),
  ]);

  return (
    <AddApprenticeForm
      canAdd={canAddApprentice(session)}
      programmes={page.programmes}
      apprentices={page.apprentices}
      loadError={page.loadError}
    />
  );
}
