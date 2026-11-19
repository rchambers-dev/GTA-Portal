import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { addDays, minutesToTime } from "./plan-due";

export type OutStop = {
  gtaId: string;
  name: string;
  company: string;
  postcode: string;
  kind: string;
  arrive: string;
  leave: string;
  packId: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  signatures: { party: string; name: string }[];
};

export type OutDay = {
  date: string;
  accepted: boolean;
  completed: boolean;
  stops: OutStop[];
};

export type OutPage = {
  today: string;
  days: OutDay[];
  marksReady: boolean;
  loadError: string | null;
};

export async function loadOutPage(): Promise<OutPage> {
  const supabase = await createSupabaseServerClient();
  return readOutPage(supabase);
}

export async function readOutPage(supabase: SupabaseClient): Promise<OutPage> {
  const today = londonToday();
  const from = addDays(today, -14);
  const to = addDays(today, 21);
  const daysResult = await supabase
    .from("review_days")
    .select("date_on, accepted, completed_at")
    .gte("date_on", from)
    .lte("date_on", to)
    .order("date_on");
  if (daysResult.error) return { today, days: [], marksReady: false, loadError: daysResult.error.message };
  const dates = (daysResult.data ?? []).map((row) => row.date_on as string);
  if (!dates.length) return { today, days: [], marksReady: true, loadError: null };
  const stopsResult = await supabase
    .from("review_day_stops")
    .select("date_on, gta_id, sort_order, kind, arrive_minutes, leave_minutes")
    .in("date_on", dates)
    .eq("excluded", false)
    .order("sort_order");
  if (stopsResult.error) return { today, days: [], marksReady: false, loadError: stopsResult.error.message };
  const ids = [...new Set((stopsResult.data ?? []).map((row) => row.gta_id as string))];
  const [apprentices, jobs, employers, sites, reviews, packs, marks] = await Promise.all([
    ids.length
      ? supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name").in("gta_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("apprentice_employments").select("gta_id, employer_id, site_id").in("gta_id", ids).is("end_date", null)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("employers").select("employer_id, company_name"),
    supabase.from("employer_sites").select("id, postcode"),
    ids.length
      ? supabase.from("reviews").select("id, gta_id").in("gta_id", ids).eq("status", "open")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("review_packs").select("id, review_id, gta_id, stage"),
    supabase.from("review_visit_marks").select("date_on, gta_id, arrived_at, left_at").in("date_on", dates),
  ]);
  const marksReady = !marks.error;
  const names = new Map(
    ((apprentices.data ?? []) as { gta_id: string; first_name: string | null; middle_names: string | null; last_name: string | null }[]).map((row) => [
      row.gta_id,
      [row.first_name, row.middle_names, row.last_name].filter(Boolean).join(" "),
    ]),
  );
  const jobByGta = new Map(
    ((jobs.data ?? []) as { gta_id: string; employer_id: string | null; site_id: string | null }[]).map((row) => [row.gta_id, row]),
  );
  const company = new Map(((employers.data ?? []) as { employer_id: string; company_name: string }[]).map((row) => [row.employer_id, row.company_name]));
  const postcode = new Map(((sites.data ?? []) as { id: string; postcode: string }[]).map((row) => [row.id, row.postcode]));
  const openReview = new Map(((reviews.data ?? []) as { id: string; gta_id: string }[]).map((row) => [row.gta_id, row.id]));
  const packByReview = new Map(
    ((packs.data ?? []) as { id: string; review_id: string; stage: string }[])
      .filter((row) => row.stage === "booked" || row.stage === "reviewed")
      .map((row) => [row.review_id, row.id]),
  );
  const packIds = [...packByReview.values()];
  const signatures = packIds.length
    ? await supabase.from("review_signatures").select("pack_id, party, signer_name").in("pack_id", packIds)
    : { data: [], error: null };
  const signed = new Map<string, { party: string; name: string }[]>();
  for (const row of (signatures.data ?? []) as { pack_id: string; party: string; signer_name: string }[]) {
    const list = signed.get(row.pack_id) ?? [];
    list.push({ party: row.party, name: row.signer_name });
    signed.set(row.pack_id, list);
  }
  const markKey = new Map(
    ((marks.data ?? []) as { date_on: string; gta_id: string; arrived_at: string | null; left_at: string | null }[]).map((row) => [
      `${row.date_on}:${row.gta_id}`,
      row,
    ]),
  );
  const stopsByDate = new Map<string, OutStop[]>();
  for (const row of (stopsResult.data ?? []) as {
    date_on: string;
    gta_id: string;
    kind: string;
    arrive_minutes: number | null;
    leave_minutes: number | null;
  }[]) {
    const job = jobByGta.get(row.gta_id);
    const reviewId = openReview.get(row.gta_id);
    const packId = reviewId ? packByReview.get(reviewId) ?? null : null;
    const mark = markKey.get(`${row.date_on}:${row.gta_id}`);
    const list = stopsByDate.get(row.date_on) ?? [];
    list.push({
      gtaId: row.gta_id,
      name: names.get(row.gta_id) || row.gta_id,
      company: (job?.employer_id && company.get(job.employer_id)) || "No employer",
      postcode: (job?.site_id && postcode.get(job.site_id)) || "",
      kind: row.kind,
      arrive: minutesToTime(row.arrive_minutes),
      leave: minutesToTime(row.leave_minutes),
      packId,
      arrivedAt: mark?.arrived_at ?? null,
      leftAt: mark?.left_at ?? null,
      signatures: packId ? signed.get(packId) ?? [] : [],
    });
    stopsByDate.set(row.date_on, list);
  }
  const days: OutDay[] = ((daysResult.data ?? []) as { date_on: string; accepted: boolean; completed_at: string | null }[])
    .filter((row) => (stopsByDate.get(row.date_on) ?? []).length > 0)
    .map((row) => ({
      date: row.date_on,
      accepted: row.accepted,
      completed: Boolean(row.completed_at),
      stops: stopsByDate.get(row.date_on) ?? [],
    }));
  return { today, days, marksReady, loadError: null };
}
