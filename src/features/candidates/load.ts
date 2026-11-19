import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { formatProgrammeChoice } from "@/features/administration/domain/apprentice-record";
import { describeApplicant, type ApplicantFacts, type ApplicantListItem } from "./domain/applicant-list";
import { contactEventTitle, type ApplicantCheckLine, type ApplicantEventLine } from "./domain/applicant-record";
import { buildEmployerDirectory, type EmployerChoice, type EmployerDirectoryRow } from "./domain/employers";
import { isoTodayLondon, ukDate } from "./domain/format";
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
    return { ready: false, notice: message || "Applicants could not be loaded." };
  }
}

export type ApplicantProgrammeOption = { id: string; label: string };
export type ApplicantCentreOption = { id: string; name: string };
export type ApplicantSourceOption = { id: string; label: string };

export type ApplicantFormOptions = {
  programmes: ApplicantProgrammeOption[];
  centres: ApplicantCentreOption[];
  sources: ApplicantSourceOption[];
  notice: string | null;
};

/** Programmes, centres and sources for the add form. Ids only; names are labels. */
export async function loadApplicantFormOptions(): Promise<ApplicantFormOptions> {
  const empty = { programmes: [], centres: [], sources: [], notice: null as string | null };
  try {
    const supabase = await createSupabaseServerClient();
    const [programmes, centres, sources] = await Promise.all([
      supabase.from("programmes").select("id, name, standard_code, status").order("name"),
      supabase.from("candidate_centres").select("id, name, sort_order, active").order("sort_order"),
      supabase.from("candidate_enquiry_sources").select("id, label, sort_order, active").order("sort_order"),
    ]);
    if (programmes.error) {
      return { ...empty, notice: `Programmes could not be loaded. ${programmes.error.message}` };
    }
    return {
      programmes: (programmes.data ?? [])
        .filter((row) => row.id && row.name?.trim() && (row.status === "active" || row.status == null))
        .map((row) => ({
          id: row.id,
          label: formatProgrammeChoice(row.name, row.standard_code ?? ""),
        })),
      centres: centres.error
        ? []
        : (centres.data ?? [])
            .filter((row) => row.id && row.name && row.active !== false)
            .map((row) => ({ id: row.id, name: row.name })),
      sources: sources.error
        ? []
        : (sources.data ?? [])
            .filter((row) => row.id && row.label && row.active !== false)
            .map((row) => ({ id: row.id, label: row.label })),
      notice: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message)) return empty;
    return { ...empty, notice: message || "The add form could not be loaded." };
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

export type ApplicantListLoad = {
  rows: ApplicantListItem[];
  today: string;
  notice: string | null;
};

/** Applicants for the list and its tab counts. RLS decides which rows come back. */
export async function loadApplicantList(): Promise<ApplicantListLoad> {
  const today = isoTodayLondon();
  const empty = { rows: [], today, notice: null as string | null };
  try {
    const supabase = await createSupabaseServerClient();
    const candidates = await supabase
      .from("candidates")
      .select("candidate_id, first_name, middle_names, last_name, status, employer_status, responsiveness, review_due_on, first_contact_on, centre_id, programme_id, converted_gta_id, actual_start_on, stage2_approved_at")
      .order("last_name");
    if (candidates.error) {
      if (tablesMissing(candidates.error.message, candidates.error.code)) return empty;
      return { ...empty, notice: candidates.error.message };
    }
    const [centres, programmes, definitions, results, interviews, inductions, intakes] = await Promise.all([
      supabase.from("candidate_centres").select("id, name"),
      supabase.from("programmes").select("id, name, standard_code"),
      supabase.from("candidate_check_definitions").select("id, code"),
      supabase.from("candidate_check_results").select("candidate_id, definition_id, result, superseded_at"),
      supabase.from("interview_bookings").select("candidate_id, outcome, attempt_number"),
      supabase.from("induction_bookings").select("candidate_id, intake_id, attendance"),
      supabase.from("induction_intakes").select("id, intake_on"),
    ]);
    const centreName = new Map(((centres.data ?? []) as { id: string; name: string | null }[]).map((row) => [row.id, row.name || ""]));
    const programmeLabel = new Map(
      ((programmes.data ?? []) as { id: string; name: string | null; standard_code: string | null }[]).map((row) => [
        row.id,
        formatProgrammeChoice(row.name || "", row.standard_code || ""),
      ]),
    );
    const definitionCode = new Map(((definitions.data ?? []) as { id: string; code: string }[]).map((row) => [row.id, row.code]));
    const checks = new Map<string, ApplicantFacts["checks"]>();
    for (const result of (results.error ? [] : results.data ?? []) as { candidate_id: string; definition_id: string; result: string | null; superseded_at: string | null }[]) {
      if (result.superseded_at) continue;
      const list = checks.get(result.candidate_id) ?? [];
      list.push({ code: definitionCode.get(result.definition_id) || "", result: result.result });
      checks.set(result.candidate_id, list);
    }
    const interview = new Map<string, { outcome: string; attempt: number }>();
    for (const booking of (interviews.error ? [] : interviews.data ?? []) as { candidate_id: string; outcome: string; attempt_number: number }[]) {
      const current = interview.get(booking.candidate_id);
      if (!current || booking.attempt_number >= current.attempt) interview.set(booking.candidate_id, { outcome: booking.outcome, attempt: booking.attempt_number });
    }
    const intakeOn = new Map(((intakes.data ?? []) as { id: string; intake_on: string }[]).map((row) => [row.id, row.intake_on]));
    const induction = new Map<string, { on: string | null; attendance: string | null }>();
    for (const booking of (inductions.error ? [] : inductions.data ?? []) as { candidate_id: string; intake_id: string; attendance: string | null }[]) {
      induction.set(booking.candidate_id, { on: intakeOn.get(booking.intake_id) ?? null, attendance: booking.attendance });
    }
    const rows = ((candidates.data ?? []) as {
      candidate_id: string;
      first_name: string;
      middle_names: string | null;
      last_name: string;
      status: string;
      employer_status: string;
      responsiveness: string;
      review_due_on: string;
      first_contact_on: string;
      centre_id: string;
      programme_id: string;
      converted_gta_id: string | null;
      actual_start_on: string | null;
      stage2_approved_at: string | null;
    }[]).map((row) => {
      const facts: ApplicantFacts = {
        candidateId: row.candidate_id,
        firstName: row.first_name,
        middleNames: row.middle_names,
        lastName: row.last_name,
        status: row.status,
        employerStatus: row.employer_status,
        responsiveness: row.responsiveness,
        reviewDueOn: row.review_due_on,
        firstContactOn: row.first_contact_on,
        centreName: centreName.get(row.centre_id) || "",
        programmeLabel: programmeLabel.get(row.programme_id) || "",
        convertedGtaId: row.converted_gta_id,
        actualStartOn: row.actual_start_on,
        stage2Approved: Boolean(row.stage2_approved_at),
        checks: checks.get(row.candidate_id) ?? [],
        interviewOutcome: interview.get(row.candidate_id)?.outcome ?? null,
        inductionOn: induction.get(row.candidate_id)?.on ?? null,
        inductionAttendance: induction.get(row.candidate_id)?.attendance ?? null,
      };
      return describeApplicant(facts, today);
    });
    rows.sort((left, right) => left.name.localeCompare(right.name) || left.candidateId.localeCompare(right.candidateId));
    return { rows, today, notice: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message)) return empty;
    return { ...empty, notice: message || "Applicants could not be loaded." };
  }
}

export type ApplicantDetail = {
  candidateId: string;
  name: string;
  email: string | null;
  phone: string | null;
  site: string;
  programme: string;
  source: string;
  firstContactOn: string;
  status: string;
  statusReason: string | null;
  employerStatus: string;
  employerName: string | null;
  employerSite: string | null;
  employerManager: string | null;
  intendedIntakeOn: string | null;
  responsiveness: "responsive" | "unresponsive";
  reviewDueOn: string;
  stage: string;
  stage2Approved: boolean;
  actualStartOn: string | null;
  convertedGtaId: string | null;
  checks: ApplicantCheckLine[];
  interview: { sessionOn: string | null; outcome: string; attempt: number; attendance: string | null } | null;
  inductionBooked: boolean;
  inductionOn: string | null;
  inductionAttendance: string | null;
  events: ApplicantEventLine[];
};

export type ApplicantRecordLoad = {
  record: ApplicantDetail | null;
  notice: string | null;
};

const CHECK_LINES: { code: string; label: string }[] = [
  { code: "id", label: "ID verified" },
  { code: "maths", label: "Maths" },
  { code: "english", label: "English" },
  { code: "tna", label: "TNA completed" },
  { code: "hs_booked", label: "H&S visit booked" },
  { code: "hs_completed", label: "H&S visit completed" },
  { code: "file_created", label: "Learner file created" },
  { code: "file_completed", label: "Learner file completed" },
];

/** One applicant for the detail page. Null when that id is not in the table. */
export async function loadApplicantRecord(recordId: string): Promise<ApplicantRecordLoad> {
  const today = isoTodayLondon();
  try {
    const supabase = await createSupabaseServerClient();
    const columns = "candidate_id, first_name, middle_names, last_name, email, phone, status, status_reason_id, employer_status, employer_id, employer_site_id, employer_manager_id, responsiveness, review_due_on, first_contact_on, centre_id, programme_id, enquiry_source_id, enquiry_source_detail, intended_intake_id, converted_gta_id, actual_start_on, stage2_approved_at, created_at";
    let candidate = await supabase.from("candidates").select(columns).eq("candidate_id", recordId).maybeSingle();
    if (!candidate.error && !candidate.data) {
      candidate = await supabase.from("candidates").select(columns).eq("converted_gta_id", recordId).maybeSingle();
    }
    if (candidate.error) {
      if (tablesMissing(candidate.error.message, candidate.error.code)) return { record: null, notice: null };
      return { record: null, notice: candidate.error.message };
    }
    if (!candidate.data) return { record: null, notice: null };
    const row = candidate.data;
    const [centre, programme, source, employer, site, managerRow, reason, intake, definitions, results, interviews, inductions, events, profiles] = await Promise.all([
      supabase.from("candidate_centres").select("name").eq("id", row.centre_id).maybeSingle(),
      supabase.from("programmes").select("name, standard_code").eq("id", row.programme_id).maybeSingle(),
      supabase.from("candidate_enquiry_sources").select("label").eq("id", row.enquiry_source_id).maybeSingle(),
      row.employer_id ? supabase.from("employers").select("company_name").eq("employer_id", row.employer_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      row.employer_site_id ? supabase.from("employer_sites").select("area_name, postcode").eq("id", row.employer_site_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      row.employer_manager_id ? supabase.from("employer_managers").select("first_name, middle_names, last_name").eq("id", row.employer_manager_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      row.status_reason_id ? supabase.from("reasons").select("label").eq("id", row.status_reason_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      row.intended_intake_id ? supabase.from("induction_intakes").select("intake_on").eq("id", row.intended_intake_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from("candidate_check_definitions").select("id, code, label"),
      supabase.from("candidate_check_results").select("definition_id, result, actual_on, superseded_at").eq("candidate_id", row.candidate_id),
      supabase.from("interview_bookings").select("outcome, attempt_number, attendance, session_id").eq("candidate_id", row.candidate_id),
      supabase.from("induction_bookings").select("attendance, intake_id").eq("candidate_id", row.candidate_id),
      supabase.from("candidate_events").select("event_type, actual_on, entered_at, entered_by, detail").eq("candidate_id", row.candidate_id).order("entered_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);
    const definition = new Map(((definitions.data ?? []) as { id: string; code: string; label: string }[]).map((item) => [item.id, item]));
    const byCode = new Map<string, { result: string | null; actualOn: string | null }>();
    for (const result of (results.data ?? []) as { definition_id: string; result: string | null; actual_on: string | null; superseded_at: string | null }[]) {
      if (result.superseded_at) continue;
      const code = definition.get(result.definition_id)?.code;
      if (code) byCode.set(code, { result: result.result, actualOn: result.actual_on });
    }
    const checks = CHECK_LINES.map((item) => {
      const saved = byCode.get(item.code);
      const done = saved?.result === "pass" || saved?.result === "done" || saved?.result === "booked";
      return { code: item.code, label: item.label, done, actualOn: saved?.actualOn ?? null };
    });
    const interviewRows = (interviews.data ?? []) as { outcome: string; attempt_number: number; attendance: string | null; session_id: string }[];
    const latestInterview = interviewRows.sort((left, right) => right.attempt_number - left.attempt_number)[0] ?? null;
    let sessionOn: string | null = null;
    if (latestInterview) {
      const session = await supabase.from("interview_sessions").select("session_on").eq("id", latestInterview.session_id).maybeSingle();
      sessionOn = session.data?.session_on ?? null;
    }
    const inductionRows = (inductions.data ?? []) as { attendance: string | null; intake_id: string }[];
    const latestInduction = inductionRows[0] ?? null;
    let bookedIntakeOn: string | null = null;
    if (latestInduction) {
      if (latestInduction.intake_id === row.intended_intake_id) bookedIntakeOn = intake.data?.intake_on ?? null;
      else {
        const bookedIntake = await supabase.from("induction_intakes").select("intake_on").eq("id", latestInduction.intake_id).maybeSingle();
        bookedIntakeOn = bookedIntake.data?.intake_on ?? null;
      }
    }
    const names = new Map(((profiles.data ?? []) as { id: string; display_name: string | null }[]).map((item) => [item.id, item.display_name || ""]));
    const eventLines = ((events.data ?? []) as { event_type: string; actual_on: string | null; entered_at: string; entered_by: string | null; detail: { type?: string; notes?: string; source?: string } | null }[]).map((event) => {
      const who = event.entered_by ? names.get(event.entered_by) : "";
      const meta = [`Actual date ${ukDate(event.actual_on)}`, `Entered ${ukDate(event.entered_at)}`, who ? `by ${who}` : ""].filter(Boolean).join(" · ");
      if (event.event_type === "created") {
        const sourceLabel = event.detail?.source ? ` · Source: ${event.detail.source}` : "";
        return { title: "Applicant record created", meta: `${meta}${sourceLabel}` };
      }
      if (event.event_type === "contact") return { title: contactEventTitle(event.detail), meta };
      return { title: event.event_type.split("_").join(" "), meta };
    });
    const managerName = managerRow.data
      ? [managerRow.data.first_name, managerRow.data.middle_names, managerRow.data.last_name].filter(Boolean).join(" ")
      : null;
    const siteLabel = site.data ? [site.data.area_name, site.data.postcode].filter(Boolean).join(" ") : null;
    const facts: ApplicantFacts = {
      candidateId: row.candidate_id,
      firstName: row.first_name,
      middleNames: row.middle_names,
      lastName: row.last_name,
      status: row.status,
      employerStatus: row.employer_status,
      responsiveness: row.responsiveness,
      reviewDueOn: row.review_due_on,
      firstContactOn: row.first_contact_on,
      centreName: centre.data?.name || "",
      programmeLabel: programme.data ? formatProgrammeChoice(programme.data.name || "", programme.data.standard_code || "") : "",
      convertedGtaId: row.converted_gta_id,
      actualStartOn: row.actual_start_on,
      stage2Approved: Boolean(row.stage2_approved_at),
      checks: checks.filter((item) => item.done).map((item) => ({ code: item.code, result: "done" })),
      interviewOutcome: latestInterview?.outcome ?? null,
      inductionOn: bookedIntakeOn,
      inductionAttendance: latestInduction?.attendance ?? null,
    };
    const described = describeApplicant(facts, today);
    const related = [centre, programme, source, employer, site, managerRow, reason, intake, definitions, results, interviews, inductions, events].find((item) => item.error);
    const sourceLabel = [source.data?.label, row.enquiry_source_detail].filter(Boolean).join(" · ") || "—";
    return {
      record: {
        candidateId: row.candidate_id,
        name: described.name,
        email: row.email,
        phone: row.phone,
        site: described.site,
        programme: described.programme,
        source: sourceLabel,
        firstContactOn: row.first_contact_on,
        status: row.status,
        statusReason: reason.data?.label ?? null,
        employerStatus: described.employerStatus,
        employerName: employer.data?.company_name ?? null,
        employerSite: siteLabel,
        employerManager: managerName,
        intendedIntakeOn: intake.data?.intake_on ?? null,
        responsiveness: row.responsiveness === "unresponsive" ? "unresponsive" : "responsive",
        reviewDueOn: row.review_due_on,
        stage: described.stage,
        stage2Approved: Boolean(row.stage2_approved_at),
        actualStartOn: row.actual_start_on,
        convertedGtaId: row.converted_gta_id,
        checks,
        interview: latestInterview ? { sessionOn, outcome: latestInterview.outcome, attempt: latestInterview.attempt_number, attendance: latestInterview.attendance } : null,
        inductionBooked: Boolean(latestInduction),
        inductionOn: bookedIntakeOn,
        inductionAttendance: latestInduction?.attendance ?? null,
        events: eventLines,
      },
      notice: related?.error?.message ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message)) return { record: null, notice: null };
    return { record: null, notice: message || "This applicant could not be loaded." };
  }
}
