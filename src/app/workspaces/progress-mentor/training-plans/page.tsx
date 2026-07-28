import { getStandalonePorts } from "@/adapters/standalone";
import { TrainingPlanReviewsScreen } from "@/features/progress-mentor";
import { requireMentorWorkspace } from "@/shell/guards/mentor-workspace";

export default async function MentorTrainingPlansPage() {
  await requireMentorWorkspace("/workspaces/progress-mentor/training-plans");
  await getStandalonePorts().auth.getEffectiveSession();
  return <TrainingPlanReviewsScreen />;
}
