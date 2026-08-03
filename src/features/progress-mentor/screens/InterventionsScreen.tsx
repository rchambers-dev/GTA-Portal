"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MENTOR_INTERVENTIONS } from "../data/mentor-work-items";
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

export function InterventionsScreen({ filters }: Props) {
  const fromLifecycle = filters.from === "lifecycle";
  const view = filters.view ?? (filters.status === "active" ? "active" : "all");

  const filtered = useMemo(() => {
    let list = [...MENTOR_INTERVENTIONS];
    if (filters.priority === "high") {
      list = list.filter((i) => i.priority === "high");
    }
    if (filters.status === "active") {
      list = list.filter((i) =>
        ["active", "due_checkpoint", "improving", "no_improvement", "escalated"].includes(
          i.status,
        ),
      );
    }
    if (view !== "all") {
      list = list.filter((i) => i.status === view);
    }
    return list;
  }, [filters, view]);

  const tabs = [
    { id: "all", label: "All", count: MENTOR_INTERVENTIONS.length },
    { id: "active", label: "Active", count: MENTOR_INTERVENTIONS.filter((i) => i.status === "active").length },
    { id: "due_checkpoint", label: "Due for Checkpoint", count: MENTOR_INTERVENTIONS.filter((i) => i.status === "due_checkpoint").length },
    { id: "improving", label: "Improving", count: MENTOR_INTERVENTIONS.filter((i) => i.status === "improving").length },
    { id: "escalated", label: "Escalated", count: MENTOR_INTERVENTIONS.filter((i) => i.status === "escalated").length },
  ];

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Support"
      title="Interventions"
      description="Coordinated responses to recognised risk. Support plans live on the apprentice record and within interventions — not as a separate sidebar page."
      fromLifecycle={fromLifecycle}
    >
      <ViewTabs
        tabs={tabs}
        active={view}
        basePath={`${MENTOR_BASE}/interventions`}
        preserve={{
          from: filters.from,
          priority: filters.priority,
          status: filters.status,
        }}
      />
      <MentorTable
        columns={[
          "Apprentice",
          "Type",
          "Reason",
          "Desired outcome",
          "Owner",
          "Started",
          "Next checkpoint",
          "Impact",
          "Priority",
          "Status",
          "Open",
        ]}
        empty={filtered.length === 0}
      >
        {filtered.map((i) => (
          <tr key={i.interventionId}>
            <td>
              <Link
                className={queueStyles.rowLink}
                href={`/interventions/${i.interventionId}?from=mentor-interventions`}
              >
                {i.apprenticeName}
              </Link>
            </td>
            <td>{i.type}</td>
            <td>{i.reason}</td>
            <td>{i.desiredOutcome}</td>
            <td>{i.owner}</td>
            <td>{i.startDate}</td>
            <td>{i.nextCheckpoint}</td>
            <td>{i.currentImpact}</td>
            <td>
              <StatusChip tone={i.priority === "high" ? "red" : "amber"}>
                {i.priority}
              </StatusChip>
            </td>
            <td>{i.status.replace(/_/g, " ")}</td>
            <td>
              <Link
                href={`/interventions/${i.interventionId}?from=mentor-interventions`}
              >
                Open
              </Link>
            </td>
          </tr>
        ))}
      </MentorTable>
    </MentorPageShell>
  );
}
