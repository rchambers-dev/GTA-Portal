import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function CurriculumFeedbackQueuePage() {
  return renderSharedQueuePage(
    "/curriculum-feedback",
    "Curriculum feedback",
    "Shared curriculum feedback queue — opens the canonical feedback item.",
  );
}
