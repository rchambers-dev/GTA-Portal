import { describe, expect, it } from "vitest";
import { applicantCounts, describeApplicant, filterApplicants, type ApplicantFacts } from "./applicant-list";

const fresh: ApplicantFacts = {
  candidateId: "GTA-C-000001",
  firstName: "Reiss",
  middleNames: null,
  lastName: "Chambers",
  status: "active",
  employerStatus: "needed",
  responsiveness: "responsive",
  reviewDueOn: "2027-11-19",
  firstContactOn: "2026-11-19",
  centreName: "Doncaster",
  programmeLabel: "Autocare L2 (ST0499)",
  convertedGtaId: null,
  actualStartOn: null,
  stage2Approved: false,
  checks: [],
  interviewOutcome: null,
  inductionOn: null,
  inductionAttendance: null,
};

describe("applicant list", () => {
  it("shows a new active applicant in Stage 1 and not on Due for review", () => {
    const row = describeApplicant(fresh, "2026-11-19");
    expect(row.stage).toBe("Stage 1");
    expect(row.nextStep).toBe("Verify ID");
    expect(row.employerStatus).toBe("Employer needed");
    expect(row.bucket).toBe("active");
    expect(row.due).toBe(false);
    const counts = applicantCounts([row]);
    expect(counts).toEqual({ active: 1, due: 0, archived: 0, started: 0 });
  });

  it("filters the active list by name and keeps started applicants off it", () => {
    const started = describeApplicant(
      { ...fresh, candidateId: "GTA-C-000002", status: "converted", convertedGtaId: "GTA-000010", actualStartOn: "2026-11-02" },
      "2026-11-19",
    );
    const rows = [describeApplicant(fresh, "2026-11-19"), started];
    expect(filterApplicants(rows, { tab: "active", query: "chambers", site: "All sites", programme: "All programmes", stage: "All stages", employer: "All employer statuses" }).map((row) => row.candidateId)).toEqual(["GTA-C-000001"]);
    expect(filterApplicants(rows, { tab: "started", query: "", site: "All sites", programme: "All programmes", stage: "All stages", employer: "All employer statuses" })).toHaveLength(1);
  });
});
