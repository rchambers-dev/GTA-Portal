import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const result = await supabase.rpc("ensure_tutor_review_rounds");
    if (result.error) return NextResponse.json({ error: "The rounds could not be created." }, { status: 500 });
    return NextResponse.json({ created: result.data ?? 0 });
  } catch {
    return NextResponse.json({ error: "The rounds could not be created." }, { status: 503 });
  }
}
