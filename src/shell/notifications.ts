import type { WorkspaceId } from "@/lib/portal/types";
import { ALEX_LEARNING, ALEX_PROFILE } from "@/features/apprentice-portal/domain/mock-apprentice";
import { isDemoModeEnabled } from "@/lib/env/portal";

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
      return "CEA";
    case "attendance":
      return "Attendance";
    case "module":
      return "Module";
    default:
      return "Update";
  }
}

export { categoryLabel };

function mapLearningKind(
  kind: (typeof ALEX_LEARNING.thisWeek)[number]["kind"],
): PortalNotificationCategory {
  switch (kind) {
    case "college":
      return "module";
    case "workplace":
      return "action";
    default:
      return kind;
  }
}

function apprenticeNotifications(): PortalNotification[] {
  const fromLearning: PortalNotification[] = [
    ...ALEX_LEARNING.thisWeek,
    ...ALEX_LEARNING.lookingAhead,
  ].map((item, index) => ({
    id: `learn-${item.id}`,
    title: item.title,
    detail: item.detail,
    href: item.href,
    hrefLabel: item.hrefLabel,
    category: mapLearningKind(item.kind),
    when: index < 2 ? "Today" : index < 4 ? "This week" : "Upcoming",
    urgent: index < 2,
  }));

  const extras: PortalNotification[] = [
    {
      id: "msg-mentor",
      title: `New message from ${ALEX_PROFILE.mentorName}`,
      detail: "Checking you’re set for college Monday — reply when OTJ is logged.",
      href: "/apprentice/messages",
      hrefLabel: "Open messages",
      category: "message",
      when: "Today",
      urgent: true,
    },
    {
      id: "msg-group",
      title: "College catch-up group",
      detail: "Daniel asked you to bring the inspection sheet on Tuesday.",
      href: "/apprentice/messages",
      hrefLabel: "Open group chat",
      category: "message",
      when: "Today",
    },
    {
      id: "rev-upcoming",
      title: "Progress review on 8 Aug",
      detail: `Prepare evidence and actions with ${ALEX_PROFILE.mentorName}.`,
      href: "/apprentice/reviews/rev-alex-upcoming",
      hrefLabel: "Open review prep",
      category: "review",
      when: "Upcoming",
      urgent: true,
    },
    {
      id: "att-catchup",
      title: "Missed learning to catch up",
      detail: "Review modules and CEA tasks linked to recent absences.",
      href: "/apprentice/attendance",
      hrefLabel: "Open attendance",
      category: "attendance",
      when: "This week",
    },
    {
      id: "cv-nudge",
      title: "Keep your CV draft moving",
      detail: "Save an editable copy when you’re happy with this week’s updates.",
      href: "/apprentice/cv",
      hrefLabel: "Open CV builder",
      category: "general",
      when: "This week",
    },
  ];

  return [...extras.slice(0, 3), ...fromLearning, ...extras.slice(3)].slice(0, 12);
}

function staffNotifications(workspace: string): PortalNotification[] {
  return [
    {
      id: "staff-1",
      title: "Apprentice OTJ awaiting agreement",
      detail: "Alex Morgan — catch-up OTJ block needs employer follow-up.",
      href: "/workspaces/progress-mentor/actions",
      hrefLabel: "Open actions",
      category: "otj",
      when: "Today",
      urgent: true,
    },
    {
      id: "staff-2",
      title: "Review prep incomplete",
      detail: "August progress review pack still missing apprentice reflection.",
      href: "/workspaces/progress-mentor/reviews",
      hrefLabel: "Open reviews",
      category: "review",
      when: "Today",
      urgent: true,
    },
    {
      id: "staff-3",
      title: "New employer concern",
      detail: "Riverside Autocare raised a workplace note for triage.",
      href: "/workspaces/progress-mentor/employer-concerns",
      hrefLabel: "Open concerns",
      category: "action",
      when: "Yesterday",
    },
    {
      id: "staff-4",
      title: "Message from tutor",
      detail: "Daniel flagged workshop assessment marking for Tuesday.",
      href: "/workspaces/progress-mentor/messages",
      hrefLabel: "Open messages",
      category: "message",
      when: "Yesterday",
    },
    {
      id: "staff-5",
      title: `${workspace} queue update`,
      detail: "Open items need a decision before end of week.",
      href: "/apprentices/lifecycle",
      hrefLabel: "Open lifecycle",
      category: "general",
      when: "This week",
    },
  ];
}

export function getPortalNotifications(
  workspace: WorkspaceId | string,
): PortalNotification[] {
  // Live portal: no seeded notification feed — only real items later.
  if (!isDemoModeEnabled()) return [];
  if (workspace === "apprentice") return apprenticeNotifications();
  return staffNotifications(String(workspace));
}
