import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function ActionsQueuePage() {
  return renderSharedQueuePage(
    "/actions",
    "Actions",
    "Shared actions queue — opens the canonical action record.",
  );
}
