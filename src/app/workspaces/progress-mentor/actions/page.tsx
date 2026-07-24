import { ActionCentreScreen } from "@/features/progress-mentor";
import {
  requireMentorWorkspace,
  searchParamsToFilters,
} from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MentorActionsPage({ searchParams }: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/actions");
  const filters = searchParamsToFilters(await searchParams);
  return <ActionCentreScreen filters={filters} />;
}
