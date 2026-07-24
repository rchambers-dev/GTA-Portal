import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function ModulesQueuePage() {
  return renderSharedQueuePage(
    "/modules",
    "Modules",
    "Shared modules queue — delivery-filtered for tutors; opens the canonical module record.",
  );
}
