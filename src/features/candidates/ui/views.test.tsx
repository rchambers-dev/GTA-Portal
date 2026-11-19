import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddCandidate, CandidatesList, DuePage, OverviewPage } from "./views";

const props = {
  base: "/administration/onboarding",
  example: true,
  missing: false,
  error: null,
  query: "",
};

describe("candidates pages", () => {
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

  it("renders an empty overview without throwing when example data is off", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewPage, { ...props, example: false, missing: true }),
    );
    expect(html).toContain("Applicants overview");
    expect(html).toContain("Tables not applied yet");
    expect(html).toContain(">0<");
  });
});
