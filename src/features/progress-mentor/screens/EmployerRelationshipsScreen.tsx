"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MENTOR_EMPLOYERS } from "../data/mentor-caseload";
import {
  MentorPageShell,
  MentorTable,
  StatusChip,
} from "../components/MentorWorkQueue";
import queueStyles from "../components/MentorWorkQueue.module.css";

export function EmployerRelationshipsScreen({
  fromLifecycle,
}: {
  fromLifecycle?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [engagement, setEngagement] = useState("all");

  const rows = useMemo(() => {
    return MENTOR_EMPLOYERS.filter((e) => {
      if (
        search.trim() &&
        !e.name.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      if (engagement !== "all" && e.engagementStatus !== engagement) return false;
      return true;
    });
  }, [search, engagement]);

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Employers"
      title="Employer Relationships"
      description="Engagement, commitments and contact — not just a contact list. Opens the shared employer record."
      fromLifecycle={fromLifecycle}
      toolbar={
        <div className={queueStyles.filters}>
          <input
            className={queueStyles.filterInput}
            placeholder="Search employer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={queueStyles.filterSelect}
            value={engagement}
            onChange={(e) => setEngagement(e.target.value)}
          >
            <option value="all">All engagement</option>
            <option value="strong">Strong</option>
            <option value="steady">Steady</option>
            <option value="low">Low</option>
            <option value="at_risk">At risk</option>
          </select>
        </div>
      }
    >
      <MentorTable
        columns={[
          "Employer",
          "Main contact",
          "Apprentices",
          "Programmes",
          "Last contact",
          "Next contact",
          "Review attendance",
          "Open commitments",
          "Overdue",
          "Concerns",
          "Engagement",
          "Open",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((e) => (
          <tr key={e.employerId}>
            <td>
              <Link
                className={queueStyles.rowLink}
                href={`/employers/${e.employerId}?from=employer-relationships`}
              >
                {e.name}
              </Link>
            </td>
            <td>{e.mainContact}</td>
            <td>{e.activeApprentices}</td>
            <td>{e.programmes.join(", ")}</td>
            <td>{e.lastContact ?? "—"}</td>
            <td>{e.nextContact ?? "—"}</td>
            <td>{e.reviewAttendanceRate}%</td>
            <td>{e.openCommitments}</td>
            <td>
              <StatusChip tone={e.overdueCommitments > 0 ? "red" : "green"}>
                {e.overdueCommitments}
              </StatusChip>
            </td>
            <td>{e.openConcerns}</td>
            <td>
              <StatusChip
                tone={
                  e.engagementStatus === "strong"
                    ? "green"
                    : e.engagementStatus === "at_risk" || e.engagementStatus === "low"
                      ? "red"
                      : "amber"
                }
              >
                {e.engagementStatus.replace(/_/g, " ")}
              </StatusChip>
            </td>
            <td>
              <Link href={`/employers/${e.employerId}?from=employer-relationships`}>
                Open
              </Link>
            </td>
          </tr>
        ))}
      </MentorTable>
    </MentorPageShell>
  );
}
