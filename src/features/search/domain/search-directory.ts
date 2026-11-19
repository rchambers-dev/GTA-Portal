import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { apprenticeStatusLabel } from "@/features/administration/domain/apprentice-record";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { excludeTestApprentices, isMissingTestColumn } from "@/features/administration/domain/test-apprentice";
import { addDays } from "@/features/reviews/domain/plan-due";

export type SearchFilter = "all" | "in_learning" | "review_due" | "concern";

export type SearchLearner = {
  gtaId: string;
  name: string;
  detail: string;
  searchText: string;
  inLearning: boolean;
  reviewDue: boolean;
  concern: boolean;
  statusLabel: string;
};

export type SearchEmployer = {
  id: string;
  name: string;
  detail: string;
  searchText: string;
};

export type SearchCandidate = {
  id: string;
  name: string;
  detail: string;
  searchText: string;
  statusLabel: string;
  active: boolean;
  reviewDue: boolean;
};

export type SearchDirectory = {
  query: string;
  filter: SearchFilter;
  learners: SearchLearner[];
  employers: SearchEmployer[];
  candidates: SearchCandidate[];
  totals: { learners: number; employers: number; applicants: number };
  loadError: string | null;
};

export const SEARCH_PAGE = 10;

export function shownCount(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < SEARCH_PAGE) return SEARCH_PAGE;
  return Math.min(200, Math.floor(parsed));
}

export function parseSearchFilter(value: string | undefined): SearchFilter {
  if (value === "in_learning" || value === "review_due" || value === "concern") return value;
  return "all";
}

function personName(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() || "").filter(Boolean).join(" ");
}

function joined(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() || "").filter(Boolean).join(" · ");
}

function hit(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle);
}

function prettyDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function searchDirectoryRows(input: {
  needle: string;
  filter: SearchFilter;
  learners: SearchLearner[];
  employers: SearchEmployer[];
  candidates: SearchCandidate[];
  limits?: { learners?: number; employers?: number; applicants?: number };
}): Pick<SearchDirectory, "learners" | "employers" | "candidates" | "totals"> {
  const needle = input.needle.trim().toLowerCase();
  let learners = needle ? input.learners.filter((row) => hit(row.searchText, needle)) : [...input.learners];
  let employers = needle ? input.employers.filter((row) => hit(row.searchText, needle)) : [...input.employers];
  let candidates = needle ? input.candidates.filter((row) => hit(row.searchText, needle)) : [...input.candidates];
  if (input.filter === "in_learning") {
    learners = learners.filter((row) => row.inLearning);
  } else if (input.filter === "review_due") {
    learners = learners.filter((row) => row.reviewDue);
    candidates = candidates.filter((row) => row.reviewDue);
    employers = [];
  } else if (input.filter === "concern") {
    learners = learners.filter((row) => row.concern);
    employers = [];
    candidates = [];
  }
  const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name);
  learners.sort(byName);
  employers.sort(byName);
  candidates.sort(byName);
  const limits = {
    learners: input.limits?.learners ?? SEARCH_PAGE,
    employers: input.limits?.employers ?? SEARCH_PAGE,
    applicants: input.limits?.applicants ?? SEARCH_PAGE,
  };
  return {
    learners: learners.slice(0, limits.learners),
    employers: employers.slice(0, limits.employers),
    candidates: candidates.slice(0, limits.applicants),
    totals: { learners: learners.length, employers: employers.length, applicants: candidates.length },
  };
}

type ApprenticeRow = {
  gta_id: string;
  first_name: string | null;
  middle_names: string | null;
  last_name: string | null;
  status: string;
  programme_id: string | null;
  is_test?: boolean | null;
};

export async function loadSearchDirectory(
  query: string,
  filter: SearchFilter,
  limits?: { learners?: number; employers?: number; applicants?: number },
): Promise<SearchDirectory> {
  const supabase = await createSupabaseServerClient();
  return readSearchDirectory(supabase, query, filter, limits);
}

async function everyPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const size = 1000;
  const data: T[] = [];
  for (let from = 0; from < 20000; from += size) {
    const page = await load(from, from + size - 1);
    if (page.error) return { data, error: page.error };
    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < size) return { data, error: null };
  }
  return { data, error: null };
}

export async function readSearchDirectory(
  supabase: SupabaseClient,
  query: string,
  filter: SearchFilter,
  limits?: { learners?: number; employers?: number; applicants?: number },
): Promise<SearchDirectory> {
  const today = londonToday();
  const needle = query.trim();

  const withTest = "gta_id, first_name, middle_names, last_name, status, programme_id, is_test";
  const withoutTest = "gta_id, first_name, middle_names, last_name, status, programme_id";
  let apprentices = await everyPage<ApprenticeRow>((from, to) => supabase.from("apprentices").select(withTest).range(from, to));
  if (apprentices.error && isMissingTestColumn(apprentices.error.message)) {
    apprentices = await everyPage((from, to) => supabase.from("apprentices").select(withoutTest).range(from, to));
  }
  const [employments, employers, sites, managers, programmes, tutorLinks, reviews, concerns, candidates, centres, profiles] =
    await Promise.all([
      everyPage<{ gta_id: string; employer_id: string | null; site_id: string | null; manager_id: string | null }>((from, to) =>
        supabase.from("apprentice_employments").select("gta_id, employer_id, site_id, manager_id").is("end_date", null).range(from, to),
      ),
      everyPage<{ employer_id: string; company_name: string | null }>((from, to) =>
        supabase.from("employers").select("employer_id, company_name").range(from, to),
      ),
      supabase.from("employer_sites").select("id, employer_id, postcode, area_name"),
      supabase.from("employer_managers").select("id, employer_id, first_name, middle_names, last_name"),
      supabase.from("programmes").select("id, name"),
      supabase.from("apprentice_tutors").select("apprentice_id, tutor_id").is("end_date", null),
      supabase.from("reviews").select("gta_id, planned_on, status").eq("status", "open"),
      supabase.rpc("get_learner_concerns", { p_gta_id: null }),
      supabase
        .from("candidates")
        .select(
          "candidate_id, first_name, middle_names, last_name, email, phone, status, employer_status, review_due_on, first_contact_on, programme_id, centre_id, employer_id, employer_site_id",
        )
        .neq("status", "converted"),
      supabase.from("candidate_centres").select("id, name"),
      supabase.from("profiles").select("id, display_name, email"),
    ]);

  const programmeName = new Map(
    ((programmes.data ?? []) as { id: string; name: string | null }[]).map((row) => [row.id, row.name || ""]),
  );
  const companyName = new Map(
    ((employers.data ?? []) as { employer_id: string; company_name: string | null }[]).map((row) => [
      row.employer_id,
      row.company_name || "",
    ]),
  );
  const siteById = new Map(
    ((sites.data ?? []) as { id: string; employer_id: string; postcode: string | null; area_name: string | null }[]).map(
      (row) => [row.id, row],
    ),
  );
  const managerName = new Map(
    ((managers.data ?? []) as {
      id: string;
      employer_id: string | null;
      first_name: string | null;
      middle_names: string | null;
      last_name: string | null;
    }[]).map((row) => [row.id, personName([row.first_name, row.middle_names, row.last_name])]),
  );
  const tutorName = new Map(
    ((profiles.data ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((row) => [
      row.id,
      row.display_name?.trim() || row.email?.trim() || "",
    ]),
  );
  const tutorByApprentice = new Map(
    ((tutorLinks.data ?? []) as { apprentice_id: string; tutor_id: string }[]).map((row) => [
      row.apprentice_id,
      tutorName.get(row.tutor_id) || "",
    ]),
  );
  const jobByApprentice = new Map(
    ((employments.data ?? []) as {
      gta_id: string;
      employer_id: string | null;
      site_id: string | null;
      manager_id: string | null;
    }[]).map((row) => [row.gta_id, row]),
  );
  const dueBy = addDays(today, 14);
  const reviewDue = new Set(
    ((reviews.data ?? []) as { gta_id: string; planned_on: string | null }[])
      .filter((row) => row.planned_on && row.planned_on.slice(0, 10) <= dueBy)
      .map((row) => row.gta_id),
  );
  const concernIds = new Set(
    ((concerns.data ?? []) as { gta_id: string; resolved_on: string | null }[])
      .filter((row) => !row.resolved_on)
      .map((row) => row.gta_id),
  );

  const learnerRows = excludeTestApprentices(apprentices.error ? [] : apprentices.data).map((row) => {
    const job = jobByApprentice.get(row.gta_id);
    const site = job?.site_id ? siteById.get(job.site_id) : undefined;
    const employer = job?.employer_id ? companyName.get(job.employer_id) || "" : "";
    const manager = job?.manager_id ? managerName.get(job.manager_id) || "" : "";
    const programme = row.programme_id ? programmeName.get(row.programme_id) || "" : "";
    const tutor = tutorByApprentice.get(row.gta_id) || "";
    const name = personName([row.first_name, row.middle_names, row.last_name]);
    const detail = joined([
      employer,
      site?.area_name,
      site?.postcode,
      manager ? `Manager ${manager}` : "",
      programme,
      tutor ? `Tutor ${tutor}` : "",
    ]);
    return {
      gtaId: row.gta_id,
      name,
      detail,
      searchText: [name, row.gta_id, employer, site?.area_name, site?.postcode, manager, programme, tutor].join(" "),
      inLearning: row.status === "in_learning",
      reviewDue: reviewDue.has(row.gta_id),
      concern: concernIds.has(row.gta_id),
      statusLabel: apprenticeStatusLabel(row.status),
    };
  });

  const sitesByEmployer = new Map<string, { postcode: string; area: string }[]>();
  for (const site of (sites.data ?? []) as { employer_id: string; postcode: string | null; area_name: string | null }[]) {
    const list = sitesByEmployer.get(site.employer_id) ?? [];
    list.push({ postcode: site.postcode || "", area: site.area_name || "" });
    sitesByEmployer.set(site.employer_id, list);
  }
  const managersByEmployer = new Map<string, string[]>();
  for (const manager of (managers.data ?? []) as {
    employer_id: string | null;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
  }[]) {
    if (!manager.employer_id) continue;
    const list = managersByEmployer.get(manager.employer_id) ?? [];
    list.push(personName([manager.first_name, manager.middle_names, manager.last_name]));
    managersByEmployer.set(manager.employer_id, list);
  }
  const placed = new Map<string, number>();
  for (const learner of learnerRows) {
    if (!learner.inLearning) continue;
    const job = jobByApprentice.get(learner.gtaId);
    if (!job?.employer_id) continue;
    placed.set(job.employer_id, (placed.get(job.employer_id) || 0) + 1);
  }

  const employerRows = (employers.error ? [] : employers.data).map((row) => {
    const siteList = sitesByEmployer.get(row.employer_id) ?? [];
    const managerList = (managersByEmployer.get(row.employer_id) ?? []).filter(Boolean);
    const firstSite = siteList[0];
    const learningCount = placed.get(row.employer_id) || 0;
    const name = row.company_name || row.employer_id;
    const detail = joined([
      siteList.length ? `${siteList.length} ${siteList.length === 1 ? "site" : "sites"}` : "",
      firstSite ? [firstSite.area, firstSite.postcode].filter(Boolean).join(" ") : "",
      managerList[0] ? `Manager ${managerList[0]}` : "",
      learningCount ? `${learningCount} ${learningCount === 1 ? "apprentice" : "apprentices"} in learning` : "",
    ]);
    return {
      id: row.employer_id,
      name,
      detail,
      searchText: [
        name,
        row.employer_id,
        ...siteList.flatMap((site) => [site.area, site.postcode]),
        ...managerList,
      ].join(" "),
    };
  });

  const centreName = new Map(
    ((centres.data ?? []) as { id: string; name: string | null }[]).map((row) => [row.id, row.name || ""]),
  );
  const candidateRows = ((candidates.data ?? []) as {
    candidate_id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    employer_status: string | null;
    review_due_on: string | null;
    first_contact_on: string | null;
    programme_id: string | null;
    centre_id: string | null;
    employer_id: string | null;
    employer_site_id: string | null;
  }[]).map((row) => {
    const site = row.employer_site_id ? siteById.get(row.employer_site_id) : undefined;
    const employer = row.employer_id ? companyName.get(row.employer_id) || "" : "";
    const programme = row.programme_id ? programmeName.get(row.programme_id) || "" : "";
    const centre = row.centre_id ? centreName.get(row.centre_id) || "" : "";
    const name = personName([row.first_name, row.middle_names, row.last_name]);
    const employerNeeded = row.employer_status === "needed";
    const detail = joined([
      employer || (employerNeeded ? "employer needed" : ""),
      site?.postcode,
      programme,
      centre ? `${centre} centre` : "",
      row.first_contact_on ? `First contact ${prettyDate(row.first_contact_on)}` : "",
    ]);
    const active = row.status === "active";
    return {
      id: row.candidate_id,
      name,
      detail,
      searchText: [name, row.candidate_id, employer, site?.postcode, programme, centre, row.email, row.phone].join(" "),
      statusLabel: active ? "Active" : row.status.replaceAll("_", " "),
      active,
      reviewDue: Boolean(row.review_due_on && row.review_due_on.slice(0, 10) <= today),
    };
  });

  const matched = searchDirectoryRows({
    needle,
    filter,
    limits,
    learners: learnerRows,
    employers: employerRows,
    candidates: candidates.error ? [] : candidateRows,
  });
  const problem = [apprentices.error?.message, employments.error?.message, employers.error?.message].filter(Boolean).join(" ") || null;
  return { query, filter, ...matched, loadError: problem };
}
