import type { WorkspaceId } from "@/lib/portal/types";

export type PortalNotificationCategory =
  | "action"
  | "message"
  | "review"
  | "otj"
  | "cea"
  | "attendance"
  | "module"
  | "general";

export type PortalNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  hrefLabel: string;
  category: PortalNotificationCategory;
  /** Short relative label, e.g. "Today", "Yesterday". */
  when: string;
  urgent?: boolean;
};

function categoryLabel(category: PortalNotificationCategory): string {
  switch (category) {
    case "action":
      return "Action";
    case "message":
      return "Message";
    case "review":
      return "Review";
    case "otj":
      return "OTJ";
    case "cea":
      return "Tracking";
    case "attendance":
      return "Attendance";
    case "module":
      return "Module";
    default:
      return "Update";
  }
}

export { categoryLabel };

/**
 * Live portal: no seeded notification feed — only real items later.
 */
export function getPortalNotifications(
  _workspace: WorkspaceId | string,
): PortalNotification[] {
  return [];
}
