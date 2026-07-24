import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function ProgrammesQueuePage() {
  return renderSharedQueuePage(
    "/programmes",
    "Programmes",
    "Shared programmes queue — opens the canonical programme record.",
  );
}
