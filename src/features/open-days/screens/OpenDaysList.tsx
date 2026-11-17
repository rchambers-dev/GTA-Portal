import Link from "next/link";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import admin from "@/features/administration/screens/admin-pages.module.css";
import {
  OPEN_DAY_STATUS_LABELS,
  bookingCountSummary,
  formatTimeRange,
  formatUkDate,
  openDayLocation,
  openDaysPath,
} from "../domain/format";
import type { OpenDayRecord, OpenDayStatus, OpenDaysMode } from "../domain/types";
import local from "./open-days.module.css";
import { OpenDaysNotice } from "./OpenDaysNotice";

function statusTone(status: OpenDayStatus): StatusTone {
  if (status === "published") return "on_track";
  if (status === "closed") return "monitoring";
  if (status === "cancelled") return "priority";
  return "neutral";
}

export function OpenDaysList({
  workspace,
  days,
  mode,
}: {
  workspace: "administration" | "management";
  days: OpenDayRecord[];
  mode: OpenDaysMode;
}) {
  return (
    <ApprenticePageShell
      eyebrow="Marketing & Recruitment"
      title="Open days"
      description="Create the open day headers the public website will read, and open a day to see every sign-up."
      actions={
        <Link className={admin.primaryBtn} href={openDaysPath(workspace, "new")}>
          New open day
        </Link>
      }
    >
      <div className={admin.stack} data-open-days="list">
        <OpenDaysNotice banner={mode.banner} savingMessage={mode.savingMessage} error={mode.error} />
        {days.length === 0 ? (
          <p className={admin.empty} role="status">
            No open days yet.
          </p>
        ) : (
          <div className={local.cards}>
            {days.map((day) => (
              <article key={day.id} className={admin.formGroup} data-open-day-id={day.id}>
                <div className={admin.formGroupHead}>
                  <h2 className={local.cardTitle}>{day.title}</h2>
                  <StatusBadge tone={statusTone(day.status)}>{OPEN_DAY_STATUS_LABELS[day.status]}</StatusBadge>
                </div>
                <p className={local.cardMeta}>{day.dateLabel ?? formatUkDate(day.dateOn)}</p>
                {day.dateLabel ? <p className={local.cardMeta}>{formatUkDate(day.dateOn)}</p> : null}
                <p className={local.cardMeta}>{formatTimeRange(day.startTime, day.endTime)}</p>
                <p className={local.cardMeta}>{openDayLocation(day)}</p>
                <div className={local.badgeRow}>
                  <StatusBadge tone={day.bookingsOpen ? "on_track" : "monitoring"}>
                    {day.bookingsOpen ? "Bookings open" : "Bookings closed"}
                  </StatusBadge>
                </div>
                <p className={local.cardMeta}>{bookingCountSummary(day)}</p>
                <div className={admin.toolbarActions}>
                  <Link className={admin.primaryBtn} href={openDaysPath(workspace, day.id)}>
                    View bookings
                  </Link>
                  <Link className={admin.secondaryBtn} href={openDaysPath(workspace, day.id, "edit")}>
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
