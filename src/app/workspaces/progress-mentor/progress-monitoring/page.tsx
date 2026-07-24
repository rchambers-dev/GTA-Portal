import { getStandalonePorts } from "@/adapters/standalone";
import { ProgressMonitoringScreen } from "@/features/progress-mentor";
import {
  requireMentorWorkspace,
  searchParamsToFilters,
} from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProgressMonitoringPage({ searchParams }: Props) {
  await requireMentorWorkspace(
    "/workspaces/progress-mentor/progress-monitoring",
  );
  const session = await getStandalonePorts().auth.getEffectiveSession();
  const filters = searchParamsToFilters(await searchParams);
  return (
    <ProgressMonitoringScreen
      filters={filters}
      permissions={session?.permissions ?? []}
    />
  );
}
