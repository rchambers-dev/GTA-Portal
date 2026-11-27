import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { FeatureStubScreen } from "@/features/apprentice-lifecycle";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function Page() {
  const session = await getSupabaseEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/admin"));
  assertRouteAccess(session, "/admin");
  return (
    <FeatureStubScreen
      title="Administration"
      description="Requirement framework configuration and role administration will land after the operational dashboard is approved."
    />
  );
}
