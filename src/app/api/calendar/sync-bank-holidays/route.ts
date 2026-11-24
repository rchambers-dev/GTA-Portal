import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    const response = await fetch("https://www.gov.uk/bank-holidays.json");
    if (!response.ok) return NextResponse.json({ error: "GOV.UK bank holidays could not be read." }, { status: 502 });
    const body = (await response.json()) as {
      "england-and-wales"?: { events?: { title?: string; date?: string }[] };
    };
    const events = (body["england-and-wales"]?.events ?? [])
      .filter((event) => event.date)
      .map((event) => ({ title: event.title ?? "Bank holiday", date: event.date }));
    const supabase = createSupabaseAdminClient();
    const result = await supabase.rpc("sync_bank_holidays", { p_events: events });
    if (result.error) return NextResponse.json({ error: "Bank holidays could not be saved." }, { status: 500 });
    return NextResponse.json({ synced: result.data ?? 0 });
  } catch {
    return NextResponse.json({ error: "Bank holidays could not be saved." }, { status: 503 });
  }
}
