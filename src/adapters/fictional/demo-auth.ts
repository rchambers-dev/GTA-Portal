import { cookies } from "next/headers";
import type { SessionUser } from "@/features/apprentice-lifecycle/types";
import type { EffectiveSession } from "@/lib/portal/types";
import { buildEffectiveSession, hasPermission } from "@/lib/permissions/effective-permissions";
import {
  DEFAULT_DEMO_ACCOUNT_ID,
  DEMO_ACCOUNTS,
  formatRoleLabel,
  getDemoAccountById,
} from "./demo-accounts";
import {
  DEMO_COOKIE_ACCOUNT,
  DEMO_COOKIE_ASSIGNMENTS,
  isDemoModeEnabled,
  parseAssignmentsCookie,
} from "./demo-session";

function toSessionUser(session: EffectiveSession): SessionUser {
  const { account } = session;
  return {
    id: account.id,
    displayName: account.name,
    email: account.email,
    roles: [],
    primaryRoleLabel: formatRoleLabel({
      ...account,
      responsibilities: [
        ...account.responsibilities,
        ...session.temporaryAccessLabels,
      ],
    }),
  };
}

export async function getServerEffectiveSession(): Promise<EffectiveSession | null> {
  // Live mode uses the Supabase auth adapter — never fall back to a demo account.
  if (!isDemoModeEnabled()) return null;

  const cookieStore = await cookies();
  const accountId =
    cookieStore.get(DEMO_COOKIE_ACCOUNT)?.value ?? DEFAULT_DEMO_ACCOUNT_ID;
  const account = getDemoAccountById(accountId) ?? getDemoAccountById(DEFAULT_DEMO_ACCOUNT_ID);
  if (!account) return null;

  const assignmentsRaw = cookieStore.get(DEMO_COOKIE_ASSIGNMENTS)?.value;
  const assignments = parseAssignmentsCookie(assignmentsRaw);

  return buildEffectiveSession(account, assignments);
}

export const demoAuthAdapter = {
  async getSessionUser(): Promise<SessionUser | null> {
    const session = await getServerEffectiveSession();
    if (!session) return null;
    return toSessionUser(session);
  },

  async getEffectiveSession(): Promise<EffectiveSession | null> {
    return getServerEffectiveSession();
  },

  can(session: EffectiveSession, permission: string): boolean {
    return hasPermission(session, permission);
  },
};

export { DEMO_ACCOUNTS };
