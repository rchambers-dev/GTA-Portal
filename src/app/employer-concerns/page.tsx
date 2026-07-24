import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function EmployerConcernsQueuePage() {
  return renderSharedQueuePage(
    "/employer-concerns",
    "Employer concerns",
    "Shared GTA-first employer concern cases — internal notes stay permission-protected.",
  );
}
