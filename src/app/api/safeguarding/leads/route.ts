import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type { SafeguardingLead } from "@/features/apprentice-portal/domain/safeguarding-leads";

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string;
  responsibilities: string[] | null;
  department: string | null;
  portal_status: string | null;
};

function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "SG";
}

function titlesFor(row: ProfileRow): string[] {
  const fromResponsibilities = Array.isArray(row.responsibilities)
    ? row.responsibilities.map((t) => t.trim()).filter(Boolean)
    : [];
  if (fromResponsibilities.length > 0) return fromResponsibilities;
  const dept = row.department?.trim();
  return dept ? [dept] : [];
}

function leadRole(titles: string[]): SafeguardingLead["role"] | null {
  const hasDsl = titles.some((t) => t.toUpperCase() === "DSL");
  const hasDeputy = titles.some((t) => /^deputy\s*dsl$/i.test(t));
  if (hasDsl) return "Designated Safeguarding Lead";
  if (hasDeputy) return "Deputy Safeguarding Lead";
  return null;
}

function roleRank(role: SafeguardingLead["role"]): number {
  return role === "Designated Safeguarding Lead" ? 0 : 1;
}

export async function GET() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, email, responsibilities, department, portal_status",
    )
    .neq("portal_status", "disabled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leads = ((data ?? []) as ProfileRow[])
    .map((row) => {
      const titles = titlesFor(row);
      const role = leadRole(titles);
      if (!role) return null;
      const name = row.display_name?.trim() || row.email;
      return {
        id: row.id,
        role,
        name,
        initials: initialsFromName(name),
        org: "GTA Doncaster",
        email: row.email,
      } satisfies SafeguardingLead;
    })
    .filter((row): row is SafeguardingLead => row != null)
    .sort((a, b) => {
      const byRole = roleRank(a.role) - roleRank(b.role);
      if (byRole !== 0) return byRole;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ leads });
}
