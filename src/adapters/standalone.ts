import { supabaseAuthAdapter } from "@/adapters/supabase/auth";
import { supabaseApprenticeDataAdapter } from "@/adapters/supabase/apprentice-data";
import type { AuthPort, ApprenticeLifecycleDataPort } from "@/features/apprentice-lifecycle/ports";
import type { EffectiveSession } from "@/lib/portal/types";
import { pageGrantsFromStore } from "@/features/staff-page-access/enforce";

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
    auth: {
      ...supabaseAuthAdapter,
      async getEffectiveSession() {
        const session = await supabaseAuthAdapter.getEffectiveSession();
        if (!session || session.pageGrants) return session;
        return {
          ...session,
          pageGrants: await pageGrantsFromStore(session.account),
        };
      },
    },
    data: supabaseApprenticeDataAdapter,
  };
}
