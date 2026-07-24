import { EmployerRelationshipsScreen } from "@/features/progress-mentor";
import { requireMentorWorkspace } from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MentorEmployersPage({ searchParams }: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/employers");
  const params = await searchParams;
  return (
    <EmployerRelationshipsScreen fromLifecycle={params.from === "lifecycle"} />
  );
}
