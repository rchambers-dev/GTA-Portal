import { createSupabaseServerClient } from "@/adapters/supabase/client";
import type { EmployerChoice } from "./domain/employers";
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

/** Existing employers for the name search. Empty when the tables are missing. */
export async function loadEmployerChoices(): Promise<EmployerChoice[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const employers = await supabase.from("employers").select("employer_id, company_name").order("company_name");
    if (employers.error || !employers.data) return [];
    const [sites, managers] = await Promise.all([
      supabase.from("employer_sites").select("employer_id, postcode, area_name, is_active"),
      supabase.from("employer_managers").select("employer_id, first_name, middle_names, last_name, phone, email"),
    ]);
    const siteRows = sites.error ? [] : sites.data ?? [];
    const managerRows = managers.error ? [] : managers.data ?? [];
    return employers.data.map((employer) => {
      const site = siteRows.find((row) => row.employer_id === employer.employer_id && row.is_active !== false) ?? siteRows.find((row) => row.employer_id === employer.employer_id);
      const manager = managerRows.find((row) => row.employer_id === employer.employer_id);
      const contact = manager
        ? [manager.first_name, manager.middle_names, manager.last_name].filter(Boolean).join(" ")
        : "No contact recorded";
      return {
        employerId: employer.employer_id,
        name: employer.company_name,
        site: site?.area_name || "Site not recorded",
        address: [site?.area_name, site?.postcode].filter(Boolean).join(", ") || "Address not recorded",
        contact,
        phone: manager?.phone || "No phone recorded",
        email: manager?.email || "No email recorded",
      };
    });
  } catch {
    return [];
  }
}
