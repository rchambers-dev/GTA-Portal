import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { parseTutorReviewEmailEvent, verifyEmailWebhook } from "@/features/tutor-reviews/domain/email-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyEmailWebhook({ secret: process.env.TUTOR_REVIEW_EMAIL_WEBHOOK_SECRET, rawBody, headers: request.headers })) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "The webhook body must be JSON." }, { status: 400 });
  }
  const event = parseTutorReviewEmailEvent(body);
  if (!event) return NextResponse.json({ error: "That webhook event was not recognised." }, { status: 400 });
  if (event.status === "delivered") return NextResponse.json({ updated: 0 });
  try {
    const supabase = createSupabaseAdminClient();
    const result = await supabase.rpc("apply_tutor_review_email_event", {
      p_provider_message_id: event.providerMessageId,
      p_status: event.status,
      p_error: event.reason,
    });
    if (result.error) return NextResponse.json({ error: "The email event could not be recorded." }, { status: 500 });
    return NextResponse.json({ updated: result.data ?? 0 });
  } catch {
    return NextResponse.json({ error: "The email event could not be recorded." }, { status: 503 });
  }
}
