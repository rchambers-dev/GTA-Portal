import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { FeatureStubScreen } from "@/features/apprentice-lifecycle";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function Page() {
  const session = await getSupabaseEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reports"));
  assertRouteAccess(session, "/reports");
  return (
    <FeatureStubScreen
      title="Reports"
      description="Reporting is out of Phase 1 scope; data structures are designed to support traceable figures later."
    />
  );
}
