import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function EvidenceQueuePage() {
  return renderSharedQueuePage(
    "/evidence",
    "Evidence",
    "Shared evidence queue — opens the canonical evidence record or learner Evidence tab.",
  );
}
