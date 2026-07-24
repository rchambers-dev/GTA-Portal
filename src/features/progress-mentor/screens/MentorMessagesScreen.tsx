"use client";

import Link from "next/link";
import { MENTOR_MESSAGES } from "../data/mentor-work-items";
import {
  MentorPageShell,
  MentorTable,
  StatusChip,
} from "../components/MentorWorkQueue";
import queueStyles from "../components/MentorWorkQueue.module.css";

function linkedHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "employer-concern":
      return `/employer-concerns/${id}`;
    case "intervention":
      return `/interventions/${id}`;
    case "action":
      return `/actions/${id}`;
    case "review":
      return `/reviews/${id}`;
    case "learner":
      return `/learners/${id}`;
    case "employer":
      return `/employers/${id}`;
    default:
      return null;
  }
}

export function MentorMessagesScreen() {
  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Communication"
      title="Messages"
      description="Conversations linked to learners, employers, reviews, actions, interventions and concern cases. Important outcomes must still be recorded on the official record."
    >
      <MentorTable
        columns={[
          "Type",
          "Subject",
          "Participants",
          "Linked record",
          "Last message",
          "Status",
        ]}
        empty={MENTOR_MESSAGES.length === 0}
      >
        {MENTOR_MESSAGES.map((m) => {
          const href = linkedHref(m.linkedType, m.linkedId);
          return (
            <tr key={m.messageId}>
              <td>{m.conversationType}</td>
              <td className={queueStyles.rowLink}>{m.subject}</td>
              <td>{m.participants}</td>
              <td>
                {href && m.linkedLabel ? (
                  <Link href={`${href}?from=messages`}>{m.linkedLabel}</Link>
                ) : (
                  "—"
                )}
              </td>
              <td>{new Date(m.lastMessageAt).toLocaleString("en-GB")}</td>
              <td>
                <StatusChip tone={m.unread ? "amber" : "neutral"}>
                  {m.unread ? "Unread" : "Read"}
                </StatusChip>
              </td>
            </tr>
          );
        })}
      </MentorTable>
    </MentorPageShell>
  );
}
