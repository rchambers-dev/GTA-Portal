import { NextResponse } from "next/server";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { clipWords } from "@/features/reviews/domain/tutor-form-rules";

const HINTS: Record<string, string> = {
  summary: "Write a short tutor summary of last time from the previous tutor notes.",
  action: "Write a clear action the apprentice, employer or tutor should complete.",
  measure: "Write how success will be judged and what support is needed.",
  evidence: "Write evidence of progress from the work the tutor has seen, the workbook, or their own notes.",
  comment: "Write the GTA tutor contribution in the tutor's voice, from the work they have seen.",
};

export async function POST(request: Request) {
  const session = await getSupabaseEffectiveSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const role = session.account.baseRole;
  if (role !== "Tutor" && role !== "Administrator" && role !== "Management") {
    return NextResponse.json({ error: "Only a tutor can improve this wording." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { text?: string; field?: string; wordLimit?: number } | null;
  const text = body?.text?.trim() || "";
  if (!text) return NextResponse.json({ error: "Write something in this box first, then use AI to improve it." }, { status: 400 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set, so the wording was not sent to a model." },
      { status: 503 },
    );
  }
  const words = Number(body?.wordLimit) || 0;
  const field = body?.field || "evidence";
  const hint = HINTS[field] || HINTS.evidence;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You improve wording for a UK GTA apprenticeship tripartite progress review. ${hint} Write as the GTA tutor. Keep the same facts. Do not invent evidence, names, dates or outcomes. Use clear professional UK English. Return only the rewritten text.${words ? ` Use at most ${words} words.` : ""}`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!response.ok) {
    return NextResponse.json({ error: "The wording service did not respond." }, { status: 502 });
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const rewritten = clipWords(payload.choices?.[0]?.message?.content?.trim() || "", words || 400);
  if (!rewritten) return NextResponse.json({ error: "Could not improve this box." }, { status: 502 });
  return NextResponse.json({ text: rewritten });
}
