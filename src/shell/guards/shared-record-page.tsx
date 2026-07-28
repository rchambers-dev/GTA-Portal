import { redirect } from "next/navigation";
import { RecordStubScreen } from "@/features/shared-records";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export async function renderSharedQueuePage(
  pathname: string,
  title: string,
  description: string,
) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect(pathname));
  assertRouteAccess(session, pathname);
  return <RecordStubScreen title={title} description={description} />;
}

export async function renderSharedRecordPage(
  pathname: string,
  title: string,
  description: string,
) {
  return renderSharedQueuePage(pathname, title, description);
}
