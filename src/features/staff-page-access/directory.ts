import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type { WorkspaceId } from "@/lib/portal/types";
import type { StaffPerson } from "./model";

const BLOCKED = new Set(["apprentice", "employer", "Apprentice", "Employer"]);

export async function loadStaffDirectory(): Promise<StaffPerson[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, base_role, workspace")
      .order("display_name", { ascending: true });
    if (error || !data) return [];
    return data.flatMap((row) => {
      const workspace = String(row.workspace || "") as WorkspaceId;
      const role = String(row.base_role || "");
      if (BLOCKED.has(workspace) || BLOCKED.has(role)) return [];
      return [
        {
          id: String(row.id),
          name: String(row.display_name || "Staff member"),
          role,
          workspace,
        },
      ];
    });
  } catch {
    return [];
  }
}
