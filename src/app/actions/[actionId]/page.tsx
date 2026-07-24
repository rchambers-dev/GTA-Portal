import { getStandalonePorts } from "@/adapters/standalone";
import { ActionRecordScreen } from "@/features/progress-mentor/screens/ActionRecordScreen";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ actionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ActionRecordPage({ params, searchParams }: Props) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/staff/dashboard");
  const { actionId } = await params;
  assertRouteAccess(session, `/actions/${actionId}`);
  const sp = await searchParams;
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  return <ActionRecordScreen actionId={actionId} from={from} />;
}
