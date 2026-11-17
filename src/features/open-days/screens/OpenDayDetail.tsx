"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { FormField, Select, StatusBadge, TextArea, type StatusTone } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import admin from "@/features/administration/screens/admin-pages.module.css";
import { saveBookingNotesAction, setBookingStatusAction } from "../actions";
import { bookingsToCsv, filterBookings, type BookingTab } from "../domain/bookings";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  OPEN_DAY_STATUS_LABELS,
  bookingCountSummary,
  bookingName,
  formatSubmitted,
  formatTimeRange,
  formatUkDate,
  openDayLocation,
  openDaysPath,
  spacePackageLabel,
  vehicleSummary,
} from "../domain/format";
import {
  BOOKING_STATUSES,
  type BookingRecord,
  type BookingStatus,
  type OpenDayRecord,
  type OpenDayStatus,
  type OpenDaysMode,
} from "../domain/types";
import local from "./open-days.module.css";
import { OpenDaysNotice } from "./OpenDaysNotice";

function dayTone(status: OpenDayStatus): StatusTone {
  if (status === "published") return "on_track";
  if (status === "closed") return "monitoring";
  if (status === "cancelled") return "priority";
  return "neutral";
}

function bookingTone(status: BookingStatus): StatusTone {
  if (status === "confirmed") return "on_track";
  if (status === "checked_in") return "checked";
  if (status === "pending" || status === "waitlist") return "review";
  return "priority";
}

export function OpenDayDetail({
  workspace,
  day,
  bookings,
  mode,
}: {
  workspace: "administration" | "management";
  day: OpenDayRecord;
  bookings: BookingRecord[];
  mode: OpenDaysMode;
}) {
  const locked = mode.example || Boolean(mode.savingMessage);
  const [rows, setRows] = useState(bookings);
  const [seen, setSeen] = useState(bookings);
  const [tab, setTab] = useState<BookingTab>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (seen !== bookings) {
    setSeen(bookings);
    setRows(bookings);
  }

  const visible = filterBookings(rows, { tab, query, status });
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const counts = {
    all: rows.length,
    exhibitor: rows.filter((row) => row.bookingType === "exhibitor").length,
    trade_stand: rows.filter((row) => row.bookingType === "trade_stand").length,
  };

  function exportCsv() {
    const csv = bookingsToCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${day.slug || day.id}-bookings.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ApprenticePageShell
      eyebrow="Marketing & Recruitment"
      title={day.title}
      description={`${day.dateLabel ?? formatUkDate(day.dateOn)} · ${formatTimeRange(day.startTime, day.endTime)} · ${openDayLocation(day)}`}
      actions={
        <Link className={admin.secondaryBtn} href={openDaysPath(workspace, day.id, "edit")}>
          Edit open day
        </Link>
      }
    >
      <div className={admin.stack} data-open-days="detail">
        <OpenDaysNotice banner={mode.banner} savingMessage={mode.savingMessage} error={mode.error} />
        <div className={local.detailGrid}>
          <section className={admin.formGroup}>
            <div className={local.badgeRow}>
              <StatusBadge tone={dayTone(day.status)}>{OPEN_DAY_STATUS_LABELS[day.status]}</StatusBadge>
              <StatusBadge tone={day.bookingsOpen ? "on_track" : "monitoring"}>
                {day.bookingsOpen ? "Bookings open" : "Bookings closed"}
              </StatusBadge>
            </div>
            {day.description ? <p className={admin.panelLead}>{day.description}</p> : null}
            <p className={local.cardMeta}>{bookingCountSummary(day, true)}</p>
          </section>
          <section className={admin.formGroup}>
            <h2 className={admin.formGroupTitle}>Listing</h2>
            {day.heroImageUrl ? (
              // Staff paste any image address. next/image cannot allow those hosts in advance.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={local.hero} src={day.heroImageUrl} alt="" />
            ) : (
              <p className={local.cardMeta}>No hero image.</p>
            )}
            <p className={local.cardMeta}>{formatUkDate(day.dateOn)}</p>
            <p className={local.cardMeta}>{openDayLocation(day)}</p>
          </section>
        </div>

        <section className={admin.stack} aria-labelledby="bookings-heading">
          <div className={admin.toolbar}>
            <h2 id="bookings-heading" className={admin.formGroupTitle}>
              Bookings
            </h2>
            <button type="button" className={admin.secondaryBtn} onClick={exportCsv}>
              Export CSV
            </button>
          </div>
          <div className={admin.tabRow} aria-label="Booking type">
            <TabButton active={tab === "all"} onClick={() => setTab("all")} count={counts.all}>
              All
            </TabButton>
            <TabButton active={tab === "exhibitor"} onClick={() => setTab("exhibitor")} count={counts.exhibitor}>
              Exhibitors
            </TabButton>
            <TabButton active={tab === "trade_stand"} onClick={() => setTab("trade_stand")} count={counts.trade_stand}>
              Trade stands
            </TabButton>
          </div>
          <div className={local.filters}>
            <label className={`${admin.registrySearch} ${local.grow}`}>
              <span className={admin.registrySearchLabel}>Search bookings</span>
              <input
                type="search"
                value={query}
                placeholder="Name, email, phone, company, registration"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <FormField label="Status">
              <Select
                aria-label="Status"
                value={status}
                options={[
                  { value: "all", label: "All statuses" },
                  ...BOOKING_STATUSES.map((item) => ({ value: item, label: BOOKING_STATUS_LABELS[item] })),
                ]}
                onChange={(value) => setStatus(value === "all" ? "all" : (value as BookingStatus))}
              />
            </FormField>
          </div>
          {visible.length === 0 ? (
            <p className={admin.empty} role="status">
              No bookings match.
            </p>
          ) : (
            <div className={`${admin.panel} ${admin.tableWrap}`}>
              <table className={admin.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Vehicles or trade stand</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className={admin.clickableRow}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open booking for ${bookingName(row.firstName, row.lastName)}`}
                      data-booking-id={row.id}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.id);
                        }
                      }}
                    >
                      <td>{bookingName(row.firstName, row.lastName)}</td>
                      <td>{row.email}</td>
                      <td>{row.phone}</td>
                      <td>{BOOKING_TYPE_LABELS[row.bookingType]}</td>
                      <td>
                        <StatusBadge tone={bookingTone(row.status)}>{BOOKING_STATUS_LABELS[row.status]}</StatusBadge>
                      </td>
                      <td>{formatSubmitted(row.submittedAt)}</td>
                      <td>{detailsCell(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p>
          <Link className={admin.secondaryBtn} href={openDaysPath(workspace)}>
            All open days
          </Link>
        </p>
      </div>
      {selected ? (
        <BookingDrawer
          booking={selected}
          locked={locked}
          savingMessage={mode.savingMessage}
          onClose={() => setSelectedId(null)}
          onChange={(next) => setRows((current) => current.map((row) => (row.id === next.id ? next : row)))}
        />
      ) : null}
    </ApprenticePageShell>
  );
}

function detailsCell(row: BookingRecord): string {
  if (row.bookingType === "trade_stand") {
    return [row.companyName, row.businessType, spacePackageLabel(row.spacePackageId), row.vehicleRegs]
      .filter(Boolean)
      .join(" · ");
  }
  if (row.vehicles.length === 0) return "No vehicles";
  const first = vehicleSummary(row.vehicles[0]);
  return row.vehicles.length > 1 ? `${first} +${row.vehicles.length - 1}` : first;
}

function TabButton({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count: number;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? admin.tabActive : admin.tab} aria-pressed={active} onClick={onClick}>
      {children}
      <span className={admin.tabCount}>{count}</span>
    </button>
  );
}

function BookingDrawer({
  booking,
  locked,
  savingMessage,
  onClose,
  onChange,
}: {
  booking: BookingRecord;
  locked: boolean;
  savingMessage: string | null;
  onClose: () => void;
  onChange: (booking: BookingRecord) => void;
}) {
  const titleId = useId();
  const [notes, setNotes] = useState(booking.staffNotes ?? "");
  const [seenId, setSeenId] = useState(booking.id);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  if (seenId !== booking.id) {
    setSeenId(booking.id);
    setNotes(booking.staffNotes ?? "");
    setError(null);
    setConfirmCancel(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function runStatus(status: "checked_in" | "cancelled") {
    if (locked) {
      setError(savingMessage ?? "Saving is disabled.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setBookingStatusAction({
        bookingId: booking.id,
        openDayId: booking.openDayId,
        status,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onChange({ ...booking, status, staffNotes: notes.trim() || null });
      setConfirmCancel(false);
    });
  }

  function saveNotes() {
    if (locked) {
      setError(savingMessage ?? "Saving is disabled.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveBookingNotesAction({
        bookingId: booking.id,
        openDayId: booking.openDayId,
        notes,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onChange({ ...booking, staffNotes: notes.trim() || null });
    });
  }

  const cancelled = booking.status === "cancelled";
  return (
    <>
      <button type="button" className={local.backdrop} aria-label="Close booking details" onClick={onClose} />
      <aside className={local.drawer} role="dialog" aria-modal="true" aria-labelledby={titleId} data-booking-drawer="">
        <div className={local.drawerHead}>
          <div>
            <h2 id={titleId} className={admin.formGroupTitle}>
              {bookingName(booking.firstName, booking.lastName)}
            </h2>
            <p className={local.cardMeta}>
              {booking.email} · {booking.phone}
            </p>
          </div>
          <button type="button" className={`${admin.secondaryBtn} ${admin.compactBtn}`} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={local.badgeRow}>
          <StatusBadge tone="neutral">{BOOKING_TYPE_LABELS[booking.bookingType]}</StatusBadge>
          <StatusBadge tone={bookingTone(booking.status)}>{BOOKING_STATUS_LABELS[booking.status]}</StatusBadge>
        </div>
        <p className={local.cardMeta}>Submitted {formatSubmitted(booking.submittedAt)}</p>
        {booking.bookingType === "exhibitor" ? (
          <div>
            <h3 className={admin.formGroupTitle}>Vehicles</h3>
            {booking.vehicles.length === 0 ? (
              <p className={local.cardMeta}>No vehicles recorded.</p>
            ) : (
              <ul className={local.vehicleList}>
                {booking.vehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    <strong>{vehicleSummary(vehicle)}</strong>
                    <div className={local.cardMeta}>
                      {[vehicle.category, vehicle.carClub].filter(Boolean).join(" · ") || "No category or car club"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ul className={local.detailList}>
            <li>
              <strong>Company.</strong> {booking.companyName || "Not recorded"}
            </li>
            <li>
              <strong>Business type.</strong> {booking.businessType || "Not recorded"}
            </li>
            <li>
              <strong>Space package.</strong> {spacePackageLabel(booking.spacePackageId) || "Not recorded"}
            </li>
            <li>
              <strong>Vehicle regs.</strong> {booking.vehicleRegs || "Not recorded"}
            </li>
            <li>
              <strong>Insurance confirmed.</strong> {booking.insuranceConfirmed ? "Yes" : "No"}
            </li>
            <li>
              <strong>Risk assessment confirmed.</strong> {booking.riskAssessmentConfirmed ? "Yes" : "No"}
            </li>
          </ul>
        )}
        <FormField label="Staff notes">
          <TextArea
            value={notes}
            disabled={locked || pending}
            rows={4}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        {locked ? <p className={admin.formGroupMeta}>{savingMessage}</p> : null}
        {error ? (
          <p className={admin.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={admin.formActions}>
          <button type="button" className={admin.secondaryBtn} disabled={locked || pending} onClick={saveNotes}>
            Save notes
          </button>
          <button
            type="button"
            className={admin.primaryBtn}
            disabled={locked || pending || cancelled || booking.status === "checked_in"}
            onClick={() => runStatus("checked_in")}
          >
            Check in
          </button>
          {confirmCancel ? (
            <button
              type="button"
              className={admin.dangerBtn}
              disabled={locked || pending}
              onClick={() => runStatus("cancelled")}
            >
              Confirm cancel
            </button>
          ) : (
            <button
              type="button"
              className={admin.dangerBtn}
              disabled={locked || pending || cancelled}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel booking
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
