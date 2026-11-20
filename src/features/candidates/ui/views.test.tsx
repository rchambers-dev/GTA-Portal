import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined }),
}));
import { AddCandidate, CandidateRecord, CandidatesList, DuePage, EmployersPage, OverviewPage, VacanciesPage } from "./views";
import type { ApplicantDetail } from "../load";

const props = {
  base: "/administration/onboarding",
  example: true,
  missing: false,
  error: null,
  query: "",
};

describe("candidates pages", () => {
  it("lists a saved applicant and does not mention the migration", () => {
    const html = renderToStaticMarkup(
      createElement(CandidatesList, {
        ...props,
        example: false,
        applicants: [
          {
            candidateId: "GTA-C-000001",
            name: "Reiss Chambers",
            gtaId: null,
            site: "Doncaster",
            programme: "Autocare L2 (ST0499)",
            stage: "Stage 1",
            stageTone: "grey",
            employerStatus: "Employer needed",
            employerTone: "red",
            responsiveness: "Responsive",
            responsivenessTone: "green",
            nextStep: "Verify ID",
            nextBlocked: false,
            bucket: "active",
            due: false,
            reviewDueOn: "2027-11-19",
            firstContactOn: "2026-11-19",
          },
        ],
      }),
    );
    expect(html).toContain("GTA-C-000001");
    expect(html).toContain("Reiss Chambers");
    expect(html).toContain('aria-label="Search applicants by name or ID"');
    expect(html).not.toContain(">Apply<");
    expect(html).toContain("Stage 1");
    expect(html).toContain("Verify ID");
    expect(html).toContain(">1<");
    expect(html).not.toContain("migration is applied");
  });

  it("shows the active filters as removable chips and no Apply button", () => {
    const html = renderToStaticMarkup(
      createElement(CandidatesList, {
        ...props,
        example: false,
        query: "Reiss",
        listSite: "Doncaster",
        applicants: [
          {
            candidateId: "GTA-C-000001",
            name: "Reiss Chambers",
            gtaId: null,
            site: "Doncaster",
            programme: "Autocare L2 (ST0499)",
            stage: "Stage 1",
            stageTone: "grey",
            employerStatus: "Employer needed",
            employerTone: "red",
            responsiveness: "Responsive",
            responsivenessTone: "green",
            nextStep: "Verify ID",
            nextBlocked: false,
            bucket: "active",
            due: false,
            reviewDueOn: "2027-11-19",
            firstContactOn: "2026-11-19",
          },
        ],
      }),
    );
    expect(html).toContain("1 applicant");
    expect(html).toContain("Search: Reiss");
    expect(html).toContain("Site: Doncaster");
    expect(html).toContain("Clear all");
    expect(html).toContain("is-on");
    expect(html).toContain("q=Reiss");
    expect(html).not.toContain(">Apply<");
  });

  it("uses the approved candidate id and keeps the started tab off the active list", () => {
    const html = renderToStaticMarkup(createElement(CandidatesList, props));
    expect(html).toContain("GTA-C-000042");
    expect(html).toContain("Maya Henshaw");
    expect(html).toContain("Started");
    expect(html).toContain("Due for review");
    expect(html).not.toContain("supabase");
  });

  it("lists programmes by id and shows a save error only once", () => {
    const programmeId = "80f06b62-c953-4acd-aacf-630db3a861c4";
    const centreId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const html = renderToStaticMarkup(
      createElement(AddCandidate, {
        ...props,
        example: false,
        error: "Choose a programme from the list.",
        programmes: [{ id: programmeId, label: "Vehicle Maintenance and Repair L3 (ST0033)" }],
        centres: [{ id: centreId, name: "Doncaster" }],
        sources: [{ id: sourceId, label: "Website" }],
        employers: [
          {
            employerId: "GTA-EMP-000001",
            name: "BCA",
            site: "Doncaster depot",
            address: "Doncaster depot, DN1 2AA",
            contact: "Pat Singh",
            phone: "07000000000",
            email: "pat@example.com",
          },
        ],
        initialEmployerId: "GTA-EMP-000001",
      }),
    );
    expect(html).toContain(`value="${programmeId}"`);
    expect(html).toContain("Vehicle Maintenance and Repair L3 (ST0033)");
    expect(html).toContain('name="programmeId"');
    expect(html).toContain('name="centreId"');
    expect(html).toContain('name="sourceId"');
    expect(html).toContain('name="employerId"');
    expect(html).toContain("Doncaster");
    expect(html).toContain("Website");
    expect(html).toContain("BCA");
    expect(html).toContain("Doncaster depot");
    expect(html).toContain("Pat Singh");
    expect(html).not.toContain("No employers are available yet");
    expect(html).not.toContain(">Light Vehicle<");
    expect(html).not.toContain("was not found on the programmes table");
    expect(html.match(/banner-red/g)).toHaveLength(1);
    expect(html).not.toContain("banner-amber");
    expect(html).toContain("Add applicant");
    expect(html).toContain("Save applicant");
  });

  it("asks for email and phone at entry and does not offer an ID field", () => {
    const html = renderToStaticMarkup(createElement(AddCandidate, props));
    expect(html).toContain("Email");
    expect(html).toContain("Phone");
    expect(html).toContain('name="firstContact"');
    expect(html).toContain("GTA-C-000001");
    expect(html).toContain("cannot be typed");
    expect(html).not.toContain('name="externalId"');
    expect(html).not.toContain("Existing ID");
    expect(html).not.toContain("GTA-EMP-");
  });

  it("requires the candidate name before a permanent delete", () => {
    const html = renderToStaticMarkup(
      createElement(DuePage, { ...props, confirmName: "Amira Khan" }),
    );
    expect(html).toContain("Type the full name to confirm");
    expect(html).toContain("Nothing is deleted automatically");
    expect(html).toContain('name="confirmedName"');
  });

  it("wraps long employer names and scrolls the employers and vacancies tables", () => {
    const employers = [
      "Adam Bowes Commercials Limited",
      "All Car Service & MOT Centre Ltd",
      ...Array.from({ length: 10 }, (_, index) => `Employer ${index + 1}`),
    ].map((name, index) => ({
      employerId: `GTA-EMP-${String(index + 1).padStart(6, "0")}`,
      name,
      site: "Doncaster",
      detail: "DN1 2AA",
      openVacancies: 1,
      placesAvailable: 1,
      lastContact: "2026-11-12",
      nextFollowUp: null,
      followUpOverdue: false,
      source: null,
    }));
    const employersHtml = renderToStaticMarkup(
      createElement(EmployersPage, { ...props, example: false, employerRows: employers }),
    );
    expect(employersHtml).toContain("offered to applicants");
    expect(employersHtml).not.toContain("offered to candidates");
    expect(employersHtml).toContain("table-scroll");
    expect(employersHtml).toContain("employer-name");
    expect(employersHtml).toContain('title="Adam Bowes Commercials Limited"');
    expect(employersHtml).toContain('title="All Car Service &amp; MOT Centre Ltd"');
    const vacanciesHtml = renderToStaticMarkup(createElement(VacanciesPage, { ...props, example: true }));
    expect(vacanciesHtml).toContain("table-scroll");
    expect(vacanciesHtml).toContain("employer-name");
    expect(vacanciesHtml).toContain("Adam Bowes Commercials Limited");
    expect(vacanciesHtml).toContain("All Car Service &amp; MOT Centre Ltd");
  });

  it("opens the saved applicant and does not fall back to the example", () => {
    const record: ApplicantDetail = {
      candidateId: "GTA-C-000001",
      name: "Kierra Williamson",
      email: null,
      phone: null,
      site: "Doncaster",
      programme: "Autocare L2 (ST0499)",
      source: "Website",
      firstContactOn: "2026-11-19",
      status: "active",
      statusReason: null,
      employerStatus: "Employer needed",
      employerName: null,
      employerSite: null,
      employerManager: null,
      intendedIntakeOn: null,
      responsiveness: "responsive",
      reviewDueOn: "2027-11-19",
      stage: "Stage 1",
      stage2Approved: false,
      actualStartOn: null,
      convertedGtaId: null,
      checks: [
        { code: "id", label: "ID verified", done: false, actualOn: null },
        { code: "maths", label: "Maths", done: false, actualOn: null },
        { code: "english", label: "English", done: false, actualOn: null },
      ],
      interview: null,
      inductionBooked: false,
      inductionOn: null,
      inductionAttendance: null,
      events: [{ title: "Applicant record created", meta: "Actual date 19 Nov 2026 · Entered 19 Nov 2026" }],
      tracking: {
        firstName: "Kierra",
        middleNames: null,
        lastName: "Williamson",
        email: null,
        phone: null,
        firstContactOn: "2026-11-19",
        notes: null,
        centreId: "11111111-1111-4111-8111-111111111111",
        programmeId: "22222222-2222-4222-8222-222222222222",
        sourceId: "33333333-3333-4333-8333-333333333333",
        sourceDetail: null,
        employerId: null,
        employerSiteId: null,
        employerManagerId: null,
        employerStatusCode: "needed",
        interviewBookingId: null,
        inductionBookingId: null,
        sessions: [],
        intakes: [],
        sites: [],
        managers: [],
        vacancies: [],
        vacancyInterestsReady: false,
      },
    };
    const html = renderToStaticMarkup(
      createElement(CandidateRecord, { ...props, example: false, recordId: "GTA-C-000001", applicantRecord: record }),
    );
    expect(html).toContain("Kierra Williamson");
    expect(html).toContain("GTA-C-000001");
    expect(html).toContain("Autocare L2 (ST0499)");
    expect(html).toContain("No interview yet");
    expect(html).toContain("Employer needed");
    expect(html).toContain("No intended induction");
    expect(html).toContain("Not yet");
    expect(html).toContain('value="GTA-C-000001"');
    expect(html).toContain("Edit details");
    expect(html).toContain("Link employer");
    expect(html).toContain("No interview session is available to book yet.");
    expect(html).toContain("status-green");
    expect(html).toContain("Stage 1");
    expect(html).toContain("Log contact event");
    expect(html).not.toContain("Maya Henshaw");
    expect(html).not.toContain("Northbridge");
    expect(html).not.toContain("4 Jan 2027");
  });

  it("says the applicant was not found when the id is unknown", () => {
    const html = renderToStaticMarkup(
      createElement(CandidateRecord, { ...props, example: false, recordId: "GTA-C-999999", applicantRecord: null }),
    );
    expect(html).toContain("Applicant not found");
    expect(html).toContain("GTA-C-999999");
    expect(html).not.toContain("Maya Henshaw");
    expect(html).not.toContain("Log contact event");
  });

  it("keeps the example applicant behind example mode", () => {
    const html = renderToStaticMarkup(createElement(CandidateRecord, { ...props, recordId: "GTA-C-000042" }));
    expect(html).toContain("Maya Henshaw");
    expect(html).toContain("Unavailable in the example");
    expect(html).not.toContain('value="GTA-C-000042"');
  });

  it("renders an empty overview without throwing when example data is off", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewPage, { ...props, example: false, missing: true }),
    );
    expect(html).toContain("Applicants overview");
    expect(html).toContain("Tables not applied yet");
    expect(html).toContain(">0<");
  });
});
