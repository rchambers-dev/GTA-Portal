import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function SupportPlansQueuePage() {
  return renderSharedQueuePage(
    "/support-plans",
    "Support plans",
    "Shared support plans queue — opens the canonical support plan record.",
  );
}
