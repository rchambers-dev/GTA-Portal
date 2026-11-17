"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { OPEN_DAYS_PERMISSION_ERROR, canManageOpenDays } from "./domain/access";
import { ERROR_SAVING, FLAG_SAVING, TABLES_SAVING, openDaysFeatureOff, tablesMissing } from "./domain/missing";
import type { BookingMutationResult, OpenDayFormInput, OpenDayMutationResult } from "./domain/types";
import { validateOpenDay } from "./domain/validate";

function refresh(openDayId?: string) {
  revalidatePath("/administration/marketing/open-days");
  revalidatePath("/management/marketing/open-days");
  if (!openDayId) return;
  for (const workspace of ["administration", "management"] as const) {
    revalidatePath(`/${workspace}/marketing/open-days/${openDayId}`);
    revalidatePath(`/${workspace}/marketing/open-days/${openDayId}/edit`);
  }
}

function refused(error: { message?: string; code?: string }): string {
  if (tablesMissing(error.message, error.code)) return TABLES_SAVING;
  if (error.code === "23503") return "Choose a centre from the list.";
  if (error.code === "23514") return "Check the times, booking window, and trade stand capacity.";
  return error.message || "That change could not be saved.";
}

async function gate(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const session = await getSupabaseEffectiveSession();
  if (!session || !canManageOpenDays(session)) return { ok: false, message: OPEN_DAYS_PERMISSION_ERROR };
  if (openDaysFeatureOff()) return { ok: false, message: FLAG_SAVING };
  return { ok: true, userId: session.account.id };
}

export async function saveOpenDayAction(input: OpenDayFormInput): Promise<OpenDayMutationResult> {
  const allowed = await gate();
  if (!allowed.ok) return allowed;
  const knownCentres = input.locationMode === "centre" && input.centreId.trim() ? [{ id: input.centreId.trim() }] : [];
  const parsed = validateOpenDay(input, knownCentres);
  if (!parsed.ok) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (parsed.value.centreId) {
      const centre = await supabase
        .from("candidate_centres")
        .select("id")
        .eq("id", parsed.value.centreId)
        .maybeSingle();
      if (centre.error) {
        if (tablesMissing(centre.error.message, centre.error.code)) return { ok: false, message: TABLES_SAVING };
        return { ok: false, message: centre.error.message };
      }
      if (!centre.data) {
        return { ok: false, message: "Choose a centre from the list.", fieldErrors: { centreId: "Choose Doncaster or Sheffield." } };
      }
    }

    const row = {
      title: parsed.value.title,
      slug: parsed.value.slug,
      date_label: parsed.value.dateLabel,
      date_on: parsed.value.dateOn,
      start_time: parsed.value.startTime,
      end_time: parsed.value.endTime,
      centre_id: parsed.value.centreId,
      location_name: parsed.value.locationName,
      address: parsed.value.address,
      description: parsed.value.description,
      hero_image_url: parsed.value.heroImageUrl,
      status: parsed.value.status,
      bookings_open: parsed.value.bookingsOpen,
      bookings_open_from: parsed.value.bookingsOpenFrom,
      bookings_open_until: parsed.value.bookingsOpenUntil,
      capacity_trade_stands: parsed.value.capacityTradeStands,
      updated_by: allowed.userId,
    };

    let slug = row.slug;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const payload = { ...row, slug };
      const result = input.id
        ? await supabase.from("open_days").update(payload).eq("id", input.id).select("id").maybeSingle()
        : await supabase
            .from("open_days")
            .insert({ ...payload, created_by: allowed.userId })
            .select("id")
            .maybeSingle();
      if (!result.error && result.data && typeof result.data.id === "string") {
        refresh(result.data.id);
        return { ok: true, id: result.data.id };
      }
      if (result.error?.code === "23505" && attempt === 0) {
        slug = `${row.slug}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      if (result.error) return { ok: false, message: refused(result.error) };
      return { ok: false, message: input.id ? "That open day was not found." : "The open day could not be saved." };
    }
    return { ok: false, message: "The open day could not be saved." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message) || /Missing NEXT_PUBLIC_SUPABASE/.test(message)) {
      return { ok: false, message: TABLES_SAVING };
    }
    return { ok: false, message: message || ERROR_SAVING };
  }
}

export async function setBookingStatusAction(input: {
  bookingId: string;
  openDayId: string;
  status: "checked_in" | "cancelled";
}): Promise<BookingMutationResult> {
  const allowed = await gate();
  if (!allowed.ok) return allowed;
  if (input.status !== "checked_in" && input.status !== "cancelled") {
    return { ok: false, message: "Choose check-in or cancel." };
  }
  const now = new Date().toISOString();
  const patch =
    input.status === "checked_in"
      ? { status: "checked_in", checked_in_at: now, checked_in_by: allowed.userId }
      : { status: "cancelled", cancelled_at: now, cancelled_by: allowed.userId };

  try {
    const supabase = await createSupabaseServerClient();
    if (input.status === "checked_in") {
      const current = await supabase
        .from("open_day_bookings")
        .select("status")
        .eq("id", input.bookingId)
        .eq("open_day_id", input.openDayId)
        .maybeSingle();
      if (current.error) return { ok: false, message: refused(current.error) };
      if (!current.data) return { ok: false, message: "That booking was not found." };
      if (current.data.status === "cancelled") {
        return { ok: false, message: "Cancelled bookings cannot be checked in." };
      }
    }
    const result = await supabase
      .from("open_day_bookings")
      .update(patch)
      .eq("id", input.bookingId)
      .eq("open_day_id", input.openDayId)
      .select("id")
      .maybeSingle();
    if (result.error) return { ok: false, message: refused(result.error) };
    if (!result.data) return { ok: false, message: "That booking was not found." };
    refresh(input.openDayId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message) || /Missing NEXT_PUBLIC_SUPABASE/.test(message)) {
      return { ok: false, message: TABLES_SAVING };
    }
    return { ok: false, message: message || ERROR_SAVING };
  }
}

export async function saveBookingNotesAction(input: {
  bookingId: string;
  openDayId: string;
  notes: string;
}): Promise<BookingMutationResult> {
  const allowed = await gate();
  if (!allowed.ok) return allowed;
  const notes = input.notes.trim();
  if (notes.length > 4000) return { ok: false, message: "Notes are limited to 4000 characters." };
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .from("open_day_bookings")
      .update({ staff_notes: notes || null })
      .eq("id", input.bookingId)
      .eq("open_day_id", input.openDayId)
      .select("id")
      .maybeSingle();
    if (result.error) return { ok: false, message: refused(result.error) };
    if (!result.data) return { ok: false, message: "That booking was not found." };
    refresh(input.openDayId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message) || /Missing NEXT_PUBLIC_SUPABASE/.test(message)) {
      return { ok: false, message: TABLES_SAVING };
    }
    return { ok: false, message: message || ERROR_SAVING };
  }
}
