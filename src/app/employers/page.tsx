import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function EmployersQueuePage() {
  return renderSharedQueuePage(
    "/employers",
    "Employers",
    "Shared employers queue — opens the canonical employer record.",
  );
}
