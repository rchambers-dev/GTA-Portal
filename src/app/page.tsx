import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";

export default async function HomePage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) {
    redirect("/learners/lifecycle");
  }
  redirect(getDefaultWorkspaceRoute(session.account.workspace, session));
}
