import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { isMentorStaffSession } from "@/lib/permissions/workspace";

export async function requireMentorWorkspace(
  pathname: string,
): Promise<void> {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect(pathname));
  assertRouteAccess(session, pathname);
  if (!isMentorStaffSession(session)) {
    redirect("/staff/dashboard");
  }
}

export function searchParamsToFilters(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}
