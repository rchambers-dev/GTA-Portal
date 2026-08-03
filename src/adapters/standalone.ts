import { supabaseAuthAdapter } from "@/adapters/supabase/auth";
import { supabaseApprenticeDataAdapter } from "@/adapters/supabase/apprentice-data";
import type { AuthPort, ApprenticeLifecycleDataPort } from "@/features/apprentice-lifecycle/ports";
import type { EffectiveSession } from "@/lib/portal/types";

export type StandaloneAuthPort = AuthPort & {
  getEffectiveSession(): Promise<EffectiveSession | null>;
  can(session: EffectiveSession, permission: string): boolean;
};

export type StandalonePorts = {
  auth: StandaloneAuthPort;
  data: ApprenticeLifecycleDataPort;
};

/**
 * Composition root — live Supabase auth + apprentice data only.
 */
export function getStandalonePorts(): StandalonePorts {
  return {
    auth: supabaseAuthAdapter,
    data: supabaseApprenticeDataAdapter,
  };
}
