import { getStandalonePorts } from "@/adapters/standalone";
import { ReviewsQueueScreen } from "@/features/progress-mentor";
import {
  requireMentorWorkspace,
  searchParamsToFilters,
} from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MentorReviewsPage({ searchParams }: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/reviews");
  const session = await getStandalonePorts().auth.getEffectiveSession();
  const filters = searchParamsToFilters(await searchParams);
  return (
    <ReviewsQueueScreen
      filters={filters}
      permissions={session?.permissions ?? []}
    />
  );
}
