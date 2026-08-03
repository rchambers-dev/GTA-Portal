import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";

export default async function ReviewsQueuePage() {
  return renderSharedQueuePage(
    "/reviews",
    "Reviews",
    "Shared reviews queue — open a row to the canonical review or apprentice record. Workspace dashboards link here; do not duplicate this list per role.",
  );
}
