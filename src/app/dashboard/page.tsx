import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { FeatureStubScreen } from "@/features/apprentice-lifecycle";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function DashboardPage() {
  const session = await getSupabaseEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/dashboard"));
  assertRouteAccess(session, "/dashboard");
  return (
    <FeatureStubScreen
      title="Overview"
      description="Summary metrics on the Apprentice Lifecycle board are the Phase 1 operational focus. A dedicated overview dashboard can aggregate the same ports later."
    />
  );
}
