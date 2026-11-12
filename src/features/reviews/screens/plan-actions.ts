"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { timeToMinutes, weekdayName } from "../domain/plan-due";

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

export async function clearBookingAction(input: { reviewId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("clear_review_booking", { p_review_id: input.reviewId });
  return fail(error) ?? { ok: true as const };
}

export async function setNotesAction(input: { reviewId: string; notes: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("set_review_notes", {
    p_review_id: input.reviewId,
    p_notes: input.notes.trim() || null,
  });
  return fail(error) ?? { ok: true as const };
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

export async function fillDayAction(input: {
  date: string;
  officePostcode: string;
  startTime: string;
  lunchStart: string;
  lunchMinutes: number;
  returnBy: string;
  stayMinutes: number;
  accepted: boolean;
  existing: string[];
  candidates: { gtaId: string; postcode: string; company: string; releaseDay: string }[];
}) {
  const access = await writer();
  if (!access.ok) return access;
  if (input.accepted) {
    return { ok: false as const, formError: "This route is already accepted. Unlock it before filling the day again." };
  }
  const weekday = weekdayName(input.date);
  const fresh = input.candidates.filter(
    (person) => !input.existing.includes(person.gtaId) && person.releaseDay !== weekday,
  );
  const points = await geocode([input.officePostcode, ...fresh.map((person) => person.postcode)]);
  const missing = fresh.filter((person) => !points.get(normalise(person.postcode)));
  const office = points.get(normalise(input.officePostcode));
  if (!office) {
    return { ok: false as const, formError: `Could not find the office postcode ${input.officePostcode}.` };
  }
  const ordered = nearest(office, fresh.filter((person) => points.get(normalise(person.postcode))), points);
  const ids = [...input.existing, ...ordered.map((person) => person.gtaId)];
  const pinned = await access.supabase.rpc("set_review_day_pins", { p_date: input.date, p_gta_ids: ids });
  const pinError = fail(pinned.error);
  if (pinError) return pinError;
  let cursor = timeToMinutes(input.startTime) ?? 10 * 60;
  const lunch = timeToMinutes(input.lunchStart) ?? 13 * 60;
  const lunchEnd = lunch + input.lunchMinutes;
  const backBy = timeToMinutes(input.returnBy) ?? 16 * 60 + 45;
  let previous = "";
  for (const person of ordered) {
    const same = previous === `${person.company}|${normalise(person.postcode)}`;
    const stay = same ? 15 : input.stayMinutes;
    if (cursor < lunch && cursor + stay > lunch) cursor = lunchEnd;
    if (cursor + stay > backBy) break;
    const leave = cursor + stay;
    const timed = await access.supabase.rpc("set_review_day_stop_times", {
      p_date: input.date,
      p_gta_id: person.gtaId,
      p_arrive: cursor,
      p_leave: leave,
    });
    const timeError = fail(timed.error);
    if (timeError) return timeError;
    cursor = leave + 20;
    previous = `${person.company}|${normalise(person.postcode)}`;
  }
  const missed = missing.map((person) => person.postcode).filter(Boolean);
  return {
    ok: true as const,
    formError: missed.length ? `Could not find: ${missed.join(", ")}` : null,
  };
}

function normalise(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function geocode(postcodes: string[]) {
  const unique = [...new Set(postcodes.map((item) => item.trim()).filter(Boolean))];
  const found = new Map<string, { lat: number; lon: number }>();
  if (!unique.length) return found;
  try {
    const response = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: unique }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        result?: { query: string; result?: { latitude: number; longitude: number } | null }[];
      };
      for (const row of body.result ?? []) {
        if (!row.result) continue;
        found.set(normalise(row.query), { lat: row.result.latitude, lon: row.result.longitude });
      }
    }
  } catch {
    return found;
  }
  return found;
}

function nearest<T extends { postcode: string }>(
  office: { lat: number; lon: number },
  people: T[],
  points: Map<string, { lat: number; lon: number }>,
): T[] {
  const left = [...people];
  const ordered: T[] = [];
  let here = office;
  while (left.length) {
    let best = 0;
    let bestKm = Number.POSITIVE_INFINITY;
    for (let index = 0; index < left.length; index += 1) {
      const point = points.get(normalise(left[index].postcode));
      if (!point) continue;
      const km = distance(here, point);
      if (km < bestKm) {
        bestKm = km;
        best = index;
      }
    }
    const [next] = left.splice(best, 1);
    ordered.push(next);
    here = points.get(normalise(next.postcode)) ?? here;
  }
  return ordered;
}

function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
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
