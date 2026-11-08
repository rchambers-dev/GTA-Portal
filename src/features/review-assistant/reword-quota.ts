import { createSupabaseAdminClient } from "@/adapters/supabase/client";

const HOUR_LIMIT = 20;
const DAY_LIMIT = 100;

function startOfHour(now: Date) {
  const value = new Date(now);
  value.setUTCMinutes(0, 0, 0);
  return value.toISOString();
}

function startOfDay(now: Date) {
  const value = new Date(now);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString();
}

export function reviewRewordEnabled() {
  return process.env.REVIEW_ASSISTANT_AI === "on";
}

/**
 * Uses the applied public.rate_limit_hit wrapper. A generic AI key does not enable this.
 * The applied function deletes buckets older than two hours, so the day row is also
 * written with the current hour as its bucket time and a day key. The day call's
 * max_hits is the daily cap for that row; a denied call stops before any model request.
 */
export async function consumeReviewRewordQuota(actorId: string, now = new Date()) {
  const supabase = createSupabaseAdminClient();
  const checks: Array<[string, string, number]> = [
    ["review-reword-day", startOfDay(now), DAY_LIMIT],
    ["review-reword-hour", startOfHour(now), HOUR_LIMIT],
  ];
  for (const [bucketKey, bucketStart, maxHits] of checks) {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      actor_id: actorId,
      bucket_key: bucketKey,
      bucket_start: bucketStart,
      max_hits: maxHits,
    });
    if (error || data !== true) {
      return { ok: false as const, error: "AI wording is rate limited. Try again later." };
    }
  }
  return { ok: true as const };
}
