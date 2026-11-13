"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { rebookAppointmentArgs } from "../domain/rebook-appointment";
import { timeToMinutes, weekdayName } from "../domain/plan-due";
import { readRebookMonth, type RebookMonthDay } from "../domain/plan-repository";

const DENIED = "You do not have permission to change the plan. Administrator and Management can.";

async function writer() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to change the plan." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

function fail(error: { message?: string } | null): { ok: false; formError: string } | null {
  if (!error) return null;
  return { ok: false, formError: error.message || "The plan could not be saved." };
}

export async function pinOnDayAction(input: { date: string; gtaIds: string[] }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("set_review_day_pins", {
    p_date: input.date,
    p_gta_ids: input.gtaIds,
  });
  return fail(error) ?? { ok: true as const };
}

export async function excludeStopAction(input: { date: string; gtaId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("exclude_review_day_stop", {
    p_date: input.date,
    p_gta_id: input.gtaId,
  });
  return fail(error) ?? { ok: true as const };
}

export async function verifyStopAction(input: {
  date: string;
  gtaId: string;
  verified: boolean;
  arrive: string;
  leave: string;
  dayGtaIds: string[];
}) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("verify_review_day_stop", {
    p_date: input.date,
    p_gta_id: input.gtaId,
    p_verified: input.verified,
    p_arrive: timeToMinutes(input.arrive),
    p_leave: timeToMinutes(input.leave),
    p_day_gta_ids: input.dayGtaIds,
  });
  return fail(error) ?? { ok: true as const };
}

export async function lockStopAction(input: {
  date: string;
  gtaId: string;
  arrive: string;
  leave: string;
  until: string;
}) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("lock_review_day_stop", {
    p_date: input.date,
    p_gta_id: input.gtaId,
    p_arrive: timeToMinutes(input.arrive),
    p_leave: timeToMinutes(input.leave),
    p_until_minutes: timeToMinutes(input.until) ?? 23 * 60 + 45,
  });
  return fail(error) ?? { ok: true as const };
}

export async function unlockStopAction(input: { gtaId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("unlock_review_day_stop", { p_gta_id: input.gtaId });
  return fail(error) ?? { ok: true as const };
}

export async function bookReviewAction(input: {
  reviewId: string;
  method: string;
  date: string;
  time: string;
  phoneDay: string;
}) {
  const access = await writer();
  if (!access.ok) return access;
  const method = input.method === "teams" || input.method === "phone" ? input.method : "in_person";
  const { error } = await access.supabase.rpc("book_review", {
    p_review_id: input.reviewId,
    p_method: method,
    p_on: method === "phone" ? null : input.date,
    p_minutes: method === "phone" ? null : timeToMinutes(input.time),
    p_phone_day: method === "phone" ? input.phoneDay || weekdayName(input.date) : null,
  });
  return fail(error) ?? { ok: true as const };
}

export async function loadRebookMonthAction(month: string): Promise<{ ok: true; days: RebookMonthDay[] } | { ok: false; formError: string; days: [] }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, formError: "That month is not available.", days: [] };
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false, formError: "Sign in again to see that month.", days: [] };
  const supabase = await createSupabaseServerClient();
  const loaded = await readRebookMonth(supabase, month);
  if (loaded.error) return { ok: false, formError: loaded.error, days: [] };
  return { ok: true, days: loaded.days };
}

export async function rebookAppointmentAction(input: {
  reviewId: string;
  gtaId: string;
  missedDate: string;
  date: string | null;
  method: string;
  arriveMinutes: number | null;
  leaveMinutes: number | null;
  orderedGtaIds: string[];
  backToQueue: boolean;
}) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("rebook_review_appointment", rebookAppointmentArgs(input));
  return fail(error) ?? { ok: true as const };
}

export async function clearBookingAction(input: { reviewId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("clear_review_booking", { p_review_id: input.reviewId });
  return fail(error) ?? { ok: true as const };
}

export async function setNotesAction(input: { reviewId: string; notes: string; until: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const notes = input.notes.trim() || null;
  const planned = await access.supabase.rpc("set_review_plan_note", {
    p_review_id: input.reviewId,
    p_notes: notes,
    p_until: notes ? input.until || null : null,
  });
  if (!planned.error) return { ok: true as const };
  if (!/set_review_plan_note|notes_until/i.test(planned.error.message || "")) return fail(planned.error);
  const { error } = await access.supabase.rpc("set_review_notes", {
    p_review_id: input.reviewId,
    p_notes: notes,
  });
  return fail(error) ?? { ok: true as const, formError: "The note was saved. The end date is waiting for the notes migration." };
}

export async function acceptDayAction(input: {
  date: string;
  stops: { gtaId: string; kind: string; arrive: string; leave: string }[];
}) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("accept_review_day", {
    p_date: input.date,
    p_route: {
      stops: input.stops.map((stop) => ({
        gta_id: stop.gtaId,
        kind: stop.kind || "visit",
        arrive: timeToMinutes(stop.arrive),
        leave: timeToMinutes(stop.leave),
        travel_minutes: 0,
      })),
    },
  });
  return fail(error) ?? { ok: true as const };
}

export async function unlockDayAction(input: { date: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("unlock_review_day", { p_date: input.date });
  return fail(error) ?? { ok: true as const };
}

export async function completeDayAction(input: { date: string; gtaIds: string[] }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("complete_review_day", {
    p_date: input.date,
    p_gta_ids: input.gtaIds,
  });
  return fail(error) ?? { ok: true as const };
}

export async function reverseSafeguardingAction(input: { signoffId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("reverse_safeguarding_signoff", {
    p_signoff_id: input.signoffId,
    p_reason: "Cleared from the plan",
  });
  return fail(error) ?? { ok: true as const };
}

export async function applyRouteAction(input: {
  date: string;
  stops: { gtaId: string; arrive: number; leave: number }[];
}) {
  const access = await writer();
  if (!access.ok) return access;
  const pinned = await access.supabase.rpc("set_review_day_pins", {
    p_date: input.date,
    p_gta_ids: input.stops.map((stop) => stop.gtaId),
  });
  const pinError = fail(pinned.error);
  if (pinError) return pinError;
  for (const stop of input.stops) {
    const timed = await access.supabase.rpc("set_review_day_stop_times", {
      p_date: input.date,
      p_gta_id: stop.gtaId,
      p_arrive: stop.arrive,
      p_leave: stop.leave,
    });
    const timeError = fail(timed.error);
    if (timeError) return timeError;
  }
  return { ok: true as const };
}

export async function recordSafeguardingAction(input: { gtaId: string; date: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("record_safeguarding_signoff", {
    p_gta_id: input.gtaId,
    p_signed_on: input.date,
    p_notes: null,
  });
  return fail(error) ?? { ok: true as const };
}

export async function savePlanSettingsAction(input: {
  skipToday: boolean;
  officePostcode: string;
  startTime: string;
  callMinutes: number;
  lunchStart: string;
  lunchMinutes: number;
  returnBy: string;
  stayMinutes: number;
  extraEmails: string;
  hiddenTutorIds: string[];
  outEnabled: boolean;
}) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("update_review_settings", {
    p_skip_today: input.skipToday,
    p_office_postcode: input.officePostcode.trim(),
    p_start_time: input.startTime,
    p_call_minutes: input.callMinutes,
    p_lunch_start: input.lunchStart,
    p_lunch_minutes: input.lunchMinutes,
    p_return_by: input.returnBy,
    p_stay_minutes: input.stayMinutes,
    p_extra_emails: input.extraEmails
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    p_hidden_tutor_ids: input.hiddenTutorIds,
    p_out_enabled: input.outEnabled,
    p_report_auto_email: true,
  });
  return fail(error) ?? { ok: true as const };
}
