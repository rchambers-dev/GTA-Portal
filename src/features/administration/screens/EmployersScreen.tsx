import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { loadEmployersPage } from "../domain/employer-repository";
import { canManageEmployers } from "../domain/employer-record";
import { EmployersForm } from "./EmployersForm";

/**
 * Onboarding → Add employers.
 * Loads and saves through the signed-in Supabase session so RLS applies.
 */
export async function EmployersScreen() {
  const [session, page] = await Promise.all([
    getSupabaseEffectiveSession(),
    loadEmployersPage(),
  ]);

  return (
    <EmployersForm
      canWrite={canManageEmployers(session)}
      employers={page.employers}
      loadError={page.loadError}
    />
  );
}
