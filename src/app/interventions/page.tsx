import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function InterventionsQueuePage() {
  return renderSharedQueuePage(
    "/interventions",
    "Interventions",
    "Shared interventions queue — opens the canonical intervention record.",
  );
}
