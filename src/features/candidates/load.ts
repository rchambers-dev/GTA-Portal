import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { buildEmployerDirectory, type EmployerChoice, type EmployerDirectoryRow } from "./domain/employers";
import { isoTodayLondon } from "./domain/format";
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

export type EmployerLoad = {
  choices: EmployerChoice[];
  rows: EmployerDirectoryRow[];
};

/** Existing employers for the name search and the Employers tab. Empty when the tables are missing. */
export async function loadEmployerChoices(): Promise<EmployerLoad> {
  const empty = { choices: [], rows: [] };
  try {
    const supabase = await createSupabaseServerClient();
    const employers = await supabase.from("employers").select("employer_id, company_name").order("company_name");
    if (employers.error || !employers.data) return empty;
    const [sites, managers, vacancies, allocations, reoffers, activities, followUps] = await Promise.all([
      supabase.from("employer_sites").select("employer_id, postcode, area_name, is_active"),
      supabase.from("employer_managers").select("employer_id, first_name, middle_names, last_name, phone, email"),
      supabase.from("employer_vacancies").select("id, employer_id, status, total_places"),
      supabase.from("vacancy_allocations").select("vacancy_id, released_at, release_reason"),
      supabase.from("vacancy_reoffer_decisions").select("vacancy_id, decision"),
      supabase.from("employer_activities").select("id, employer_id, actual_on"),
      supabase.from("employer_follow_ups").select("activity_id, due_on, completed_on"),
    ]);
    const siteRows = sites.error ? [] : sites.data ?? [];
    const managerRows = managers.error ? [] : managers.data ?? [];
    const choices = employers.data.map((employer) => {
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
    const rows = buildEmployerDirectory({
      today: isoTodayLondon(),
      employers: employers.data.map((row) => ({ employerId: row.employer_id, name: row.company_name })),
      sites: siteRows.map((row) => ({
        employerId: row.employer_id,
        areaName: row.area_name || "",
        postcode: row.postcode || "",
        active: row.is_active !== false,
      })),
      vacancies: vacancies.error ? [] : (vacancies.data ?? []).map((row) => ({
        id: row.id,
        employerId: row.employer_id,
        status: row.status,
        totalPlaces: row.total_places,
      })),
      allocations: allocations.error ? [] : (allocations.data ?? []).map((row) => ({
        vacancyId: row.vacancy_id,
        released: Boolean(row.released_at),
        releaseReason: row.release_reason,
      })),
      reoffers: reoffers.error ? [] : (reoffers.data ?? []).map((row) => ({
        vacancyId: row.vacancy_id,
        decision: row.decision,
      })),
      activities: activities.error ? [] : (activities.data ?? []).map((row) => ({
        id: row.id,
        employerId: row.employer_id,
        actualOn: row.actual_on,
      })),
      followUps: followUps.error ? [] : (followUps.data ?? []).map((row) => ({
        activityId: row.activity_id,
        dueOn: row.due_on,
        completedOn: row.completed_on,
      })),
    });
    return { choices, rows };
  } catch {
    return empty;
  }
}
