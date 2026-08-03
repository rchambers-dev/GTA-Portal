import type { ChatPortalLinkAttachment } from "./types";

export type ChatPortalLinkOption = ChatPortalLinkAttachment & {
  id: string;
  keywords: string[];
  audience: Array<"mentor" | "tutor" | "employer" | "support" | "anyone">;
};

/**
 * Shareable portal targets for chat — staff can open the exact place to
 * approve, deny, or complete something without hunting for it.
 */
export function listShareablePortalLinks(): ChatPortalLinkOption[] {
  return [
    {
      id: "otj-home",
      type: "portal_link",
      href: "/apprentice/otj",
      title: "My OTJ hours",
      detail: "Off-the-job log and approval pipeline",
      actionLabel: "Open OTJ",
      area: "OTJ",
      keywords: ["otj", "hours", "log"],
      audience: ["anyone"],
    },
    {
      id: "tracking-home",
      type: "portal_link",
      href: "/apprentice/tracking",
      title: "Personal tracking",
      detail: "Programme tracking — groups or college blocks by cohort spine",
      actionLabel: "Open tracking",
      area: "Tracking",
      keywords: ["tracking", "cea", "task", "groups", "blocks"],
      audience: ["anyone"],
    },
    {
      id: "tracking-tyres",
      type: "portal_link",
      href: "/apprentice/tracking?task=g3-t1",
      title: "Tracking · Remove and install tyres",
      detail: "Group 3 task — ready for employer / teacher sign-off",
      actionLabel: "Open task",
      area: "Tracking",
      keywords: ["tracking", "cea", "tyre", "g3", "sign-off"],
      audience: ["mentor", "tutor", "employer", "anyone"],
    },
    {
      id: "tutor-signoffs",
      type: "portal_link",
      href: "/staff/module-sign-offs",
      title: "Tutor module sign-off queue",
      detail: "Outcomes waiting for tutor confirm",
      actionLabel: "Open queue",
      area: "Approvals",
      keywords: ["sign-off", "tutor", "queue", "module"],
      audience: ["tutor", "mentor"],
    },
    {
      id: "employer-otj-queue",
      type: "portal_link",
      href: "/employer/otj",
      title: "Employer OTJ to agree",
      detail: "Hours waiting for employer confirmation",
      actionLabel: "Open approvals",
      area: "Approvals",
      keywords: ["employer", "otj", "agree", "approve"],
      audience: ["employer", "mentor"],
    },
    {
      id: "tutor-otj-queue",
      type: "portal_link",
      href: "/staff/otj-approvals",
      title: "Teacher OTJ final agree",
      detail: "Final OTJ confirm after employer agreement",
      actionLabel: "Open approvals",
      area: "Approvals",
      keywords: ["tutor", "teacher", "otj", "final", "agree"],
      audience: ["tutor", "mentor"],
    },
    {
      id: "attendance",
      type: "portal_link",
      href: "/apprentice/attendance",
      title: "Attendance & catch-up",
      detail: "Missed modules / tasks from days away",
      actionLabel: "Open attendance",
      area: "Attendance",
      keywords: ["attendance", "absent", "missed", "catch-up"],
      audience: ["anyone"],
    },
    {
      id: "reviews",
      type: "portal_link",
      href: "/apprentice/reviews",
      title: "Progress reviews",
      detail: "Upcoming and completed apprentice reviews",
      actionLabel: "Open reviews",
      area: "Reviews",
      keywords: ["review", "progress"],
      audience: ["anyone"],
    },
    {
      id: "learning",
      type: "portal_link",
      href: "/apprentice/learning",
      title: "My learning plan",
      detail: "This week’s priorities at college and work",
      actionLabel: "Open plan",
      area: "Learning",
      keywords: ["learning", "plan", "week"],
      audience: ["anyone"],
    },
  ];
}

export function searchShareablePortalLinks(query: string): ChatPortalLinkOption[] {
  const q = query.trim().toLowerCase();
  const all = listShareablePortalLinks();
  if (!q) return all;
  return all.filter((link) => {
    const hay = [
      link.title,
      link.detail,
      link.area,
      link.actionLabel,
      ...link.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
