import type { User } from "@supabase/supabase-js";
import type { SessionUser } from "@/features/apprentice-lifecycle/types";
import type { EffectiveSession, PortalAccount, WorkspaceId } from "@/lib/portal/types";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { createSupabaseServerClient } from "./client";

type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  base_role: string | null;
  workspace: string | null;
  permissions: string[] | null;
  responsibilities: string[] | null;
  department: string | null;
  department_scope: string[] | null;
  programme_scope: string[] | null;
  module_scope: string[] | null;
};

function asWorkspaceId(value: string | null | undefined): WorkspaceId {
  switch (value) {
    case "apprentice":
    case "employer":
    case "staff":
    case "quality":
    case "management":
    case "administration":
    case "safeguarding":
      return value;
    default:
      return "management";
  }
}

function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "SA";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function toPortalAccount(user: User, profile: ProfileRow): PortalAccount {
  const displayName =
    profile.display_name?.trim() ||
    user.user_metadata.display_name ||
    user.user_metadata.name ||
    profile.username?.trim() ||
    user.email?.split("@")[0] ||
    "Portal user";

  return {
    id: profile.id,
    name: displayName,
    initials: initialsFromName(displayName),
    email: profile.email || user.email || "",
    username: profile.username?.trim() || undefined,
    baseRole: profile.base_role?.trim() || "Owner",
    responsibilities: profile.responsibilities ?? [],
    department: profile.department?.trim() || undefined,
    workspace: asWorkspaceId(profile.workspace),
    permissions: profile.permissions ?? [],
    departmentScope: profile.department_scope ?? undefined,
    programmeScope: profile.programme_scope ?? undefined,
    moduleScope: profile.module_scope ?? undefined,
  };
}

function toSessionUser(account: PortalAccount): SessionUser {
  return {
    id: account.id,
    displayName: account.name,
    email: account.email,
    roles: [],
    primaryRoleLabel: account.responsibilities.length
      ? `${account.baseRole} · ${account.responsibilities.join(" · ")}`
      : account.baseRole,
  };
}

export async function getSupabaseEffectiveSession(): Promise<EffectiveSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, username, display_name, base_role, workspace, permissions, responsibilities, department, department_scope, programme_scope, module_scope",
    )
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error || !profile) return null;

  return {
    account: toPortalAccount(user, profile),
    permissions: profile.permissions ?? [],
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

export const supabaseAuthAdapter = {
  async getSessionUser(): Promise<SessionUser | null> {
    const session = await getSupabaseEffectiveSession();
    return session ? toSessionUser(session.account) : null;
  },

  async getEffectiveSession(): Promise<EffectiveSession | null> {
    return getSupabaseEffectiveSession();
  },

  can(session: EffectiveSession, permission: string): boolean {
    return hasPermission(session, permission);
  },
};
