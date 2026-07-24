import {
  ALEX_OTJ_ENTRIES,
  ALEX_PROFILE,
  canEmployerActOnOtj,
  canTutorActOnOtj,
  otjPipelineLabel,
} from "../mock-learner";
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
  const links: ChatPortalLinkOption[] = [
    {
      id: "otj-home",
      type: "portal_link",
      href: "/learner/evidence",
      title: "My OTJ hours",
      detail: "Alex’s off-the-job log and approval pipeline",
      actionLabel: "Open OTJ",
      area: "OTJ",
      keywords: ["otj", "hours", "evidence", "log"],
      audience: ["anyone"],
    },
    {
      id: "cea-home",
      type: "portal_link",
      href: "/learner/assignments",
      title: "CEA tasks",
      detail: "Competence evidence tasks waiting for workplace / teacher sign-off",
      actionLabel: "Open CEA",
      area: "CEA",
      keywords: ["cea", "assignment", "task", "tyre"],
      audience: ["anyone"],
    },
    {
      id: "cea-tyres",
      type: "portal_link",
      href: "/learner/assignments?task=g3-t1",
      title: "CEA · Remove and install tyres",
      detail: "Group 3 task — ready for employer / teacher sign-off",
      actionLabel: "Open task",
      area: "CEA",
      keywords: ["cea", "tyre", "g3", "sign-off"],
      audience: ["mentor", "tutor", "employer", "anyone"],
    },
    {
      id: "module-m3",
      type: "portal_link",
      href: "/learner/modules/m3",
      title: "Module MV-103 · Vehicle systems",
      detail: "Current module coverage and outcomes",
      actionLabel: "Open module",
      area: "Modules",
      keywords: ["module", "mv-103", "systems"],
      audience: ["anyone"],
    },
    {
      id: "topic-m3-c2",
      type: "portal_link",
      href: "/learner/modules/m3/m3-c2",
      title: "Topic · Cooling and lubrication",
      detail: "In progress — needs tutor observation / sign-off",
      actionLabel: "Open topic",
      area: "Modules",
      keywords: ["cooling", "sign-off", "topic", "tutor"],
      audience: ["tutor", "mentor", "anyone"],
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
      detail: `Hours waiting for ${ALEX_PROFILE.employerContact} to confirm`,
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
      href: "/learner/attendance",
      title: "Attendance & catch-up",
      detail: "Missed modules / tasks from days Alex was away",
      actionLabel: "Open attendance",
      area: "Attendance",
      keywords: ["attendance", "absent", "missed", "catch-up"],
      audience: ["anyone"],
    },
    {
      id: "reviews",
      type: "portal_link",
      href: "/learner/reviews",
      title: "Progress reviews",
      detail: "Upcoming and completed learner reviews",
      actionLabel: "Open reviews",
      area: "Reviews",
      keywords: ["review", "progress"],
      audience: ["anyone"],
    },
    {
      id: "learning",
      type: "portal_link",
      href: "/learner/learning",
      title: "My learning plan",
      detail: "This week’s priorities at college and work",
      actionLabel: "Open plan",
      area: "Learning",
      keywords: ["learning", "plan", "week"],
      audience: ["anyone"],
    },
  ];

  for (const entry of ALEX_OTJ_ENTRIES) {
    const needsEmployer = canEmployerActOnOtj(entry);
    const needsTutor = canTutorActOnOtj(entry);
    const actionAudience: ChatPortalLinkOption["audience"] = needsEmployer
      ? ["employer", "mentor", "anyone"]
      : needsTutor
        ? ["tutor", "mentor", "anyone"]
        : ["anyone"];

    links.push({
      id: `otj-entry-${entry.id}`,
      type: "portal_link",
      href: `/learner/evidence?otj=${entry.id}`,
      title: `OTJ · ${entry.taskName}`,
      detail: `${otjPipelineLabel(entry)} · Task ${entry.taskNumber}`,
      actionLabel: needsEmployer
        ? "Review for employer"
        : needsTutor
          ? "Review for teacher"
          : "Open entry",
      area: "OTJ",
      keywords: [
        "otj",
        entry.taskName.toLowerCase(),
        entry.id,
        otjPipelineLabel(entry).toLowerCase(),
      ],
      audience: actionAudience,
    });

    if (needsEmployer) {
      links.push({
        id: `otj-employer-${entry.id}`,
        type: "portal_link",
        href: `/employer/otj?otj=${entry.id}`,
        title: `Agree OTJ · ${entry.taskName}`,
        detail: "Direct link for employer to agree or return this entry",
        actionLabel: "Agree / return",
        area: "Approvals",
        keywords: ["agree", "employer", "otj", entry.id],
        audience: ["employer", "mentor"],
      });
    }

    if (needsTutor) {
      links.push({
        id: `otj-tutor-${entry.id}`,
        type: "portal_link",
        href: `/staff/otj-approvals?otj=${entry.id}`,
        title: `Final agree OTJ · ${entry.taskName}`,
        detail: "Direct link for teacher final confirmation",
        actionLabel: "Final agree",
        area: "Approvals",
        keywords: ["tutor", "teacher", "final", "otj", entry.id],
        audience: ["tutor", "mentor"],
      });
    }
  }

  return links;
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
