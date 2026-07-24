import { EmployerConcernsScreen } from "@/features/progress-mentor";
import {
  requireMentorWorkspace,
  searchParamsToFilters,
} from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MentorEmployerConcernsPage({
  searchParams,
}: Props) {
  await requireMentorWorkspace(
    "/workspaces/progress-mentor/employer-concerns",
  );
  const filters = searchParamsToFilters(await searchParams);
  return <EmployerConcernsScreen filters={filters} />;
}
