import { getStandalonePorts } from "@/adapters/standalone";
import { ReviewRecordScreen } from "@/features/progress-mentor/screens/ReviewRecordScreen";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewRecordPage({ params, searchParams }: Props) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/staff/dashboard");
  const { reviewId } = await params;
  assertRouteAccess(session, `/reviews/${reviewId}`);
  const sp = await searchParams;
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  return <ReviewRecordScreen reviewId={reviewId} from={from} />;
}
