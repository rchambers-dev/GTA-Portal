import { redirect } from "next/navigation";
import { LifecycleBoardScreen } from "@/features/learner-lifecycle";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { parseBoardQuery } from "@/lib/board-query";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LearnerLifecyclePage({ searchParams }: Props) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  // Avoid / ↔ /learners/lifecycle bounce when session is missing
  if (!session) {
    redirect("/staff/dashboard");
  }
  assertRouteAccess(session, "/learners/lifecycle");

  const params = await searchParams;
  const query = parseBoardQuery(params);
  const board = await ports.data.getLifecycleBoard(query);

  return <LifecycleBoardScreen board={board} />;
}
