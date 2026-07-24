"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MENTOR_CONCERNS } from "../data/mentor-work-items";
import {
  MentorPageShell,
  MentorTable,
  StatusChip,
  ViewTabs,
} from "../components/MentorWorkQueue";
import { MENTOR_BASE } from "../lib/metric-links";
import queueStyles from "../components/MentorWorkQueue.module.css";

type Props = {
  filters: Record<string, string | undefined>;
};

export function EmployerConcernsScreen({ filters }: Props) {
  const view = filters.view ?? "all";

  const filtered = useMemo(() => {
    if (view === "all") return MENTOR_CONCERNS;
    if (view === "urgent") return MENTOR_CONCERNS.filter((c) => c.priority === "urgent");
    return MENTOR_CONCERNS.filter((c) => c.status === view);
  }, [view]);

  const tabs = [
    { id: "all", label: "All", count: MENTOR_CONCERNS.length },
    { id: "urgent", label: "Urgent", count: MENTOR_CONCERNS.filter((c) => c.priority === "urgent").length },
    { id: "new", label: "New", count: MENTOR_CONCERNS.filter((c) => c.status === "new").length },
    { id: "investigating", label: "Investigating", count: MENTOR_CONCERNS.filter((c) => c.status === "investigating").length },
    { id: "awaiting_employer", label: "Awaiting Employer", count: MENTOR_CONCERNS.filter((c) => c.status === "awaiting_employer").length },
    { id: "monitoring", label: "Monitoring", count: MENTOR_CONCERNS.filter((c) => c.status === "monitoring").length },
  ];

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Employers"
      title="Employer Concerns"
      description="GTA-first case management. Learners do not automatically see the employer’s raw concern. Opens the shared concern case."
      fromLifecycle={filters.from === "lifecycle"}
    >
      <ViewTabs
        tabs={tabs}
        active={view}
        basePath={`${MENTOR_BASE}/employer-concerns`}
        preserve={{ from: filters.from }}
      />
      <MentorTable
        columns={[
          "Case ref",
          "Employer",
          "Learner",
          "Programme",
          "Type",
          "Priority",
          "Raised",
          "Employment risk",
          "Welfare",
          "Assignee",
          "Status",
          "Next action",
          "Open",
        ]}
        empty={filtered.length === 0}
      >
        {filtered.map((c) => (
          <tr key={c.caseId}>
            <td>
              <Link
                className={queueStyles.rowLink}
                href={`/employer-concerns/${c.caseId}?from=mentor-concerns`}
              >
                {c.caseReference}
              </Link>
            </td>
            <td>{c.employerName}</td>
            <td>{c.learnerName}</td>
            <td>{c.programmeName}</td>
            <td>{c.concernType}</td>
            <td>
              <StatusChip tone={c.priority === "urgent" ? "red" : "amber"}>
                {c.priority}
              </StatusChip>
            </td>
            <td>{c.dateRaised}</td>
            <td>{c.employmentRisk ? "Yes" : "No"}</td>
            <td>{c.welfareImpact ? "Yes" : "No"}</td>
            <td>{c.assignedStaff}</td>
            <td>{c.status.replace(/_/g, " ")}</td>
            <td>{c.nextAction}</td>
            <td>
              <Link href={`/employer-concerns/${c.caseId}?from=mentor-concerns`}>
                Open
              </Link>
            </td>
          </tr>
        ))}
      </MentorTable>
    </MentorPageShell>
  );
}
