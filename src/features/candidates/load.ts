import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { tablesMissing } from "./domain/missing";

export type CandidatesLoad = {
  ready: boolean;
  notice: string | null;
};

/** Empty, never a thrown error, when the candidates migration has not been applied. */
export async function loadCandidatesReady(): Promise<CandidatesLoad> {
  try {
    const supabase = await createSupabaseServerClient();
    const probe = await supabase.from("candidates").select("candidate_id").limit(1);
    if (probe.error) {
      if (tablesMissing(probe.error.message, probe.error.code)) {
        return { ready: false, notice: null };
      }
      return { ready: false, notice: probe.error.message };
    }
    return { ready: true, notice: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message)) return { ready: false, notice: null };
    return { ready: false, notice: message || "Candidates could not be loaded." };
  }
}
