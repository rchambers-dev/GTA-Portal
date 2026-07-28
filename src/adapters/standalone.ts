import { fictionalDataAdapter } from "@/adapters/fictional";
import { demoAuthAdapter } from "@/adapters/fictional/demo-auth";
import { supabaseAuthAdapter } from "@/adapters/supabase/auth";
import { supabaseLearnerDataAdapter } from "@/adapters/supabase/learner-data";
import type { AuthPort, LearnerLifecycleDataPort } from "@/features/learner-lifecycle/ports";
import { getDataAdapterMode, isDemoModeEnabled } from "@/lib/env/portal";
import type { EffectiveSession } from "@/lib/portal/types";

export type StandaloneAuthPort = AuthPort & {
  getEffectiveSession(): Promise<EffectiveSession | null>;
  can(session: EffectiveSession, permission: string): boolean;
};

export type StandalonePorts = {
  auth: StandaloneAuthPort;
  data: LearnerLifecycleDataPort;
};

/**
 * TEMPORARY composition root for the standalone shell.
 * On portal integration, replace this with portal auth + data adapters.
 */
export function getStandalonePorts(): StandalonePorts {
  if (!isDemoModeEnabled() && getDataAdapterMode() === "supabase") {
    return {
      auth: supabaseAuthAdapter,
      data: supabaseLearnerDataAdapter,
    };
  }

  return {
    auth: demoAuthAdapter,
    data: fictionalDataAdapter,
  };
}
