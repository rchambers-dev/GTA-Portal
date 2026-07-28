"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { isDemoModeEnabled } from "@/lib/env/portal";

export async function logoutAction(): Promise<void> {
  if (!isDemoModeEnabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
