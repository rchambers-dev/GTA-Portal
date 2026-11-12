"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { hcaptchaEnabled } from "./captcha";

export type LoginActionState = {
  error: string | null;
};

function normaliseNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const captchaOn = hcaptchaEnabled();
  const captchaToken = String(formData.get("captchaToken") ?? "").trim();
  const next = normaliseNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  if (captchaOn && !captchaToken) {
    return { error: "Complete the security check, then try again." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    ...(captchaOn ? { options: { captchaToken } } : {}),
  });

  if (error) {
    return { error: error.message || "Unable to sign in." };
  }

  redirect(next);
}
