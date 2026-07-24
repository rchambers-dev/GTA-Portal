import { InterventionsScreen } from "@/features/progress-mentor";
import {
  requireMentorWorkspace,
  searchParamsToFilters,
} from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MentorInterventionsPage({
  searchParams,
}: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/interventions");
  const filters = searchParamsToFilters(await searchParams);
  return <InterventionsScreen filters={filters} />;
}
