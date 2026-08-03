import { fictionalDataAdapter } from "@/adapters/fictional";
import { demoAuthAdapter } from "@/adapters/fictional/demo-auth";
import { supabaseAuthAdapter } from "@/adapters/supabase/auth";
import { supabaseApprenticeDataAdapter } from "@/adapters/supabase/apprentice-data";
import type { AuthPort, ApprenticeLifecycleDataPort } from "@/features/apprentice-lifecycle/ports";
import { getDataAdapterMode, isDemoModeEnabled } from "@/lib/env/portal";
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
 * TEMPORARY composition root for the standalone shell.
 * On portal integration, replace this with portal auth + data adapters.
 */
export function getStandalonePorts(): StandalonePorts {
  if (!isDemoModeEnabled() && getDataAdapterMode() === "supabase") {
    return {
      auth: supabaseAuthAdapter,
      data: supabaseApprenticeDataAdapter,
    };
  }

  return {
    auth: demoAuthAdapter,
    data: fictionalDataAdapter,
  };
}
