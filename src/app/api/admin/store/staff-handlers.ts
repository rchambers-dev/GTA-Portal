/**
 * Staff / profiles handlers for /api/admin/store.
 * Tables: profiles (+ portal_status, responsibilities as job titles).
 */

import { NextResponse } from "next/server";
import type { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { workspaceForRole } from "@/features/administration/domain/account-access";
import {
  EXCLUSIVE_STAFF_JOB_TITLES,
  normalizeJobTitles,
} from "@/features/administration/domain/staff-job-titles";
import type {
  AdminPortalRole,
  AdminPortalUser,
} from "@/features/administration/domain/types";
import type { UserInput } from "@/features/administration/domain/store";
import { generateTempPassword } from "@/features/administration/domain/temp-password";
import { isMissingSchemaError } from "./cohort-handlers";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type ProfileUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  base_role: string | null;
  workspace: string | null;
  department: string | null;
  responsibilities: string[] | null;
  linked_apprentice_id: string | null;
  portal_status: AdminPortalUser["status"] | null;
  enabled_by: string | null;
  enabled_at: string | null;
  disabled_by: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

const PROFILE_SELECT =
  "id, email, display_name, base_role, workspace, department, responsibilities, linked_apprentice_id, portal_status, enabled_by, enabled_at, disabled_by, disabled_at, created_at, updated_at";

function sanitizeUsernamePart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);
}

/** Prefer email local-part so "Reiss Chambers" doesn't collide with another Reiss. */
function preferredUsername(email: string, displayName: string): string {
  const fromEmail = sanitizeUsernamePart(email.split("@")[0] ?? "");
  if (fromEmail.length >= 2) return fromEmail;
  const fromName = sanitizeUsernamePart(
    displayName.split(/\s+/).join(".") || displayName,
  );
  return fromName || "user";
}

async function allocateUniqueUsername(
  supabase: SupabaseAdmin,
  preferred: string,
  excludeUserId?: string,
): Promise<string> {
  const base = (preferred || "user").slice(0, 40) || "user";
  for (let i = 0; i < 60; i += 1) {
    const candidate =
      i === 0 ? base : `${base.slice(0, Math.max(1, 40 - String(i).length - 1))}-${i}`;
    let query = supabase
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .limit(1);
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query.maybeSingle();
    if (error && error.code !== "PGRST116") {
      // If lookup fails, fall through with a highly unique suffix.
      break;
    }
    if (!data) return candidate;
  }
  return `${base.slice(0, 24)}-${Date.now().toString(36)}`;
}

function isApprenticePortalAccount(row: {
  base_role?: string | null;
  workspace?: string | null;
}): boolean {
  const role = (row.base_role ?? "").trim().toLowerCase();
  const workspace = (row.workspace ?? "").trim().toLowerCase();
  return (
    role === "apprentice" ||
    role === "learner" ||
    workspace === "apprentice" ||
    workspace === "learner"
  );
}
export function mapPortalUser(row: ProfileUserRow): AdminPortalUser {
  const fromResponsibilities = Array.isArray(row.responsibilities)
    ? row.responsibilities.map((t) => t.trim()).filter(Boolean)
    : [];
  const fromDepartment = row.department?.trim() ? [row.department.trim()] : [];
  const rawTitles =
    fromResponsibilities.length > 0 ? fromResponsibilities : fromDepartment;
  const jobTitles = normalizeJobTitles(rawTitles);

  return {
    id: row.id,
    displayName: row.display_name?.trim() || row.email,
    email: row.email,
    role: (row.base_role?.trim() || "Tutor") as AdminPortalUser["role"],
    workspace: row.workspace ?? "staff",
    jobTitles,
    linkedEnrolmentId: null,
    linkedApprenticeId: row.linked_apprentice_id,
    linkedEmployerId: null,
    programmeStartDate: null,
    status: row.portal_status ?? "active",
    enabledBy: row.enabled_by,
    enabledAt: row.enabled_at,
    disabledBy: row.disabled_by,
    disabledAt: row.disabled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function permissionsForStaffRole(role: AdminPortalRole | string): string[] {
  const base = ["messages.view", "ai.use"];
  switch (role) {
    case "Owner":
    case "Management":
      return [
        ...base,
        "management.workspace.view",
        "management.programme.setup",
        "management.roles.assign",
        "management.curriculum.health",
        "management.employer.concerns",
        "admin.users.manage",
        "admin.records.manage",
        "records.proxy.write",
        "lifecycle.kanban.view",
        "apprentice.workspace.view",
        "staff.workspace.view",
      ];
    case "Administrator":
      return [
        ...base,
        "admin.workspace.view",
        "admin.users.manage",
        "admin.records.manage",
        "records.proxy.write",
        "lifecycle.kanban.view",
        "apprentice.workspace.view",
        "staff.workspace.view",
      ];
    case "Quality":
      return [
        ...base,
        "quality.workspace.view",
        "quality.audits.view",
        "quality.findings.view",
        "lifecycle.kanban.view",
      ];
    case "Learning and Progress Mentor":
      return [
        ...base,
        "staff.workspace.view",
        "apprentice.caseload.view",
        "progress.monitor",
        "lifecycle.kanban.view",
        "apprentice.workspace.view",
      ];
    case "Tutor":
      return [
        ...base,
        "staff.workspace.view",
        "apprentices.assigned.view",
        "apprentice.workspace.view",
        "modules.deliver",
        "lifecycle.kanban.view",
      ];
    case "Apprentice":
      return [
        ...base,
        "apprentice.workspace.own",
        "apprentice.modules.view",
        "apprentice.otj.view",
      ];
    case "Employer":
      return [
        ...base,
        "employer.workspace.view",
        "employer.apprentice.view",
        "employer.ask.gta",
        "employer.raise.concern",
        "employer.request.support",
        "employer.clarify.progress",
      ];
    default:
      return base;
  }
}

export async function loadPortalUsers(
  supabase: SupabaseAdmin,
): Promise<{ users: AdminPortalUser[]; error?: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("display_name", { ascending: true });

  if (error) {
    if (isMissingSchemaError(error.message)) {
      return { users: [] };
    }
    return { users: [], error: error.message };
  }

  return {
    users: (data ?? []).map((row) => mapPortalUser(row as ProfileUserRow)),
  };
}

export async function handleStaffAction(
  supabase: SupabaseAdmin,
  body:
    | { action: "createStaff"; input: UserInput & { password?: string } }
    | {
        action: "updateStaffProfile";
        id: string;
        patch: {
          role?: AdminPortalRole;
          workspace?: string;
          jobTitles?: string[];
        };
      }
    | {
        action: "setPortalEnvironment";
        id: string;
        status: AdminPortalUser["status"];
        actorName: string;
      }
    | {
        action: "revealApprenticePassword";
        id: string;
        adminPassword: string;
        adminEmail?: string;
      },
  session?: { account: { email?: string | null; name?: string | null } },
): Promise<NextResponse | null> {
  if (body.action === "createStaff") {
    const input = body.input;
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const role = input.role || "Tutor";
    const workspace = input.workspace || workspaceForRole(role);
    const jobTitles = normalizeJobTitles(input.jobTitles ?? []);
    const password = (input.password ?? "").trim() || generateTempPassword();

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 },
      );
    }

    const username = await allocateUniqueUsername(
      supabase,
      preferredUsername(email, displayName),
    );

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          username,
        },
      });

    let userId = authData.user?.id ?? null;

    if (authError || !userId) {
      const message = authError?.message ?? "Unable to create login";
      const already = /already (been )?registered|already exists/i.test(message);
      if (!already) {
        return NextResponse.json({ error: message }, { status: 500 });
      }

      // Login already exists — link/update the profile instead of failing.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile?.id) {
        userId = existingProfile.id;
      } else {
        const { data: listed, error: listError } =
          await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) {
          return NextResponse.json({ error: listError.message }, { status: 500 });
        }
        const existing = (listed.users ?? []).find(
          (u) => (u.email ?? "").trim().toLowerCase() === email,
        );
        if (!existing) {
          return NextResponse.json({ error: message }, { status: 409 });
        }
        userId = existing.id;
      }

      const { error: pwError } = await supabase.auth.admin.updateUserById(
        userId,
        { password, email_confirm: true },
      );
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 });
      }
    }

    const usernameForProfile = await allocateUniqueUsername(
      supabase,
      preferredUsername(email, displayName),
      userId,
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          username: usernameForProfile,
          display_name: displayName,
          base_role: role,
          workspace,
          permissions: permissionsForStaffRole(role),
          responsibilities: jobTitles,
          department: jobTitles[0] ?? "",
          portal_status: input.status ?? "invited",
          enabled_by: input.enabledBy ?? null,
          enabled_at: input.enabledAt ?? null,
          disabled_by: input.disabledBy ?? null,
          disabled_at: input.disabledAt ?? null,
          linked_apprentice_id: input.linkedApprenticeId,
        },
        { onConflict: "id" },
      )
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      // Only delete a brand-new auth user we just created (not a pre-existing one).
      if (!authError && authData.user?.id) {
        await supabase.auth.admin.deleteUser(authData.user.id);
      }
      const message = profileError?.message ?? "Unable to create staff profile";
      if (isMissingSchemaError(message)) {
        return NextResponse.json(
          {
            error:
              "Staff profile columns missing. Run supabase/migrations/003_staff_profiles.sql.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({
      user: mapPortalUser(profile as ProfileUserRow),
      temporaryPassword: password,
    });
  }

  if (body.action === "updateStaffProfile") {
    const update: Record<string, unknown> = {};
    if (body.patch.jobTitles != null) {
      const titles = normalizeJobTitles(body.patch.jobTitles);
      update.responsibilities = titles;
      update.department = titles[0] ?? "";

      const { data: others, error: othersError } = await supabase
        .from("profiles")
        .select("id, display_name, department, responsibilities")
        .neq("id", body.id);
      if (othersError) {
        return NextResponse.json({ error: othersError.message }, { status: 500 });
      }

      for (const title of titles) {
        if (!EXCLUSIVE_STAFF_JOB_TITLES.has(title)) continue;
        const clash = (others ?? []).find((row) => {
          const held = normalizeJobTitles([
            ...(Array.isArray(row.responsibilities) ? row.responsibilities : []),
            typeof row.department === "string" ? row.department : "",
          ]);
          return held.includes(title);
        });
        if (clash) {
          return NextResponse.json(
            {
              error: `${title} is already attached to ${
                clash.display_name?.trim() || "another staff member"
              }.`,
            },
            { status: 400 },
          );
        }
      }
    }
    if (body.patch.role != null) {
      update.base_role = body.patch.role;
      update.permissions = permissionsForStaffRole(body.patch.role);
    }
    if (body.patch.workspace != null) {
      update.workspace = body.patch.workspace;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", body.id)
      .select(PROFILE_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update staff profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({ user: mapPortalUser(data as ProfileUserRow) });
  }

  if (body.action === "setPortalEnvironment") {
    const stamp = new Date().toISOString();
    const update: Record<string, unknown> = {
      portal_status: body.status,
    };
    if (body.status === "active") {
      update.enabled_by = body.actorName;
      update.enabled_at = stamp;
    }
    if (body.status === "disabled") {
      update.disabled_by = body.actorName;
      update.disabled_at = stamp;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", body.id)
      .select(PROFILE_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update portal environment" },
        { status: 500 },
      );
    }

    let temporaryPassword: string | undefined;
    if (body.status === "active" && isApprenticePortalAccount(data)) {
      temporaryPassword = generateTempPassword();
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        body.id,
        { password: temporaryPassword },
      );
      if (passwordError) {
        return NextResponse.json(
          {
            error: `Portal enabled, but could not set login password: ${passwordError.message}`,
          },
          { status: 500 },
        );
      }
      const { error: storePasswordError } = await supabase
        .from("profiles")
        .update({ temporary_password: temporaryPassword })
        .eq("id", body.id);
      if (storePasswordError) {
        console.warn(
          "Could not persist temporary_password:",
          storePasswordError.message,
        );
      }
    }

    return NextResponse.json({
      user: mapPortalUser(data as ProfileUserRow),
      temporaryPassword,
    });
  }

  if (body.action === "revealApprenticePassword") {
    // Staff are already authenticated via requireAdminAccess on the route.
    // Do NOT re-run signInWithPassword here — Auth has hCaptcha enabled, and this
    // endpoint has no captcha token, so every reveal looked like a wrong password.
    const adminEmail = session?.account.email?.trim().toLowerCase() || "";
    if (!adminEmail) {
      return NextResponse.json(
        { error: "Sign in again as staff, then reveal the apprentice password." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, display_name, base_role, workspace, temporary_password",
      )
      .eq("id", body.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { error: profileError?.message ?? "Apprentice not found" },
        { status: 404 },
      );
    }
    if (!isApprenticePortalAccount(profile)) {
      return NextResponse.json(
        { error: "Only apprentice environment passwords can be revealed." },
        { status: 400 },
      );
    }

    let password =
      typeof profile.temporary_password === "string"
        ? profile.temporary_password.trim()
        : "";
    if (!password) {
      password = generateTempPassword();
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        body.id,
        { password },
      );
      if (passwordError) {
        return NextResponse.json(
          { error: passwordError.message },
          { status: 500 },
        );
      }
      const { error: storeError } = await supabase
        .from("profiles")
        .update({ temporary_password: password })
        .eq("id", body.id);
      if (storeError) {
        return NextResponse.json(
          { error: storeError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      password,
      email: profile.email,
      displayName: profile.display_name,
    });
  }

  return null;
}
