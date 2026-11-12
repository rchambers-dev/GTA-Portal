import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { loadPlanPage } from "../domain/plan-repository";
import { ReviewSettingsScreen } from "./ReviewSettingsScreen";

export async function SettingsScreen() {
  const session = await getSupabaseEffectiveSession();
  const today = londonToday();
  const page = await loadPlanPage({
    canWrite: canAddApprentice(session),
    date: today,
    month: today.slice(0, 7),
  });
  return <ReviewSettingsScreen email={session?.account.email || ""} page={page} />;
}
